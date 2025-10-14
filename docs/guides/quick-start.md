# Quick Start

This guide shows the fastest way to run the Wesley MVP flow using the local workspace. It uses the Node host entrypoint provided by `@wesley/host-node` and the HOLMES CLI located in the repo.

## Install

```bash
pnpm install
```

## Create a schema

Create `schema.graphql` with canonical `@wes_*` directives:

```graphql
type User @wes_table @critical {
  id: ID! @wes_pk @wes_default(expr: "gen_random_uuid()")
  email: String! @wes_unique
  created_at: DateTime! @wes_default(expr: "now()")
}
```

## Generate, plan, rehearse, certify

Use the host-node CLI entrypoint directly:

```bash
# Generate artifacts (SQL/Types/Zod/tests + evidence)
node packages/wesley-host-node/bin/wesley.mjs generate --schema schema.graphql --emit-bundle

# Explain the migration plan
node packages/wesley-host-node/bin/wesley.mjs plan --schema schema.graphql --explain

# Rehearse the plan on a shadow DB (set DSN or pass --docker)
node packages/wesley-host-node/bin/wesley.mjs rehearse --schema schema.graphql --dsn $TEST_DATABASE_URL --json

# Create and verify SHIPME certificate
node packages/wesley-host-node/bin/wesley.mjs cert-create --out .wesley/SHIPME.md
node packages/wesley-host-node/bin/wesley.mjs cert-verify --in .wesley/SHIPME.md
```

Evidence bundle lives under `.wesley/` and is validated against JSON Schemas in `schemas/`.

### Experimental: Operation Documents (QIR)

You can compile GraphQL operation documents (queries) in an `ops/` folder and pass `--ops ops/` to `generate`. Each `*.op.json` file is translated to a deterministic SQL function (and, when parameterless, a companion view) under `out/ops/`. See [docs/guides/qir-ops.md](./qir-ops.md#quick-start-from-graphql-to-executable-sql) for the JSON shape, naming rules, and CLI flags.

Example:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema schema.graphql \
  --ops ops/ \
  --emit-bundle
```

## HOLMES (investigate/verify/predict)

From the repo root:

```bash
node packages/wesley-holmes/src/cli.mjs investigate
node packages/wesley-holmes/src/cli.mjs verify
node packages/wesley-holmes/src/cli.mjs predict --from .wesley/scores.json
```

## Demo (BLADE)

Run the full demo flow:

```bash
bash demo/blade/run.sh
```

## Tips

- Use canonical directives (`@wes_table`, `@wes_pk`, `@wes_fk`, `@wes_index`, `@wes_default`, `@wes_tenant`).
- Aliases (e.g., `@table`, `@pk`) are accepted but deprecated.
- In CI, use the same entrypoint: `node packages/wesley-host-node/bin/wesley.mjs`.
