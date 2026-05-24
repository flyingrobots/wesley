# TypeScript Emitter Legacy Parity

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

`wesley emit typescript` now emits basic TypeScript declarations from Wesley L1
IR through a Rust AST/printer projection. That is the right architectural path,
but it is not yet full parity with the historical JavaScript TypeScript
generator.

## Hill

The Rust TypeScript emitter covers the useful generic TypeScript projection
surface well enough that the legacy Node `typescript` command can be retired or
reduced to a compatibility note.

## Done looks like

- output contract is documented with examples
- object, interface, input object, enum, union, scalar, list, and nullability
  behavior are covered by golden tests
- known legacy-only generator features are either ported, explicitly rejected,
  or moved to an external projection owner
- `docs/LEGACY_NODE_MIGRATION.md` marks `typescript` as ported or extracted

## Repo Evidence

- `crates/wesley-emit-typescript/src/lib.rs`
- `crates/wesley-cli/src/main.rs`
- `packages/wesley-cli/src/commands/typescript.mjs`
- `packages/wesley-cli/src/utils/table-projections.mjs`
- `docs/LEGACY_NODE_MIGRATION.md`
