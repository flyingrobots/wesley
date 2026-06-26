# Operations

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when you need operation catalogs, selected field paths, or
operation directive arguments.

Operations are generic GraphQL compiler facts in Wesley. Downstream extensions
decide what an operation means for a runtime, database, scheduler, policy, or
product.

## Common Tasks

List root schema operations:

```bash
cargo run --bin wesley -- schema operations --schema schema.graphql --json
```

Resolve operation selection paths:

```bash
cargo run --bin wesley -- operation selections \
  --operation query.graphql \
  --schema schema.graphql \
  --json
```

Extract directive arguments from operations:

```bash
cargo run --bin wesley -- operation directive-args \
  --operation query.graphql \
  --directive wes_footprint \
  --json
```

## Rules Of Thumb

- Operation facts are structure, not admission policy.
- Response paths use GraphQL response names where aliases exist.
- Schema-coordinate selections require schema SDL.
- Unsupported runtime behavior belongs in an extension, not in operation
  analysis.

## Related Authority

- [CLI Reference](../reference/cli.md#operation)
- [Compiler Boundary](./compiler-boundary.md)
- [Extending Wesley](../guides/extending.md)
- [Wesley Core Versus Toolchain](../architecture/wesley-core-vs-toolchain.md)
