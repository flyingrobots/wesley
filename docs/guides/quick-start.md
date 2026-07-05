# Quick Start

This guide shows the fastest way to run the Rust-native Wesley compiler flow
using the local workspace.

## Install

```bash
pnpm install
cargo xtask preflight
```

## Create a schema

Create `schema.graphql`:

```graphql
type User {
  id: ID!
  email: String!
  createdAt: String!
}

type Query {
  user(id: ID!): User
}
```

## Inspect and emit

Use the native CLI:

```bash
cargo wesley schema lower --schema schema.graphql --json
cargo wesley schema hash --schema schema.graphql
cargo wesley schema operations --schema schema.graphql --json
cargo wesley emit typescript \
  --schema schema.graphql \
  --out generated/types.ts \
  --metadata-out generated/types.metadata.json
```

Generated compiler artifacts go wherever `--out` points. Metadata sidecars
record the schema hash, generator identity, generator version, and native
execution mode.

## Optional project manifest

Create `wesley.config.json` when a project wants repeatable schema discovery or
multi-schema rebuild selection:

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": ["schema.graphql"],
  "bundleDir": ".wesley-cache"
}
```

Validate it:

```bash
cargo wesley config validate --json
```

## Inspect extension examples

Wesley keeps extension examples as descriptor-only test fixtures under
`test/fixtures/extensions/fixture-zoo`. These files are examples for docs and
tests, not executable modules.

Start with the fixture zoo README, then inspect the three groups:

- `compiler-heavy`: compiler-focused descriptors for schema lowering, operation
  metadata, and generic emitters.
- `evidence-heavy`: evidence-focused descriptors for artifact citations,
  coverage summaries, and judgment summaries.
- `blade-heavy`: BLADE-focused descriptors for release-readiness scenario
  metadata.

Each descriptor shows which generic facts Wesley core may validate and which
meaning stays outside the core. Runtime execution, product behavior, storage,
operator policy, and other domain choices belong to the owning external module
or sibling repo.

## Diff a schema change

Copy the file, make a change, and compare the two SDL states:

```bash
cp schema.graphql schema.next.graphql
cargo wesley schema diff --old schema.graphql --new schema.next.graphql --format summary
```

## Tips

- Use `cargo wesley --help` for native compiler commands.
- Use [the project manifest reference](../reference/project-manifest.md) when
  configuring schema sets, rebuild globs, bundles, or target metadata.
- Use `cargo xtask docs-check` for documentation-only changes.
- Use `cargo xtask legacy-preflight` only when changing legacy packages or
  pnpm workspace files.
- Use [the directive truth table](../reference/directives.md) when you need to know
  whether a directive is current, experimental, or TTD-only.
