---
title: Quick Start
---

# Quick Start

Follow these steps to try Wesley locally. The commands mirror the README but
are condensed here for convenience.

## 1. Clone and install

```bash
git clone https://github.com/flyingrobots/wesley.git
cd wesley
pnpm install
```

## 2. Generate artifacts

Compile the example schema and operation plans:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/schema.graphql \
  --ops test/fixtures/examples/ops \
  --emit-bundle \
  --out-dir out/examples
```

## 3. Inspect the plan

```bash
node packages/wesley-host-node/bin/wesley.mjs plan \
  --schema test/fixtures/examples/schema.graphql \
  --explain
```

## 4. Rehearse (dry-run)

```bash
node packages/wesley-host-node/bin/wesley.mjs rehearse \
  --schema test/fixtures/examples/schema.graphql \
  --dry-run --json
```

This runs the migration plan without touching a database and prints the REALM
(verdict) JSON.

## 5. Next steps

- Explore the roadmap: [docs/roadmap.md](../roadmap.md)
- Enable Supabase-specific generators: see [docs/features/](../features/).
- Learn about HOLMES scoring: [docs/architecture/holmes-architecture.md](../architecture/holmes-architecture.md)

Need a scripted, showcase flow? Run the [BLADE Demo](../blade.md).

> ℹ️ **Local Postgres fixtures**
>
> The repo seeds the Dockerised PostgreSQL instance with SQL stored in `test/fixtures/postgres/`. Those files are version-controlled so every developer gets the same extensions and baseline objects the first time the container starts.
