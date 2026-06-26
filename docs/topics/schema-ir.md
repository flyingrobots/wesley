# Schema And IR

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when you need to inspect how Wesley sees GraphQL SDL.

Wesley extracts GraphQL structure, normalizes it, lowers it into deterministic
IR, and exposes generic compiler facts. It does not assign product, database,
runtime, or renderer meaning to those facts.

## Common Tasks

Print normalized SDL from this checkout:

```bash
cargo run --bin wesley -- normalize-sdl --schema schema.graphql
```

Print the normalized SDL hash:

```bash
cargo run --bin wesley -- normalize-sdl --schema schema.graphql --hash
```

Lower SDL into Wesley L1 IR JSON:

```bash
cargo run --bin wesley -- schema lower --schema schema.graphql --json
```

Print the L1 registry hash:

```bash
cargo run --bin wesley -- schema hash --schema schema.graphql
```

Compare two SDL states:

```bash
cargo run --bin wesley -- schema diff \
  --old old.graphql \
  --new new.graphql \
  --format summary \
  --exit-code
```

## Rules Of Thumb

- Start from authored `.graphql` files when changing compiler input.
- Use normalized SDL when you need the consolidated structure the Rust compiler
  actually sees.
- Use L1 IR JSON when external tooling needs deterministic compiler facts.
- Use schema hashes as evidence bytes, not as domain meaning.
- If a consumer needs Postgres, Echo, Geordi, Edict, or product behavior, that
  behavior belongs in the owning extension or sibling repo.

## Related Authority

- [CLI Reference](../reference/cli.md#schema)
- [Compiler Boundary](./compiler-boundary.md)
- [Directive Truth Table](../reference/directives.md)
- [Architecture](../ARCHITECTURE.md)
