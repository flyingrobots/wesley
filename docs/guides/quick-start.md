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

## Diff a schema change

Copy the file, make a change, and compare the two SDL states:

```bash
cp schema.graphql schema.next.graphql
cargo wesley schema diff --old schema.graphql --new schema.next.graphql --format summary
```

## Tips

- Use `cargo wesley --help` for native compiler commands.
- Use `cargo xtask docs-check` for documentation-only changes.
- Use `cargo xtask legacy-preflight` only when changing legacy packages or
  pnpm workspace files.
- Use [the directive truth table](../reference/directives.md) when you need to know
  whether a directive is current, experimental, or TTD-only.
