# OWN: Fix Legacy JS Extension Ignorance

- Lane: `asap`
- Legend: `OWN`

## Why

During the Rust Core migration (Phase 2), it was discovered that the legacy Node.js `GraphQLAdapter` completely ignores `extend type` blocks in `buildIRFromAST`. It only iterates over base `OBJECT_TYPE_DEFINITION` nodes. This forces external pre-processing (like manual folding) and creates a "Semantic Gap" between what GraphQL supports and what the Wesley JS compiler sees.

## Done looks like

- `packages/wesley-runtime-node/src/GraphQLAdapter.mjs` is updated to support `ObjectTypeExtension`.
- It performs semantic consolidation (merging extensions into base types) during IR construction, matching the new Rust Core behavior.
- Manual folding logic in `scripts/generate-ir-fixtures.mjs` can be removed.

## Repo Evidence

- `packages/wesley-runtime-node/src/GraphQLAdapter.mjs:122`
- `scripts/generate-ir-fixtures.mjs:30` (Workaround implementation)
