# Wesley

> **GraphQL in. PostgreSQL out. Zero downtime by default.**

Wesley inverts the entire database development paradigm. While everyone else generates GraphQL FROM databases, Wesley generates databases FROM GraphQL—along with TypeScript types, Zod schemas, RLS policies, comprehensive tests, and SHA-locked deployment certificates. All from a single source of truth.

**Stop maintaining schemas in 5 places. Start shipping with confidence.**

```graphql
type Document @wes_table @wes_tenant(by: "org_id") @wes_rls(enabled: true) {
  id: ID! @wes_pk
  title: String!
  org_id: ID! @wes_fk(ref: "Org.id")
  created_by: ID! @wes_fk(ref: "User.id")
}
```

## Table of Contents

- [TL;DR – Getting Started](#tldr--getting-started)
- [Why Wesley Exists](#why-wesley-exists)
  - [The Wesley Philosophy](#the-wesley-philosophy)
- [Quick Start](#quick-start)
  - [Try the Examples](#try-the-examples)
- [Key Features](#key-features)
- [Evidence, HOLMES, and Observability](#evidence-holmes-and-observability)
- [Workspace Packages](#workspace-packages)
- [Operational Guidance](#operational-guidance)
- [FAQ](#faq)

## TL;DR – Getting Started

| Goal | Command(s) | Notes |
| --- | --- | --- |
| Install tooling & sanity-check repo | `pnpm install`<br>`pnpm run bootstrap` | Bootstraps dependencies, runs preflight, executes workspace tests. |
| Generate everything from the example schema | `node packages/wesley-host-node/bin/wesley.mjs generate --schema test/fixtures/examples/schema.graphql --ops test/fixtures/examples/ops --emit-bundle --out-dir out/examples` | Produces SQL, pgTAP, ops SQL, and a `.wesley/` evidence bundle. |
| Preview migration plan & rehearsal | `node packages/wesley-host-node/bin/wesley.mjs plan --schema test/fixtures/examples/schema.graphql --explain`<br>`node packages/wesley-host-node/bin/wesley.mjs rehearse --schema test/fixtures/examples/schema.graphql --dry-run --json` | No database required for `--dry-run`; inspect JSON for lock levels and REALM verdicts. |
| Run HOLMES evidence checks | `pnpm --filter @wesley/holmes exec node packages/wesley-host-node/bin/wesley.mjs generate --schema test/fixtures/examples/schema.graphql --emit-bundle --out-dir out/examples`<br>`pnpm --filter @wesley/holmes exec node packages/wesley-holmes/src/cli.mjs investigate --json holmes.json > holmes.md` | Generates scores + markdown report; see [Evidence, HOLMES, and Observability](#evidence-holmes-and-observability). |
| Experience the Daywalker (BLADE) demo | `node packages/wesley-host-node/bin/wesley.mjs blade --schema test/fixtures/blade/schema-v2.graphql --out-dir out/blade --dry-run` | Uses curated fixtures to demonstrate the zero-downtime flow end-to-end. |
| Dive into docs/tests/scripts | [`docs/README.md`](docs/README.md), [`scripts/README.md`](scripts/README.md), [`test/README.md`](test/README.md) | Each guide explains prerequisites, commands, and fixture usage. |

## Why Wesley Exists

Modern development requires describing the same data shape 5+ times:

- PostgreSQL DDL for your database
- GraphQL schema for your API
- TypeScript types for your frontend
- Zod schemas for runtime validation  
- RLS policies for security

**When they drift, production breaks.** Reviews get harder. Deploys get scary. You're playing schema telephone with yourself.

### The Wesley Philosophy

**GraphQL is the single source of truth. Everything else is generated.**

Migrations aren't tasks you write—they're diffs you get for free when your schema evolves. Wesley does what Rails tried with ActiveRecord, but gets it right: **Schema first. Migrations are just artifacts.**

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
# Install Wesley
npm install -g @wesley/cli

# Initialize your schema
wesley init

# Generate everything from your GraphQL schema
wesley generate --schema schema.graphql

# Deploy to production (with zero-downtime planning)
wesley deploy
```

### Try the Examples

```bash
# Clone the repository
git clone https://github.com/flyingrobots/wesley.git
cd wesley
pnpm install

# Generate everything for the example schema
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/schema.graphql \
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

## What You Get

When you run `wesley generate`, you receive:

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

---

## Key Features

### 🔒 Production Safety First

- **Zero-downtime DDL** — All operations use `CONCURRENTLY` or `NOT VALID` patterns by default
- **Advisory locks** — Prevents concurrent migrations automatically  
- **Lock-aware planning** — DDL Planner rewrites operations to minimize lock impact
- **Checkpoint recovery** — Resume failed migrations from last good state
- **Drift detection** — Runtime validation catches schema mismatches before damage

### 🔄 Phased Migration Protocol

Wesley uses battle-tested **Expand → Backfill → Validate → Switch → Contract** strategy:

- **Wave execution** — Batches compatible operations to reduce total time
- **Resource awareness** — Respects Postgres limits (one CIC per table, etc.)
- **Dry-run mode** — Preview exact SQL and lock impact before execution

### 📊 Observable Operations

- **SHA-locked certificates** — Cryptographic proof of what was deployed
- **Explain mode** — Shows precise lock levels for each operation
- **Dead column detection** — Uses `pg_stat_statements` to find unused columns
- **Performance baselines** — Tracks migration timing for future predictions
- **HOLMES scoring** — Evidence-based deployment confidence with customizable weights

### ✅ Comprehensive Testing

- **pgTAP suites** — Generated tests for structure, constraints, RLS, and migrations
- **Property-based testing** — Fast-check for DDL planner correctness
- **Round-trip validation** — Ensures GraphQL → SQL → GraphQL preservation
- **Idempotence checks** — All operations safe to retry

### 🚀 Developer Experience

- **Watch mode** — Incremental compilation with atomic saves
- **GraphQL ESLint** — Schema linting and best practices
- **TypeScript generation** — Types and Zod schemas from GraphQL
- **RLS helpers** — Composable security functions with required indexes

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
type User @wes_table @wes_rls(enabled: true) {
  id: ID! @wes_pk
  email: String! @wes_unique
}
```

### Evolve your schema (v2):

```graphql
type User @wes_table @wes_rls(enabled: true) {
  id: ID! @wes_pk
  email: String! @wes_unique
  posts: [Post!]! @wes_hasMany  # New relationship
}

type Post @wes_table @wes_rls(enabled: true) {
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

Wesley automatically creates:
- New `posts` table with proper indexes
- Foreign key from `Post.author_id` → `User.id`  
- RLS policies for both tables
- TypeScript types for `User` and `Post`
- Zod schemas for runtime validation
- pgTAP tests for structure and constraints

All zero-downtime. All tested. All provably safe.

---

## Advanced Features

### Experimental: Query IR (QIR)

Wesley includes an experimental Query Intermediate Representation pipeline that compiles GraphQL operations into deterministic SQL:

```bash
wesley generate \
  --schema schema.graphql \
  --ops ./operations \
  --emit-bundle
```

The QIR pipeline:
- Parses GraphQL queries, mutations, subscriptions
- Lowers them to an intermediate representation  
- Emits optimized PostgreSQL
- Generates pgTAP tests for operation contracts

See [`docs/guides/qir-ops.md`](docs/guides/qir-ops.md) for details.

### HOLMES: Evidence-Based Deployments

HOLMES inspects `.wesley/` bundles to produce machine-readable scores and human-friendly reports:

```bash
# Investigate deployment readiness
holmes investigate --bundle .wesley/

# Verify against previous deployment
watson verify --current .wesley/ --baseline .wesley/previous/

# Predict migration impact
moriarty predict --bundle .wesley/
```

**Key HOLMES features:**
- **Weighted scoring** — Customize via `.wesley/weights.json`
- **SCS/TCI/MRI metrics** — Schema Coverage, Test Confidence, Migration Risk
- **Evidence maps** — Deterministic fingerprints per release
- **Regression detection** — Catch issues before production

See [`packages/wesley-holmes/README.md`](packages/wesley-holmes/README.md) for the complete guide.

---

## Documentation

### 📚 Getting Started
- **[Documentation Hub](docs/README.md)** — Philosophy, architecture, and manifesto
- **[Quick Start Guide](docs/guides/quick-start.md)** — Get running in 60 seconds
- **[Migration Strategies](docs/guides/migrations.md)** — Schema evolution patterns
- **[Query Operations (QIR)](docs/guides/qir-ops.md)** — Experimental operation pipeline

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

### 🛠️ Development
- **[Scripts Reference](docs/scripts-reference.md)** — Complete `pnpm run` commands guide
- [`scripts/`](scripts/README.md) — Maintenance and automation scripts
- **[Roadmap](docs/roadmap.md)** — Current focus and upcoming milestones
- **[SAGENTS Codex](AGENTS.md)** — Protocol for human and AI contributors

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
└── .wesley/           # Build artifacts (gitignored)
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

- **Node.js**: 18.x, 20.x, 22.x (CI uses Node 20 LTS)
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

Wesley follows the [SAGENTS Codex](AGENTS.md) for contribution guidelines. Whether you're human or machine:

1. **Obey repository rules** — Every rule was written for a reason
2. **Respect `.llmignore`** — It guards focus from noise
3. **Log your work** — Append to the Chronicles, never alter history
4. **Test thoroughly** — Run `pnpm run bootstrap` before submitting

See the [roadmap](docs/roadmap.md) for current priorities and the [Wesley Project Board](https://github.com/users/flyingrobots/projects/5) for active work.

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

**Stop playing schema telephone.**  
**Start shipping with confidence.**  
**Make it so. 🖖**

---

## License

MIT

---

## Links

- **Website**: https://flyingrobots.github.io/wesley/
- **GitHub**: https://github.com/flyingrobots/wesley
- **Issues**: https://github.com/flyingrobots/wesley/issues
- **Project Board**: https://github.com/users/flyingrobots/projects/5
