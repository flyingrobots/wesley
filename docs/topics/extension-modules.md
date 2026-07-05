# Extension Modules

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when deciding how to extend Wesley without making core
domain-aware.

Wesley provides generic compiler facts. Extension modules and sibling repos
assign those facts target-specific meaning.

## Decision Table

| Goal                                    | Home                                     |
| --------------------------------------- | ---------------------------------------- |
| New GraphQL lowering or generic IR fact | `crates/wesley-core`                     |
| New user-facing command over Rust facts | `crates/wesley-cli`                      |
| Generic Rust projection                 | `crates/wesley-emit-rust`                |
| Generic TypeScript projection           | `crates/wesley-emit-typescript`          |
| Domain target behavior                  | External module, crate, package, or repo |
| Descriptor-only fixture coverage        | `test/fixtures/extensions/`              |
| Release or repository automation        | `xtask`                                  |

## Descriptor Fixtures

Descriptor-only fixtures are plain data examples for boundary tests. They may
describe capability metadata, but they must not execute code or make Wesley own
a domain.

Use descriptor fixtures when Wesley needs hermetic coverage for extension shape
without shipping the extension itself.

## Rules Of Thumb

- Do not rebuild the retired dynamic JavaScript module loader in core.
- Do not add Postgres, Echo, Continuum, Geordi, Edict, renderer, or runtime
  meaning to Wesley core.
- Use project manifest targets as metadata; target behavior lives elsewhere.
- Add an explicit Rust-native registry, WASM boundary, or external-process
  protocol before executable target loading becomes a Wesley feature.
- Use the [External Target Protocol](../reference/external-target-protocol.md)
  for the current MVP specification of that external-process boundary.

## Related Authority

- [Module Authoring Guide](../guides/module-authoring.md)
- [Extending Wesley](../guides/extending.md)
- [External Target Protocol](../reference/external-target-protocol.md)
- [Project Manifests](./project-manifests.md)
- [Compiler Boundary](./compiler-boundary.md)
