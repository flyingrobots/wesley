Migrations aren’t “SQL files,” they’re protocols. Wesley compiles that protocol for you and refuses to ship dumb stuff.

Here’s how we answer the three hard parts.

⸻

1) Backward compatibility during deploys

Strategy: expand → backfill → switch → contract.
Wesley never ships a breaking DDL in one jump. It emits two ordered migrations plus a background job spec.

Generated artifacts per change:

- NNNN_expand.sql – safe, online changes only
- NNNN_backfill.sql – idempotent data fix-up (can run in batches)
- NNNN_contract.sql – remove shims once traffic is on the new shape
- NNNN_tests.sql – pgTAP proving both pre/post semantics

Tactics Wesley uses automatically (Postgres-aware):

- NOT VALID constraints first → VALIDATE CONSTRAINT later (no table rewrite, minimal locks)
- CREATE INDEX CONCURRENTLY / DROP INDEX CONCURRENTLY
- Add columns NULLABLE w/ DEFAULT (fast-path constant defaults on modern PG), then UPDATE/backfill, then SET NOT NULL
- Generated columns / views for compatibility (old consumers keep working)
- Security definer helpers for RLS changes so policy text stays stable while logic can evolve behind it

If a change can’t be expressed in a backward-compatible way, Wesley labels it BREAKING and blocks prod promotion unless you set allowBreaking: true for that migration in wesley.config.mjs. No vibes-only deploys.

⸻

2) Zero-downtime migrations

Rule: never take an ACCESS EXCLUSIVE lock on hot paths.

Wesley classifies each operation and picks the online form:

- Indexes → CREATE INDEX CONCURRENTLY
- Constraints → ADD … NOT VALID → VALIDATE CONSTRAINT
- Column type changes that would rewrite → shadow column pattern:
 1. Add new_col (nullable)
 2. Dual-write trigger or upsert rule
 3. Backfill in chunks (LIMIT/OFFSET/PK window)
 4. Swap in a single transaction (view/rename/USING clause where safe)
 5. Drop old column in contract phase
- Enum changes → safe ALTER TYPE … ADD VALUE or the shadow-enum dance for renames
- Array shape changes → see below; it’s a shadow + check constraint.

Preflight guards Wesley runs by default:

- lock_timeout / statement_timeout set low in expand phase
- Advisory lock (pg_advisory_xact_lock) to serialize deploy steps
- Lint: refuse ALTER TABLE … SET DATA TYPE when it implies a table rewrite on big tables (classified by catalog stats)
- Canary step: optional “shadow DB” rehearsal (Docker/compose is already in your repo)

⸻

3) Rollback scenarios

Truth: DDL rollbacks are often forward fixes, not time travel. Wesley makes that safe and explicit.

- Every migration has a reversible plan. Where PG can truly roll back, we generate DOWN steps.
- Where not (e.g., dropped data), Wesley emits a compensating migration and marks the original irreversible. CI will require an operator note (--@why:) to merge.
- Restore point tag: before contract, Wesley emits SELECT pg_create_restore_point('wesley_<id>'); so you can PITR if hell breaks loose.
- All migrations are idempotent (guards check for object existence, index names are deterministic), so re-running is safe.

⸻

Ordering: deterministic & dependency-aware

Wesley builds a DAG of operations from the schema diff:

- Nodes: table, column, index, constraint, policy, function, view
- Edges: FK depends on tables; policy depends on columns/functions; validate depends on add; contract depends on traffic switch
- Sort: topological + stable, then split into phases: expand > backfill > validate > switch > contract

This is why array nullability being “still sorting out” in your POC doesn’t scare me: the compiler enforces the protocol even while edge typing improves.

⸻

The spicy one: array nullability

Goal examples:
 • text[] (nullable elements allowed) → text[] (no NULL elements)
 • text[] NULL → text[] NOT NULL DEFAULT '{}'::text[]

Generated plan:
 1. Expand
 • ALTER TABLE … ADD CONSTRAINT <col>_no_nulls CHECK (array_position(<col>, NULL::text) IS NULL) NOT VALID;
 • if going NOT NULL: ALTER TABLE … ALTER COLUMN <col> SET DEFAULT '{}'::text[];
 2. Backfill
 • UPDATE … SET <col> = COALESCE(<col>, '{}'::text[]) WHERE <col> IS NULL;
 • UPDATE … SET <col> = array_remove(<col>, NULL) WHERE array_position(<col>, NULL::text) IS NOT NULL;
 • (chunked with PK windows)
 3. Validate
 • ALTER TABLE … VALIDATE CONSTRAINT <col>_no_nulls;
 • ALTER TABLE … ALTER COLUMN <col> SET NOT NULL; (now instant)
 4. Contract
 • Drop any temporary triggers/views used for dual-write

You get pgTAP for both the check and the NOT NULL enforcement, plus a data-quality test that asserts “no NULL elements remain.”

⸻

What the output actually looks like

2025_09_02_120001_expand.sql

-- expand
set lock_timeout = '1s';
set statement_timeout = '5s';

alter table only public.document
  add column author_ids uuid[]; -- nullable for now

-- online index for future queries
create index concurrently if not exists document_author_ids_gin
  on public.document using gin (author_ids);

-- constraint added NOT VALID
alter table only public.document
  add constraint document_author_ids_no_nulls
  check (array_position(author_ids, NULL::uuid) is null) not valid;

2025_09_02_120002_backfill.sql

-- backfill (chunked)
do $$
declare _min uuid; _max uuid;
begin
  for _min,_max in
    select min(id), max(id) from public.document
  loop
    update public.document
      set author_ids = coalesce(author_ids, '{}')
      where id between _min and _max;
    update public.document
      set author_ids = array_remove(author_ids, null)
      where array_position(author_ids, null) is not null
        and id between _min and _max;
  end loop;
end $$;

2025_09_02_120003_switch.sql

-- validate after backfill
alter table only public.document
  validate constraint document_author_ids_no_nulls;

alter table only public.document
  alter column author_ids set not null;

2025_09_02_120004_contract.sql

-- nothing to clean in this case; example placeholder
-- drop temp artifacts if any were used

2025_09_02_tests.sql

begin;
select plan(4);
select has_column('public','document','author_ids','column added');
select col_not_null('public','document','author_ids','now not null');
select throws_ok($$ insert into public.document (id, author_ids) values (gen_random_uuid(), array[null::uuid]) $$,
                 '23514', 'check constraint blocks null elements');
select * from finish();
rollback;

⸻

Guardrails wired to CI
 • wesley lint migrations → fails on rewrite-prone changes in hot tables
 • wesley rehearse → spins a shadow DB (your docker-compose.yml) and runs expand/backfill/validate/tests
 • wesley kontrax seal → SHA-locked attestation (includes migration risk class, lock profile, runtime)
 • wesley deploy promote --env prod → blocked unless attestation status is green

Config knobs you control:

// wesley.config.mjs
export default {
  migrations: {
    strategy: 'expand_contract',
    chunkSize: 10_000,
    maxTableRewriteMB: 16,   // block >16MB rewrites in prod
    requireTests: true,
    allowBreaking: false,
    minPgVersion: '14'
  },
  ci: {
    rehearsal: { enabled: true, dockerService: 'db' },
    seal: { requireOn: ['main', 'release/*'] }
  }
};

⸻

TL;DR for the haters
 • Ordering: dependency-graph + phases. Deterministic.
 • Backward-compat: expand/backfill/switch/contract, with proof.
 • Zero-downtime: NOT VALID + VALIDATE, CONCURRENTLY, shadow patterns, low timeouts.
 • Rollback: down scripts where real; else forward-fix with restore points—explicitly marked.
 • Arrays/nullability: compiled into check + backfill + validate; no table rewrite surprises.

If they still want to argue, cool—point me at a migration and I’ll show them the exact plan Wesley would emit and the tests that make it boring.
