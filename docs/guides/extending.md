# Extending Wesley

Wesley is now a Rust-first GraphQL compiler kernel with a native CLI. Extend it
by choosing the boundary that owns the meaning you are adding. The default is
not "add another generator to core"; the default is "keep the core semantic and
put domain behavior where that domain lives."

## Extension Decision Table

| Goal                                                             | Put It Here                       | Why                                                                                                                         |
| ---------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Parse or lower more domain-empty GraphQL semantics               | `crates/wesley-core`              | Core owns GraphQL syntax, L1 IR, schema diffs, operation catalogs, selection resolution, and directive argument extraction. |
| Add a native user command over existing Rust facts               | `crates/wesley-cli`               | The CLI is the Rust product front door and should stay a thin shell around library APIs.                                    |
| Emit generic Rust data models or operation bindings              | `crates/wesley-emit-rust`         | The projection is reusable and does not smuggle database, Echo, or product assumptions into core.                           |
| Emit generic TypeScript declarations or operation bindings       | `crates/wesley-emit-typescript`   | The projection is reusable and derived from L1 IR plus schema operation data.                                               |
| Add PostgreSQL, Echo, Continuum, jedit, or other domain behavior | External module or external crate | Domain targets own their policy, runtime semantics, witnesses, and release conventions.                                     |
| Add release or repository automation                             | `xtask`                           | `xtask` is the maintenance front door, not user-facing compiler behavior.                                                   |

## Rust Core Extensions

Core extensions should be pure data transformations. They should not read files,
write files, shell out, load user code, or assume a database or runtime.

Use this shape:

1. Add or adjust domain data in `crates/wesley-core/src/domain/`.
2. Add parser/lowering behavior in `crates/wesley-core/src/adapters/apollo.rs`.
3. Expose stable functions from `crates/wesley-core/src/lib.rs`.
4. Add tests under `crates/wesley-core/tests/`.
5. Keep fixtures domain-empty unless the fixture is explicitly testing generic
   directive preservation.

Good core APIs look like this:

```rust
pub fn lower_schema_sdl(schema_sdl: &str) -> Result<WesleyIR, WesleyError>;
pub fn diff_schema_sdl(old_sdl: &str, new_sdl: &str) -> Result<SchemaDelta, WesleyError>;
pub fn list_schema_operations_sdl(schema_sdl: &str) -> Result<Vec<SchemaOperation>, WesleyError>;
pub fn resolve_operation_selections(operation_sdl: &str) -> Result<Vec<String>, WesleyError>;
pub fn extract_operation_directive_args(
    operation_sdl: &str,
    directive_name: &str,
) -> Result<Vec<OperationDirectiveArgs>, WesleyError>;
```

Bad core APIs are APIs that decide what PostgreSQL tables mean, what Echo
footprints mean, where files should be written, or how a product runtime should
admit an operation. Those belong outside core.

## Native CLI Extensions

Add CLI behavior only after the underlying Rust library function exists. The CLI
should parse arguments, call the library, format output, and choose process exit
codes. It should not become a second implementation of compiler logic.

Use this shape:

1. Add the library function and tests first.
2. Wire the command in `crates/wesley-cli/src/main.rs`.
3. Add integration coverage in `crates/wesley-cli/tests/cli.rs`.
4. Update README and guide examples when command names or output contracts
   change.

For example, schema diffing belongs in `wesley-core` as `diff_schema_sdl`, while
`wesley schema diff --old old.graphql --new new.graphql --exit-code` is just the
native command wrapper.

## Emitter Extensions

The Rust and TypeScript emitters are AST/printer crates. They should consume
Wesley L1 IR and schema operation data, build structured in-memory declaration
models, and print those models. Do not add regex-based code generation or
string-splicing logic for semantic structure.

Use this shape:

1. Lower source GraphQL through `wesley-core`.
2. Convert L1 IR into an emitter-owned AST.
3. Print from the AST.
4. Add tests that assert both the semantic output and parser validity when a
   parser is available.

The current examples are:

- `crates/wesley-emit-rust`
- `crates/wesley-emit-typescript`

## External Module Extensions

Domain-specific targets should live outside the Wesley core repo unless there is
a deliberate temporary migration reason. Examples include Echo footprint
honesty, PostgreSQL migrations, Continuum family witnesses, jedit runtime
contracts, and agent policy apertures.

External modules may bring:

- target semantics
- generators
- policy checks
- witness scopes
- runtime admission guards
- release conventions

Wesley should provide the generic compiler facts those modules need. The module
should decide what those facts mean for its domain.

## Project Manifest And Descriptor Notes

Use the JSON/YAML project manifest for local schema and target metadata:

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": ["schema.graphql"],
  "targets": [
    {
      "name": "my-external-target",
      "module": "my.external.module",
      "default": true,
      "outputDir": "generated/my-target"
    }
  ]
}
```

Validate it with:

```bash
wesley config validate --json
```

Fixture modules should be descriptor-only JSON under
`test/fixtures/extensions/`. They may advertise capability metadata for tests
and docs, but they must not execute code or make Wesley core own target
semantics.

For the detailed current boundary, see
[Module Authoring Guide](./module-authoring.md) and
[Project Manifest](../reference/project-manifest.md). The historical
`wesley.config.mjs`, `WESLEY_MODULES`, `WESLEY_DISABLE_MODULES`, and
`WESLEY_MODULE_ALLOWLIST` path is retired from generic Wesley core.

## Validation Checklist

Before sending an extension:

- Run `cargo xtask preflight`.
- Run `cargo test --workspace --all-features` for Rust behavior.
- Run `cargo clippy --workspace --all-targets -- -D warnings` for Rust changes.
- Run `cargo xtask legacy-preflight` when changing legacy Node package surfaces.
- Update `CHANGELOG.md` when public behavior changes.

The core rule is simple: Wesley core compiles GraphQL into honest, domain-empty
facts. Extensions decide what those facts become.
