# RLS Deep-Dive — From GraphQL to Industrial-Grade Policies

**Thesis**: you declare intent once in GraphQL; Wesley compiles safe RLS (plus tests and indexes) that cover 90% of cases. The other 10% get escape-hatch functions—still generated, still tested, still SHA-attested.

## 1) Multi-tenant isolation (the 80% case)

You write (GraphQL)

```graphql
type Org @table { id: ID! @pk name: String! }

type User @table {
  id: ID! @pk
  email: String! @unique
}

type Membership @table {
  user_id: ID! @fk(ref:"User.id") @index
  org_id:  ID! @fk(ref:"Org.id")  @index
  role:    String! @enum(values:["owner","admin","member"]) @index
}

# Tenant-scoped resource

type Document @table
  @tenant(by:"org_id")
  @rls(enable:true) {
  id: ID! @pk
  org_id: ID! @fk(ref:"Org.id") @index
  title: String!
  body:  String!
  created_by: ID! @fk(ref:"User.id") @index
}
```

Wesley generates (SQL policies)

```sql
-- Base helper view (fast membership lookup)
create or replace view wesley_user_orgs as
  select m.user_id, m.org_id, m.role from membership m;

-- SELECT: user can read docs in any org they belong to
create policy document_tenant_select on document
  for select using (
    exists (
      select 1 from wesley_user_orgs uo
      where uo.user_id = auth.uid() and uo.org_id = document.org_id
    )
  );

-- INSERT: user may insert only into orgs they belong to; created_by must match auth.uid()
create policy document_tenant_insert on document
  for insert with check (
    exists (
      select 1 from wesley_user_orgs uo
      where uo.user_id = auth.uid() and uo.org_id = document.org_id
    )
    and created_by = auth.uid()
  );

-- UPDATE: same as SELECT + enforce org boundary
create policy document_tenant_update on document
  for update using (
    exists (
      select 1 from wesley_user_orgs uo
      where uo.user_id = auth.uid() and uo.org_id = document.org_id
    )
  ) with check (
    exists (
      select 1 from wesley_user_orgs uo
      where uo.user_id = auth.uid() and uo.org_id = document.org_id
    )
  );

-- DELETE: owners/admins only (derived from @enum)
create policy document_tenant_delete on document
  for delete using (
    exists (
      select 1 from wesley_user_orgs uo
      where uo.user_id = auth.uid() and uo.org_id = document.org_id
        and uo.role in ('owner','admin')
    )
  );

-- Tighten the table
alter table document enable row level security;
alter table document force row level security;

-- Indexes Wesley auto-adds for the policy predicates
create index if not exists membership_user_id_org_id_idx on membership(user_id, org_id);
create index if not exists document_org_id_idx on document(org_id);
```

…and (pgTAP) tests so you trust it

```sql
begin;
select plan(6);

-- Setup: two orgs, two users, memberships
select tests.seed_user('u_alice');  -- helper seeds + sets request.jwt.claim.sub
select tests.seed_user('u_bob');
select tests.seed_org('o_acme');
select tests.seed_org('o_umbrella');
select tests.add_membership('u_alice','o_acme','member');
select tests.add_membership('u_bob','o_umbrella','owner');

-- Alice inserts into ACME: allowed
select set_config('request.jwt.claim.sub','u_alice', true);
select lives_ok(
  $$ insert into document (id, org_id, title, body, created_by)
     values ('d1','o_acme','T1','B1','u_alice'); $$,
  'Alice can insert into her tenant'
);

-- Alice reads ACME: allowed
select results_eq(
  $$ select count(*)::int from document where id='d1' $$, ARRAY[1],
  'Alice can read her tenant'
);

-- Alice cannot read Umbrella
select results_eq(
  $$ select count(*)::int from document d
     where d.org_id='o_umbrella' $$, ARRAY[0],
  'Alice cannot see other tenants'
);

-- Bob (owner) can delete in Umbrella
select set_config('request.jwt.claim.sub','u_bob', true);
select lives_ok(
  $$ delete from document where org_id='o_umbrella' $$,
  'Owner can delete in their tenant'
);

select * from finish();
rollback;
```

**Takeaway**: Tenancy rules are one directive; Wesley compiles policies, indexes, and tests. You didn’t hand-write a single USING clause.

⸻

## 2) JOIN-heavy / “complex” authorization (the 15% case)

You write (GraphQL)

```graphql
# Share table for ad-hoc ACLs
type DocumentShare @table {
  doc_id: ID! @fk(ref:"Document.id") @index
  user_id: ID! @fk(ref:"User.id") @index
  can_edit: Boolean! @default(expr:"false")
}

type Document @table
  @tenant(by:"org_id")
  @rls(enable:true,
       select:"membership(org_id) or shared_with_me(id)",
       update:"membership(org_id) and (owner() or editor())") {
  id: ID! @pk
  org_id: ID! @fk(ref:"Org.id") @index
  created_by: ID! @fk(ref:"User.id") @index
  ...
}
```

Wesley compiles into hardened helpers + policies

```sql
-- SECURITY DEFINER helpers (immutable contract, versioned)
create or replace function wesley.membership(p_org uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from membership
    where user_id = auth.uid() and org_id = p_org
  )
$$;

create or replace function wesley.shared_with_me(p_doc uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from document_share
    where user_id = auth.uid() and doc_id = p_doc
  )
$$;

create or replace function wesley.owner(p_user uuid, p_created_by uuid)
returns boolean language sql immutable as $$ select p_user = p_created_by $$;

create or replace function wesley.editor(p_doc uuid)
returns boolean language sql stable security definer as $$
  select can_edit from document_share where user_id = auth.uid() and doc_id = p_doc
$$;

create policy document_complex_select on document
  for select using ( wesley.membership(org_id) or wesley.shared_with_me(id) );

create policy document_complex_update on document
  for update using (
    wesley.membership(org_id) and ( wesley.owner(auth.uid(), created_by) or wesley.editor(id) )
  ) with check ( wesley.membership(org_id) );
```

### Why helpers?

`JOIN` logic moves out of policies into stable, reviewed, testable functions. Policies become readable predicates. You still get pgTAP that hits all branches.

⸻

3) “This one weird permission case” (the 5% case)

You write (GraphQL)

```graphql
type Invoice @table @rls(enable:true, select:"can_read_invoice(id)") {
  id: ID! @pk
  org_id: ID! @fk(ref:"Org.id")
  amount: Decimal!
  status: String! @enum(values:["draft","issued","paid"]) @index
}
```

You supply one custom function; Wesley wraps & tests it

```sql
-- You implement:
create or replace function app_can_read_invoice(p_user uuid, p_invoice uuid)
returns boolean language plpgsql security definer as $$
begin
  -- whatever gnarly business rule you need
  return exists (
    select 1 from membership m
    join invoice i on i.org_id = m.org_id
    where m.user_id = p_user and i.id = p_invoice
      and (i.status != 'draft' or m.role in ('owner','admin'))
  );
end $$;

-- Wesley generates a stable façade that locks calling convention and auditing:
create or replace function wesley.can_read_invoice(p_invoice uuid)
returns boolean language sql stable security definer as $$
  select app_can_read_invoice(auth.uid(), p_invoice)
$$;

create policy invoice_read on invoice
  for select using ( wesley.can_read_invoice(id) );
```

…and the tests

```sql
select ok( wesley.can_read_invoice('inv_123') = true,  'allowed case');
select ok( wesley.can_read_invoice('inv_draft') = false,'draft blocked');
```

Contract: you plug a function; Wesley standardizes it, indexes what it uses, and refuses to promote the migration until the generated tests (plus your custom tests) are green.

⸻

4) What the skeptics get in return
 • Determinism: Same SDL → same policies, helpers, and indexes.
 • Blast-radius minimization: complex rules live in versioned functions, not scattered SQL.
 • Proof, not vibes: pgTAP covers structure, constraints, RLS allow/deny paths, and migration idempotence.
 • Performance baked-in: Wesley emits the exact indexes your policy predicates need.
 • Escape hatches with guardrails: custom function points + generated tests + SHA-locked KONTRAX attestation.

⸻

5) CLI you can paste into a PR

# Generate database + RLS + tests
wesley generate --schema schema.graphql --targets sql,migrations,rls,tests

# Run pgTAP + readiness attestation (SHA-locked)
wesley test
wesley kontrax seal --weights

# Gate deployments: if tests aren’t green, prod promotion is blocked
wesley deploy promote --env prod   # refuses on red

⸻

6) “Gotchas” we neutralize up front
 • JWT plumbing: Wesley expects auth.uid() (Supabase style). For local tests it sets
request.jwt.claim.sub in the session helpers. No JWT? It flips to a pluggable current_user() hook.
 • Policy drift: Any hand-edit triggers drift detection. Build fails with a diff unless annotated as @override.
 • JOINs too slow: Wesley’s index advisor adds missing composite indexes and suggests partial indexes for common predicates, with pgTAP plan checks (uses index? ✅).

⸻

TL;DR pitch for skeptics
 • You keep declaring intent in GraphQL.
 • Wesley compiles the boring, dangerous SQL you don’t want to maintain.
 • The wild cases go in one function with tests and proof.
 • Deploys are boring because bad policies can’t slip through.
  