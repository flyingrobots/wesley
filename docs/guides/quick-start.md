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

## Generate And Certify

Use the host-node CLI entrypoint directly:

```bash
# Generate artifacts through the default generic transmutation
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema schema.graphql \
  --transmutation null-generator \
  --emit-bundle

# Create and verify SHIPME certificate
node packages/wesley-host-node/bin/wesley.mjs cert-create --out .wesley-cache/SHIPME.md
node packages/wesley-host-node/bin/wesley.mjs cert-verify --in .wesley-cache/SHIPME.md
```

Generated runtime state lives under `.wesley-cache/` and is validated against JSON Schemas in `schemas/`.

## HOLMES (investigate/verify/predict)

From the repo root:

```bash
node packages/wesley-holmes/src/cli.mjs investigate
node packages/wesley-holmes/src/cli.mjs verify
node packages/wesley-holmes/src/cli.mjs predict --from .wesley-cache/scores.json
```

## Tips

- Use canonical directives (`@wes_table`, `@wes_pk`, `@wes_fk`, `@wes_index`, `@wes_default`, `@wes_tenant`).
- Aliases (e.g., `@table`, `@pk`) are accepted but deprecated.
- Use [the directive truth table](../DIRECTIVES.md) when you need to know whether a directive is current, experimental, or TTD-only.
- In CI, use the same entrypoint: `node packages/wesley-host-node/bin/wesley.mjs`.
