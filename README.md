# Wesley
<!-- docs-truth: status=experimental owner=@flyingrobots -->

[![Overall](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/flyingrobots/wesley/main/meta/badges/overall.json)](README.md#overall-project-status)

[![Browser Smoke](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml)
[![Runtime Smokes](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml/badge.svg?branch=main)](https://github.com/flyingrobots/wesley/actions/workflows/runtime-smokes.yml)

> [!note]
> **Wesley** is experimental and under active development.
> Follow the repo and docs for updates as the runtime, evidence model, and operator workflows continue to harden.
> _- flyingrobots_

> **The data layer compiler that turns GraphQL schemas into production-ready PostgreSQL—with zero-downtime migrations, comprehensive tests, and cryptographic deployment proofs.**

Wesley inverts the entire database development paradigm. While everyone else generates GraphQL *from* databases, Wesley generates a battle-tested **PostgreSQL backend _from_ GraphQL**—along with TypeScript types, Zod schemas, Row-Level Security (RLS) policies, comprehensive tests, and SHA-locked deployment certificates. All from a single source of truth.

**Stop maintaining schemas in 5 places. Start shipping with confidence.**

```graphql
type Document @wes_table @wes_tenant(by: "org_id") @wes_rls {
  id: ID! @wes_pk
  title: String!
  org_id: ID! @wes_fk(ref: "Org.id")
  created_by: ID! @wes_fk(ref: "User.id")
}
```

Directive support is broader in the registry than it is on the current hot path. Use [docs/DIRECTIVES.md](docs/DIRECTIVES.md) for the current support matrix before leaning on non-core directives in happy-path schemas.

For project direction and repo workflow, start with [docs/BEARING.md](docs/BEARING.md),
[docs/VISION.md](docs/VISION.md), [ROADMAP.md](ROADMAP.md), and
[docs/method/process.md](docs/method/process.md).

Unlike a pure METHOD repo, Wesley intentionally keeps this root `README.md`
product-facing. Repo workflow doctrine and closeout/release rules live in
[docs/README.md](docs/README.md), [docs/method/process.md](docs/method/process.md),
and [docs/method/release.md](docs/method/release.md).

## TL;DR – Getting Started

| Goal | Command(s) | Notes |
| --- | --- | --- |
| Try the browser playground (Alpha) | `http://localhost:5173/try` (local dev) | **[Try Wesley Now](https://flyingrobots.github.io/wesley/try)** – Edit schemas, compile to SQL, and run queries in-browser (PGLite). No install required. |
| Install tooling & sanity-check repo | `pnpm install`<br>`pnpm run bootstrap` | Bootstraps dependencies, runs preflight, executes workspace tests. |
| Generate everything from the example schema | `node packages/wesley-host-node/bin/wesley.mjs generate --schema test/fixtures/examples/ecommerce.graphql --ops test/fixtures/examples/ops --emit-bundle --out-dir out/examples` | Produces SQL, pgTAP, ops SQL, and a `.wesley-cache/` evidence bundle using the schema that matches the example ops set. |
| Preview migration plan & rehearsal | `node packages/wesley-host-node/bin/wesley.mjs plan --schema test/fixtures/examples/schema.graphql --explain`<br>`node packages/wesley-host-node/bin/wesley.mjs rehearse --schema test/fixtures/examples/schema.graphql --dry-run --json` | No database required for `--dry-run`; inspect JSON for lock levels and REALM verdicts. |
| Run HOLMES evidence checks | `pnpm --filter @wesley/holmes exec node packages/wesley-host-node/bin/wesley.mjs generate --schema test/fixtures/examples/schema.graphql --emit-bundle --out-dir out/examples`<br>`pnpm --filter @wesley/holmes exec node packages/wesley-holmes/src/cli.mjs investigate --json holmes.json > holmes.md` | Generates scores + markdown report; see [Evidence, HOLMES, and Observability](#evidence-holmes-and-observability). |
| Experience the Daywalker (BLADE) demo | `node packages/wesley-host-node/bin/wesley.mjs blade --schema test/fixtures/blade/schema-v2.graphql --out-dir out/blade --dry-run` | Uses curated fixtures to demonstrate the zero-downtime flow end-to-end. |
| Dive into docs/tests/scripts | [`docs/README.md`](docs/README.md), [`scripts/README.md`](scripts/README.md), [`test/README.md`](test/README.md) | Each guide explains prerequisites, commands, and fixture usage. |

## Table of Contents

<img width="500" alt="Wesley" src="https://github.com/user-attachments/assets/2ccbbf55-c42e-45a5-8549-0f103b8d1328" align="right" />

- [TL;DR – Getting Started](#tldr--getting-started)
- [Why Wesley Exists](#why-wesley-exists)
  - [The Wesley Philosophy](#the-wesley-philosophy)
- [Quick Start](#quick-start)
  - [Try the Examples](#try-the-examples)
- [Key Features](#key-features)
- [Advanced Features](#advanced-features)
- [FAQ](#faq)
 - [Evidence, HOLMES, and Observability](#evidence-holmes-and-observability)

---

### Why Wesley Exists

Modern development forces you to describe the same data shape across multiple domains:

1. **PostgreSQL DDL** for your database schema
2. **GraphQL schema** for your API contract
3. **TypeScript types** for your frontend/backend
4. **Zod schemas** for runtime validation
5. **RLS policies** for granular security

**When these five sources drift, production breaks.** Reviews are harder. Deploys are scarier. You're constantly playing _schema telephone_ with yourself.

### The Wesley Philosophy

**GraphQL is the single source of truth. Everything else is generated and tested.**

Migrations aren't manual tasks—they're diffs you get for free when your schema evolves. Wesley realizes the promise of the _schema-first_ approach: **Schema is the source. Migrations are just artifacts.**

## Core Pillars

Wesley is built around a small set of product pillars:

1. **Source authority**: GraphQL SDL plus explicit Wesley inputs define intended
   behavior.
2. **Transmutation breadth**: Wesley should compile that source into many
   executable artifact domains over time.
3. **Runtime truth**: when Wesley has a run model, the ledger outranks
   projections and cache state.
4. **Evidence truth**: readiness and certification claims must match the actual
   strength of evidence.
5. **Local-first operation**: core workflows should work from a local checkout
   and local runtime state.
6. **Governed judgment**: Wesley owns product judgment and operator semantics
   even when substrate tools provide facts.

The important distinction is that not every pillar is an invariant. For
example, `schema-source-of-truth` is an authority invariant; "GraphQL to
Anything" is better understood as Wesley's transmutation-breadth pillar.

## What You Get

When you run `wesley generate`, it outputs a complete, ready-to-deploy data layer:

```bash
✓ migrations/
  ├─ 001_expand.sql      # Online DDL (CONCURRENTLY, NOT VALID)
  ├─ 001_backfill.sql    # Idempotent data transformations
  └─ 001_contract.sql    # Cleanup phase
✓ types/generated.ts     # TypeScript interfaces
✓ schemas/zod.ts         # Runtime validation
✓ policies/rls.sql       # Row-level security + helpers
✓ tests/                 # pgTAP suites
  ├─ structure/          # Table, column, constraint tests
  ├─ rls/                # Policy enforcement tests
  └─ plan/               # Migration plan validation
✓ certs/
  └─ deploy-<sha>.json   # Cryptographic deployment proof
```


```mermaid
flowchart LR
    subgraph YOU["You Write"]
      GQL["📝 GraphQL Schema<br/><small>schema.graphql</small>"]
    end

    subgraph WES["Wesley Generates"]
      IR["🧠 Wesley IR"]
      SQL["🗄️ Postgres DDL<br/><small>+ phased migrations</small>"]
      TS["📘 TypeScript<br/><small>+ Zod</small>"]
      RLS["🔒 RLS Policies<br/><small>+ helpers</small>"]
      TEST["✅ pgTAP Suite<br/><small>structure/constraints/RLS/plan</small>"]
      CERT["🔏 SHA-Locked Cert<br/><small>proofs & hashes</small>"]
    end

    subgraph PLAN["Zero-Downtime Plan"]
      EXP[Expand]
      BKG[Backfill]
      VAL[Validate]
      SWT[Switch]
      CTR[Contract]
    end

    subgraph PROD["You Deploy"]
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

---

## Quick Start

```bash
git clone https://github.com/flyingrobots/wesley.git
cd wesley
pnpm install

# Explore the CLI via the workspace script
pnpm wesley --help

# Generate everything from your GraphQL schema
pnpm wesley generate --schema schema.graphql

# Deploy to production (with zero-downtime planning)
pnpm wesley deploy
```

### Try the Examples

```bash
# Generate everything for the example schema
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --ops test/fixtures/examples/ops \
  --emit-bundle \
  --out-dir out/examples

# Preview migration plan (no database required)
node packages/wesley-host-node/bin/wesley.mjs plan \
  --schema test/fixtures/examples/schema.graphql \
  --explain

# Validate the entire repository
pnpm run bootstrap   # install deps → preflight → test
```

---

## Key Features

<img width="500" alt="Wesley is for YOU!" src="https://github.com/user-attachments/assets/60cb4558-8a98-4d51-bdda-4878ba24f085" align="right" />

Wesley is engineered for safety, speed, and confidence.

### 🔒 Safety First

- **Zero-downtime DDL:** All operations automatically use `CONCURRENTLY` and `NOT VALID` patterns.
- **Phased Migration Protocol:** Implements the battle-tested **Expand → Backfill → Validate → Switch → Contract** strategy.
- **Advisory Locks:** Automated locking prevents concurrent migration disasters.
- **Lock-Aware Planning:** The DDL planner rewrites SQL operations to minimize lock impact.
- **Drift Detection:** Runtime validation catches schema mismatches before damage occurs.

### 🔄 Comprehensive Testing & Validation

- **pgTAP Suites:** Generates PostgreSQL-native tests for structure, constraints, RLS enforcement, and migration logic.
- **Property-Based Testing:** Uses `fast-check` to prove the DDL planner's correctness.
- **Round-Trip Validation:** Guarantees schema preservation: GraphQL → SQL → GraphQL.
- **Idempotence Checks:** All generated operations are safe to retry.

### 📊 ### Observability & Proofs (SHA-lock HOLMES)

- **SHA-Locked Certificates:** Provides an immutable, auditable record of the deployed state.
- **Explain Mode:** Shows the precise **lock levels** for every operation in the migration plan.
- **HOLMES Scoring:** An evidence-based confidence system that produces **SCS/TCI/MRI** metrics (Schema Coverage, Test Confidence, Migration Risk) for deployment readiness.
- **Dead Column Detection:** Tools to find and flag unused database columns for safe cleanup.

---

## Evidence, HOLMES, and Observability

- EvidenceMap is the authoritative mapping between schema elements and generated artifacts. Generators record evidence under stable UIDs:
  - Tables: `tbl:TableName`
  - Columns: `col:TableName.columnName`
- SQL comments like `COMMENT ON COLUMN … IS 'uid: …'` are human-readable hints. Tooling (SourceMap, scoring, HOLMES) reads from EvidenceMap, not from the comment strings.
- To surface a SQL error in the original GraphQL SDL, load the evidence bundle (`.wesley-cache/bundle.json`) and call `findSourceForSql(evidenceMap, { file, line })`.
- Scores (SCS/TCI/MRI) are computed from EvidenceMap; ensure generators record artifacts to keep scores accurate.

Example: map a SQL error back to SDL

```js
import fs from 'node:fs/promises';
import { EvidenceMap } from '@wesley/core';
// Temporary deep import until re-exported at package root
import { findSourceForSql } from '@wesley/core/src/application/SourceMap.mjs';

// Load the bundle written by `wesley generate --emit-bundle`
const raw = await fs.readFile('.wesley-cache/bundle.json', 'utf8');
const bundle = JSON.parse(raw);

// Evidence payload may be nested; normalize it
const payload = bundle?.evidence?.evidence ? bundle.evidence : bundle;
const ev = EvidenceMap.fromJSON(payload);

// If a failure mentions out/schema.sql:123
const mapped = findSourceForSql(ev, { file: 'out/schema.sql', line: 123 });
if (mapped?.source) {
  console.log(`SDL: ${mapped.source.file} lines ${mapped.source.lines} (uid ${mapped.uid})`);
}
```

> [!NOTE]
> The Docker setup seeds PostgreSQL using the version-controlled fixtures in `test/fixtures/postgres/`. Those scripts provision extensions and baseline tables the first time the container starts. Edit or extend them when you need deterministic demo data, and run `pnpm run smoke:postgres-fixture` if you need to confirm the mount still works locally.

---

## Comparison

|   | Hand-written | ORMs | **Wesley** |
|---|--------------|------|------------|
| Source of truth | ❌ Many files | ❌ Code-first | ✅ **GraphQL schema** |
| Zero-downtime | ❌ Manual | ❌ Table locks risk | ✅ **Planned by default** |
| RLS generation | ❌ Manual SQL | ❌ Limited | ✅ **Automated + tests** |
| Drift detection | ❌ Ad-hoc | ❌ Partial | ✅ **Enforced** |
| Test coverage | ❌ Rare | ❌ App-only | ✅ **pgTAP suites** |
| Proof of safety | ❌ None | ❌ None | ✅ **SHA-locked certs** |

---

## Example: Schema Evolution

### Define your schema (v1):

```graphql
type User @wes_table @wes_rls {
  id: ID! @wes_pk
  email: String! @wes_unique
}
```

### Evolve your schema (v2):

```graphql
type User @wes_table @wes_rls {
  id: ID! @wes_pk
  email: String! @wes_unique
  display_name: String
}

type Post @wes_table @wes_rls {
  id: ID! @wes_pk
  title: String!
  author_id: ID! @wes_fk(ref: "User.id")
  published: Boolean! @wes_default(value: "false")
}
```

### Generate and deploy:

```bash
wesley generate                  # Generates migrations, types, policies, tests
wesley plan                      # Shows lock-aware migration plan
wesley rehearse                  # Tests on shadow database
wesley certify                   # Creates SHA-locked proof
wesley deploy                    # Applies to production
```

### The Deployment Process:

<img width="400" alt="Just Add Schema" src="https://github.com/user-attachments/assets/df0ed74b-8dd9-467b-9e6c-563496ca4985" align="right" />

Wesley ensures a safe, zero-downtime deployment by automatically creating:

- The new `Post` table with its foreign key and RLS policies.
- **All** required TypeScript types and Zod schemas.
- **All** pgTAP tests to validate the new structure and security.

### Advanced Features

### Experimental: Query IR (QIR)

Wesley includes an experimental **Query Intermediate Representation** pipeline that compiles GraphQL operations into deterministic, optimized SQL.

The QIR pipeline translates queries, mutations, and subscriptions, then emits optimized PostgreSQL and generates pgTAP tests for operation contracts. See the documentation for details.

```bash
wesley generate \
  --schema schema.graphql \
  --ops ./operations \
  --emit-bundle
```

See [`docs/guides/qir-ops.md`](docs/guides/qir-ops.md) for details.

### SHA-locked HOLMES: Evidence-Based Deployments

<img width="500" alt="SHA-lock Holmes + Shipme" src="https://github.com/user-attachments/assets/685f9193-f1b3-43ca-9c22-3f3fb2a21fd1" align="right" />


The **HOLMES** (Heuristic for Observable Logic, Metrics, and Evidence System) toolkit inspects Wesley's evidence bundles (`.wesley-cache/`) to produce an objective, machine-readable score for deployment readiness.

```bash
# Investigate deployment readiness
holmes investigate --bundle-dir .wesley-cache

# Verify against previous deployment
watson verify --current .wesley-cache --baseline .wesley-cache/previous

# Predict migration impact
moriarty --bundle-dir .wesley-cache
```

This system allows you to define a minimum confidence score before a deploy can proceed.   
The certificate is generates is SHA-locked to the commit it ran against.

See [`packages/wesley-holmes/README.md`](packages/wesley-holmes/README.md) for the complete guide.

---

## Documentation

### 📚 Getting Started
- **[Documentation Hub](docs/README.md)** — Philosophy, architecture, and manifesto
- **[Quick Start Guide](docs/guides/quick-start.md)** — Get running in 60 seconds
- **[Migration Strategies](docs/guides/migrations.md)** — Schema evolution patterns
- **[Query Operations (QIR)](docs/guides/qir-ops.md)** — Experimental operation pipeline
- **[Generator Plugins](docs/guides/generator-plugins.md)** — For generator authors: the plugin contract, testing harness, and configuration

### 🏗️ Architecture
- **[The Paradigm Shift](docs/architecture/paradigm-shift.md)** — Why GraphQL is your source of truth
- **[Architecture Overview](docs/architecture/overview.md)** — Hexagonal, event-driven design
- **[The Algorithm](docs/architecture/algorithm.md)** — How GraphQL becomes SQL
- **[Delivery Lifecycle](docs/architecture/lifecycle.md)** — Transform → Plan → Rehearse → Ship
- **[HOLMES Integration](docs/architecture/holmes-integration.md)** — Evidence bundles and scoring

### 🔧 Implementation
- **[Internals Deep Dive](docs/internals/deep-dive.md)** — How Wesley works under the hood
- **[Event Flow](docs/internals/event-flow.md)** — Tracing events through the system
- **[Parser Design](docs/internals/parser.md)** — GraphQL SDL to domain model

### 📦 Packages
- [`@wesley/cli`](packages/wesley-cli/README.md) — Command-line interface
- [`@wesley/core`](packages/wesley-core/README.md) — Pure domain logic (directive registry, IR, SQL emission)
- [`@wesley/host-node`](packages/wesley-host-node/README.md) — Node.js adapters and binary entrypoint
- [`@wesley/generator-js`](packages/wesley-generator-js/README.md) — JavaScript/TypeScript/Zod emitters
- [`@wesley/generator-supabase`](packages/wesley-generator-supabase/README.md) — Supabase-specific generators
- [`@wesley/holmes`](packages/wesley-holmes/README.md) — SHA-lock investigations and scoring
- [`@wesley/tasks`](packages/wesley-tasks/README.md) — Task orchestration primitives
- [`@wesley/slaps`](packages/wesley-slaps/README.md) — Lock-aware scheduling utilities

### 🧪 Testing & Fixtures
- [`test/`](test/README.md) — Integration and E2E test suites
- [`schemas/`](schemas/README.md) — Canonical GraphQL schemas
- [`test/fixtures/reference/`](test/fixtures/reference/README.md) — Comprehensive SDL for experiments and future tests

### 🧭 Runtime Smokes
- Browser: `node scripts/browser_smoke_playwright.mjs` (builds Vite harness and runs Playwright)
- Deno: `deno run --config deno.json -A scripts/deno_smoke.ts`
- Bun: `bun run scripts/bun_smoke.mjs`

CI runs these via the workflows “Browser Smoke” and “Runtime Smokes”.

### 🖥️ Hosts
- See `docs/architecture/hosts.md` for supported hosts and notes.

### Per‑Package Status
Badges for key packages:

- @wesley/core: ![pkg-core](https://github.com/flyingrobots/wesley/actions/workflows/pkg-core.yml/badge.svg?branch=main)
- @wesley/cli: ![pkg-cli](https://github.com/flyingrobots/wesley/actions/workflows/pkg-cli.yml/badge.svg?branch=main)
- @wesley/host-node: ![pkg-host-node](https://github.com/flyingrobots/wesley/actions/workflows/pkg-host-node.yml/badge.svg?branch=main)
- @wesley/generator-js: ![pkg-generator-js](https://github.com/flyingrobots/wesley/actions/workflows/pkg-generator-js.yml/badge.svg?branch=main)
- @wesley/generator-supabase: ![pkg-generator-supabase](https://github.com/flyingrobots/wesley/actions/workflows/pkg-generator-supabase.yml/badge.svg?branch=main)
- @wesley/holmes: ![pkg-holmes](https://github.com/flyingrobots/wesley/actions/workflows/pkg-holmes.yml/badge.svg?branch=main)
- @wesley/tasks: ![pkg-tasks](https://github.com/flyingrobots/wesley/actions/workflows/pkg-tasks.yml/badge.svg?branch=main)
- @wesley/slaps: ![pkg-slaps](https://github.com/flyingrobots/wesley/actions/workflows/pkg-slaps.yml/badge.svg?branch=main)

## Overall Project Status

<!-- BEGIN:OVERALL_STATUS -->
Stage: MVP  \
Progress: 59% → Alpha
<!-- END:OVERALL_STATUS -->

## Package Matrix

Note: In local runs where `GITHUB_REPOSITORY` is unset, the CI badge column renders an em dash (—).

<!-- BEGIN:PACKAGE_MATRIX -->
| Package | Status | Stage | Progress | CI | Notes |
| --- | --- | --- | --- | --- | --- |
| `@wesley/core` | Active | MVP | 45% → Alpha | ![pkg-core.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-core.yml/badge.svg?branch=main) | Pure domain logic, no Node builtins |
| `@wesley/cli` | Active | Alpha | 50% → Beta | ![pkg-cli.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-cli.yml/badge.svg?branch=main) | CLI + Bats suites |
| `@wesley/host-node` | Active | MVP | 50% → Alpha | ![pkg-host-node.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-host-node.yml/badge.svg?branch=main) | Node adapters + binary |
| `@wesley/host-browser` | Experimental | MVP | 40% → Alpha | ![browser-smoke.yml](https://github.com/flyingrobots/wesley/actions/workflows/browser-smoke.yml/badge.svg?branch=main) | Pure ESM; in-memory FS; minimal parser; smoke-level only |
| `@wesley/generator-js` | Active | MVP | 50% → Alpha | ![pkg-generator-js.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-generator-js.yml/badge.svg?branch=main) | TS/Zod emitters |
| `@wesley/generator-supabase` | Active | MVP | 50% → Alpha | ![pkg-generator-supabase.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-generator-supabase.yml/badge.svg?branch=main) | SQL/RLS/pgTAP emitters |
| `@wesley/holmes` | Active | Alpha | 50% → Beta | ![pkg-holmes.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-holmes.yml/badge.svg?branch=main) | Evidence scoring |
| `@wesley/tasks` | Active | MVP | 50% → Alpha | ![pkg-tasks.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-tasks.yml/badge.svg?branch=main) | Planner utilities |
| `@wesley/slaps` | Active | MVP | 50% → Alpha | ![pkg-slaps.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-slaps.yml/badge.svg?branch=main) | Scheduling/core utils |
| `@wesley/host-deno` | Experimental | Alpha | 50% → Beta | ![pkg-host-deno.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-host-deno.yml/badge.svg?branch=main) | Deno host runtime (demo) |
| `@wesley/host-bun` | Experimental | Alpha | 50% → Beta | ![pkg-host-bun.yml](https://github.com/flyingrobots/wesley/actions/workflows/pkg-host-bun.yml/badge.svg?branch=main) | Bun host runtime (demo) |
| `@wesley/scaffold-multitenant` | Too soon | Prototype | 50% → MVP | — | Early scaffold, no CI yet |
| `@wesley/stack-supabase-nextjs` | Too soon | Prototype | 50% → MVP | — | Early stack template, no CI yet |
<!-- END:PACKAGE_MATRIX -->

### 🛠️ Development
- **[Scripts Reference](docs/scripts-reference.md)** — Complete `pnpm run` commands guide
- **[CI Overview](docs/ci.md)** — How workflows are structured, reusable steps, gating, and artifacts
- [`scripts/`](scripts/README.md) — Maintenance and automation scripts
- **[BEARING](docs/BEARING.md)** — Current direction and tensions at cycle boundaries
- **[VISION](docs/VISION.md)** — Bounded executive synthesis of repo-visible truth
- **[Roadmap](ROADMAP.md)** — Canonical product strategy, fixed contracts, and phase gates
- **[METHOD Process](docs/method/process.md)** — Repo workflow, cycle loop, and closeout rules
- **[Contributing](CONTRIBUTING.md)** — Wesley-specific guide layered on top of METHOD
- **[Agent Guide](AGENTS.md)** — Repository-specific instructions for autonomous contributors

### ✅ Testing
- Quick start
  - Install deps: `pnpm install`
  - Preflight: `pnpm run preflight`
  - Workspace tests: `pnpm -r test`
- Repo-level Bats tests (server/progress/CI checks)
  - Install Bats plugins: `pnpm run setup:bats-plugins`
  - Run the suite: `bats test/serve-static*.bats test/progress-*.bats test/ci-*.bats test/browser-contracts-*.bats`
  - CI runs these conditionally when relevant files change (see [CI Overview](docs/ci.md)).
- Full guide: see `test/README.md` for suite-by-suite commands and fixtures.

### 🎬 Demos
- **[BLADE (Daywalker Deploys)](docs/blade.md)** — 5-minute demo of the full pipeline

---

## Workspace Organization

Wesley is a monorepo managed with pnpm workspaces:

```
wesley/
├── packages/           # Core packages
│   ├── wesley-cli/     # Command-line interface
│   ├── wesley-core/    # Pure domain logic
│   ├── wesley-holmes/  # Evidence scoring
│   └── ...
├── docs/              # Documentation
├── test/              # Integration tests
│   └── fixtures/      # Canonical test inputs
├── schemas/           # Reference schemas
├── scripts/           # Automation tools
└── .wesley-cache/     # Build artifacts and cache (gitignored)
    ├── snapshot.json  # IR snapshot for diffs
    ├── realm.json     # Rehearsal verdicts
    └── SHIPME.md      # Deployment certificate
```

### Working with Packages

```bash
# Run tests for specific package
pnpm --filter @wesley/core test
pnpm --filter @wesley/cli test

# Full system validation
pnpm run bootstrap

# Watch mode during development
wesley watch --schema schema.graphql
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env`:

```bash
# Logging
WESLEY_LOG_LEVEL=info              # trace|debug|info|warn|error|silent

# Git integration
WESLEY_GIT_POLICY=emit             # emit|strict|off

# Schema limits
WESLEY_MAX_SCHEMA_BYTES=5242880    # 5MB default

# Database connections
SUPABASE_DB_URL=postgresql://...
WESLEY_TEST_DSN=postgresql://...
```

### DSN Quick Reference

- `--dsn` flag wins for all commands
- With `--provider supabase`, falls back to `SUPABASE_DB_URL`/`SUPABASE_POSTGRES_URL`
- Otherwise, uses local default: `postgres://wesley:wesley_test@localhost:5432/wesley_test`

---

## Compatibility

- **Node.js**: 22.x (CI uses Node 22)
- **Package manager**: pnpm 9 (workspace pinned)
- **CI runners**: Ubuntu (macOS removed to control costs)
- **Development**: Works on macOS/Windows, but CI targets Ubuntu

---

## FAQ

**Q: What if I need custom SQL?**  
Use `@custom` blocks. Wesley will test them and preserve them across generations.

**Q: Can I bring an existing database?**  
Yes—introspect to a starting GraphQL schema, then let Wesley own future diffs.

**Q: What about breaking changes?**  
Detected and flagged. Wesley prefers backward-compatible plans; explicit approval required for breaking steps.

**Q: How does Wesley compare to Prisma?**  
Prisma focuses on queries. Wesley compiles the entire data layer (DDL, migrations, RLS, tests, proofs).

**Q: Can I use Wesley with [framework]?**  
Yes! Wesley generates standard SQL, TypeScript, and Zod schemas that work with any framework. Dedicated integrations for Next.js/Remix/SvelteKit are on the roadmap.

---

## Contributing

Wesley uses METHOD for repo workflow. Whether you're human or machine:

1. **Read the signposts** — Start with `README.md`, `docs/README.md`, `docs/BEARING.md`, `docs/VISION.md`, `ROADMAP.md`, and `docs/method/process.md`
2. **Use the filesystem queue** — Backlog lives under `docs/method/backlog/`; active cycle packets live under `docs/design/`
3. **Prove claims with witnesses** — Tests plus reproducible playback beat assertion
4. **Close the loop in repo files** — Update backlog, design, retro, witness,
   release, and signpost surfaces instead of appending to a side log
5. **Respect repo rules** — `AGENTS.md` and `.llmignore` still apply

See [docs/BEARING.md](docs/BEARING.md) for current direction,
[docs/method/backlog/](docs/method/backlog/) for queued work, and
[docs/method/release.md](docs/method/release.md) plus
[docs/method/retro/README.md](docs/method/retro/README.md) for closeout and
release doctrine, and [CONTRIBUTING.md](CONTRIBUTING.md) for Wesley-specific
contribution rules.

---

## The Future

Wesley is just the beginning. The roadmap includes:

- **Visual Schema Editor** — Design schemas visually
- **Multi-Database Support** — MySQL, SQLite, and more
- **Framework Integration** — First-class Next.js, Remix, SvelteKit plugins
- **Time-Travel Debugging** — Replay schema evolution
- **AI-Powered Optimization** — Let AI suggest schema improvements

---

## Philosophy

> *"Things are only impossible until they're not."* — Jean-Luc Picard

Wesley is named after Wesley Crusher, the brilliant ensign who saw possibilities others couldn't. Like his namesake, Wesley (the tool) transcends conventional thinking to solve problems in ways that seem obvious only in hindsight.

**The revolution is declaring GraphQL as the single source of truth.**  
**The innovation is making that actually work.**  
**The magic is making it boring.**

---

## Wesley — The Data Layer Compiler

<img src="https://github.com/user-attachments/assets/cce3bbb2-fc70-4081-8fa7-96538b96eb8b" width="300" alt="Wesley" align="left" />

**Stop playing schema telephone.**  
**Start shipping with confidence.**  
**Make it so. 🖖**

---

### Links

- **Website**: https://flyingrobots.github.io/wesley/
- **GitHub**: https://github.com/flyingrobots/wesley
- **Issues**: https://github.com/flyingrobots/wesley/issues
- **BEARING**: [docs/BEARING.md](docs/BEARING.md)
- **VISION**: [docs/VISION.md](docs/VISION.md)

---

## License

MIT © J. Kirby Ross ([flyingrobots](https://github.com/flyingrobots)
