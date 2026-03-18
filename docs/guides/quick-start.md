# Quick Start

This guide shows the fastest way to run the Wesley MVP flow using the local workspace. It uses the Node host entrypoint provided by `@wesley/host-node` and the HOLMES CLI located in the repo.

## Install

```bash
pnpm install
```

## Create a schema

Create `schema.graphql` with the current hot-path directive subset:

```graphql
type User @wes_table {
  id: ID! @wes_pk @wes_default(value: "gen_random_uuid()")
  email: String! @wes_unique
  created_at: DateTime! @wes_default(value: "now()")
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

You can place GraphQL operation documents or `*.op.json` plans in an `ops/`
folder and pass `--ops ops/` to `generate`. The current CLI compiles those
operations into SQL artifacts; it is no longer just a no-op validator.

Example:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --ops test/fixtures/examples/ops \
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
bash test/fixtures/blade/run.sh
```

## Tips

- Use canonical directives (`@wes_table`, `@wes_pk`, `@wes_fk`, `@wes_index`, `@wes_default`, `@wes_tenant`).
- Aliases (e.g., `@table`, `@pk`) are accepted but deprecated.
- Use [the directive truth table](../DIRECTIVES.md) when you need to know whether a directive is current, experimental, or TTD-only.
- In CI, use the same entrypoint: `node packages/wesley-host-node/bin/wesley.mjs`.
