# wesley-core

The compiler kernel of [Wesley](https://github.com/flyingrobots/wesley#readme). It parses GraphQL SDL, lowers it
to Wesley's L1 IR, hashes it, lists its operations, and classifies the
differences between two schemas. It is synchronous and performs no I/O.

```toml
wesley-core = { version = "=0.3.0-alpha.2", default-features = false }
```

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sdl = "type Product { id: ID! name: String! } type Query { product(id: ID!): Product }";

    let ir = wesley_core::lower_schema_sdl(sdl)?;
    let hash = wesley_core::compute_registry_hash(&ir)?;
    let operations = wesley_core::list_schema_operations_sdl(sdl)?;
    println!("{} types, {} operations, hash {hash}", ir.types.len(), operations.len());

    let narrower = "type Product { id: ID! } type Query { product(id: ID!): Product }";
    let delta = wesley_core::diff_schema_sdl(sdl, narrower)?;
    println!("{} types modified", delta.modified_types.len());
    Ok(())
}
```

## Entry points

| Function                                                           | Gives you                                |
| ------------------------------------------------------------------ | ---------------------------------------- |
| `lower_schema_sdl`                                                 | the L1 IR for a schema                   |
| `normalize_schema_sdl`                                             | a canonical SDL rendering                |
| `compute_registry_hash`, `compute_content_hash`                    | SHA-256 hashes of an IR or of text       |
| `list_schema_operations_sdl`                                       | the Query, Mutation, Subscription fields |
| `diff_schema_sdl`                                                  | added, removed, and modified types       |
| `resolve_operation_selections`, `extract_operation_directive_args` | facts about a GraphQL operation          |

Directives are lowered as data, a name and its arguments. The core does not
interpret them.

## The `resilience` feature

On by default. It adds an async `LoweringPort` and `ResilientLoweringPort`,
which applies a cooperative timeout through the `ninelives` crate. The timeout
observes async cancellation points; it cannot interrupt synchronous parsing
already under way.

With `default-features = false` the crate compiles without `tokio`, `tower`,
`ninelives`, or `async-trait`.

Wesley is pre-1.0. APIs may change between releases; pin an exact version.
Apache-2.0.
