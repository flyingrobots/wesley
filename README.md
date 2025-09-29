# Wesley

> Production-grade database migrations from GraphQL. Zero downtime by default.

Wesley is a schema-first database migration platform that uses GraphQL SDL as the single source of truth. It generates PostgreSQL DDL with lock-aware strategies, TypeScript types, RLS policies, and comprehensive tests - all while prioritizing production safety with advisory locks, drift detection, and checkpoint recovery.

**The adult in the room for database operations.** No surprises, no 3am pages, just boring reliability.

```graphql
type Document @table @tenant(by: "org_id") @rls(enable: true) {
  id: ID! @pk
  title: String!
  org_id: ID! @fk(ref: "Org.id")
  created_by: ID! @fk(ref: "User.id")
}
```

```mermaid
flowchart LR
    subgraph YOU["You write"]
      GQL["📝 GraphQL Schema<br/><small>schema.graphql</small>"]
    end

    subgraph WES["Wesley compiles"]
      IR["🧠 Wesley IR"]
      SQL["🗄️ Postgres DDL<br/><small>+ phased migrations</small>"]
      TS["📘 TypeScript<br/><small>+ Zod</small>"]
      RLS["🔒 RLS Policies<br/><small>+ helpers</small>"]
      TEST["✅ pgTAP Suite<br/><small>structure/constraints/RLS/plan</small>"]
      CERT["🔏 SHA-Locked Cert<br/><small>proofs & hashes</small>"]
    end

    subgraph PLAN["Zero-downtime plan (by default)"]
      EXP[Expand]
      BKG[Backfill]
      VAL[Validate]
      SWT[Switch]
      CTR[Contract]
    end

    subgraph PROD["You deploy"]
      DEP["🚀 Production"]
    end

    GQL -->|"wesley generate"| IR
    IR --> SQL
    IR --> TS
    IR --> RLS
    IR --> TEST
    IR --> CERT

    SQL --> EXP --> BKG --> VAL --> SWT --> CTR -->|"wesley deploy"| DEP

    classDef p1 fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef p2 fill:#fff3e0,stroke:#ff9800
    classDef p3 fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    class GQL p1
    class SQL,TS,RLS,TEST,CERT p2
    class DEP p3
```

Why GraphQL as schema?

- One source of truth: Describe the domain once; Wesley generates SQL, migrations, types, validation, and RLS from it.
- Naturally relational: Graphs express relationships and constraints cleanly; directives capture DB semantics where they’re used.
- Portable by design: A schema → IR → generators pipeline targets Postgres/Supabase today, other backends tomorrow.

⸻

The problem (short version)

You maintain the same shape in 5+ places:

- GraphQL for APIs
- Postgres DDL for DB
- TypeScript for apps
- Zod for runtime
- RLS for security
- migrations that drift

When they drift, prod breaks. Reviews get harder. Deploys get scary. You’re playing schema telephone.

⸻

How Wesley works

1) Define once

type User @table {
  id: ID! @pk
  email: String! @unique
  org_id: ID! @fk(ref: "Org.id")
}

2) Compile everything

wesley generate --schema schema.graphql
wesley plan         # expand → backfill → validate → switch → contract
wesley rehearse     # run the plan on a shadow DB
wesley certify      # emit SHA-locked proofs
wesley deploy       # apply plan to production

3) What you get

✓ migrations/001_expand.sql     # online DDL
✓ migrations/001_backfill.sql   # idempotent data moves
✓ migrations/001_contract.sql   # cleanup phase
✓ types/generated.ts            # TypeScript interfaces
✓ schemas/zod.ts                # runtime validation
✓ policies/rls.sql              # RLS policies + helpers
✓ tests/                        # pgTAP suites (structure/constraints/RLS/plan)
✓ certs/deploy-<sha>.json       # proofs & hashes

## Key Features

### 🔒 Production Safety First

- **Zero-downtime DDL** - All operations use CONCURRENTLY or NOT VALID patterns by default
- **Advisory locks** - Prevents concurrent migrations automatically
- **Lock-aware planning** - DDL Planner rewrites operations to minimize lock impact
- **Checkpoint recovery** - Resume failed migrations from last good state
- **Drift detection** - Runtime validation catches schema mismatches before damage

### 🔄 Phased Migration Protocol

- **Expand → Backfill → Validate → Switch → Contract** - Battle-tested strategy
- **Wave execution** - Batches compatible operations to reduce total time
- **Resource awareness** - Respects Postgres limits (one CIC per table, etc.)
- **Dry-run mode** - Preview exact SQL and lock impact before execution

### 📊 Observable Operations

- **SHA-locked certificates** - Cryptographic proof of what was deployed
- **Explain mode** - Shows precise lock levels for each operation
- **Dead column detection** - Uses pg_stat_statements to find unused columns
- **Performance baselines** - Tracks migration timing for future predictions

### ✅ Comprehensive Testing

- **pgTAP suites** - Generated tests for structure, constraints, RLS, and migrations
- **Property-based testing** - Fast-check for DDL planner correctness
- **Round-trip validation** - Ensures GraphQL → SQL → GraphQL preservation
- **Idempotence checks** - All operations safe to retry

### 🚀 Developer Experience

- **Watch mode** - Incremental compilation with atomic saves
- **GraphQL ESLint** - Schema linting and best practices
- **TypeScript generation** - Types and Zod schemas from GraphQL
- **RLS helpers** - Composable security functions with required indexes

## Compare

|   | Hand-written | ORMs | Wesley |
| --- | --------- | ---- | ------ |
| Source of truth | ❌ many files | ❌ code-first | ✅ GraphQL schema |
| Zero-downtime | ❌ manual | ❌ table locks risk | ✅ planned by default |
| RLS generation | ❌ manual SQL | ❌ limited | ✅ automated + tests |
| Drift detection | ❌ ad-hoc | ❌ partial | ✅ enforced |
| Test coverage | ❌ rare | ❌ app-only | ✅ pgTAP suites |
| Proof of safety | ❌ none | ❌ none | ✅ SHA-locked certs |

## Getting started

```bash
npm install -g @wesley/cli
wesley init                      # scaffold minimal schema.graphql
wesley generate                  # compile GraphQL → SQL/tests and write snapshot
wesley up --docker               # bootstrap or migrate your dev DB
```

### Edit your schema (v1 → v2):

```graphql
type Post @table @rls(enable: true) {
  id: ID! @pk
  title: String!
  author_id: ID! @fk(ref: "User.id")
  published: Boolean! @default(expr: "false")
}
```

Generate → migrate:

```
wesley generate                  # after editing schema.graphql
wesley up                        # applies additive, lock‑aware migrations

DSN quick reference
- `--dsn` wins for all commands.
- With `--provider supabase`, falls back to `SUPABASE_DB_URL`/`SUPABASE_POSTGRES_URL`.
- Otherwise, uses local default: `postgres://wesley:wesley_test@localhost:5432/wesley_test`.
- If both Supabase and Postgres env vars are present and no `--provider` is set, Wesley prefers Supabase and logs a warning; use `--provider` or `--dsn` to override.
```

## FAQ

> [!faq] What if I need custom SQL?\

Use @custom blocks; Wesley will test them and preserve them across generations.

> [!faq] Can I bring an existing DB?

Yes—introspect to a starting GraphQL schema, then let Wesley own the future diffs.

> [!faq] What about breaking changes?

Detected and flagged. Wesley prefers backward-compatible plans; explicit approval is required for breaking steps.

> [!faq] Prisma vs Wesley?

Prisma focuses on queries. Wesley compiles the data layer (DDL, migrations, RLS, tests, proofs).

---

**Stop maintaining schemas in 5 places.**  
**Start shipping with confidence.**  
**GraphQL in, Supabase out. Deployments are boring.**  

## Demo: BLADE (Daywalker Deploys)

Looking for a memorable 5–7 minute demo? Check out BLADE — the “Daywalker Deploys” flow that runs transform → plan (lock‑aware) → rehearse (shadow) → certify → verify with a single command. See docs/blade.md for the story, assets, and how to run it. Certificates and internal artifacts live under `.wesley/` (e.g., `.wesley/SHIPME.md`).

## Internal Artifacts (`.wesley/`)

Wesley writes build and evidence artifacts to `.wesley/` by default:
- `.wesley/snapshot.json` — IR snapshot for diffs
- `.wesley/realm.json` — rehearsal verdicts
- `.wesley/SHIPME.md` — certificate file (human + canonical JSON)
- Evidence maps and scores (when enabled)

## Environment Variables

Copy `.env.example` to `.env` and set values as needed. Key vars:
- `WESLEY_LOG_LEVEL`: trace|debug|info|warn|error|silent (default: info)
- `WESLEY_GIT_POLICY`: emit|strict|off — git cleanliness checks (default: emit)
- `WESLEY_MAX_SCHEMA_BYTES`: schema size limit in bytes (default: 5MB)
- `WESLEY_CONFIG_FILEPATH`: path to config override
- `GITHUB_SHA`: commit SHA to embed in certs when git isn’t available (CI)
- `SUPABASE_DB_URL` / `SUPABASE_POSTGRES_URL`: DSN for rehearse when provider=supabase
- `WESLEY_TEST_DSN` / `TEST_DATABASE_URL`: opt‑in DSNs for test suites
