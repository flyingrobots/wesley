# Emitters

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when generating Rust, TypeScript, or LE-binary codec artifacts
from GraphQL SDL.

Emitters consume Wesley compiler facts and write generic projection artifacts.
They must not smuggle database, renderer, runtime, or product semantics into
Wesley core.

## Common Tasks

Emit Rust declarations and operation bindings:

```bash
cargo run --bin wesley -- emit rust \
  --schema schema.graphql \
  --out generated/models.rs \
  --metadata-out generated/models.metadata.json
```

Emit TypeScript declarations and operation bindings:

```bash
cargo run --bin wesley -- emit typescript \
  --schema schema.graphql \
  --out generated/models.ts \
  --metadata-out generated/models.metadata.json
```

Emit LE-binary codecs:

```bash
cargo run --bin wesley -- emit le-binary-rust \
  --schema schema.graphql \
  --out generated/codec.rs

cargo run --bin wesley -- emit le-binary-typescript \
  --schema schema.graphql \
  --out generated/codec.ts
```

## Rules Of Thumb

- Use Rust and TypeScript emitters for generic data models and operation
  bindings.
- Use metadata sidecars when outputs need deterministic provenance.
- Put Zod, Postgres, Vue, Vite, renderer, or product artifacts in an external
  target module.
- Emitter changes should use structured AST/printer code, not ad hoc semantic
  string splicing.

## Related Authority

- [CLI Reference](../reference/cli.md#emit)
- [Extending Wesley](../guides/extending.md#emitter-extensions)
- [Build Artifacts](../build-artifacts.md)
- [Compiler Boundary](./compiler-boundary.md)
