# Generator JS Deletion Audit

<!-- docs-truth: status=active owner=@flyingrobots -->

This audit closes NR-080 in the Node retirement checklist.

## Decision

`packages/wesley-generator-js/` is deleted.

Generic TypeScript output is no longer a Node package responsibility. Retained
generic TypeScript output belongs in `crates/wesley-emit-typescript/` and the
native `wesley emit typescript` command. Product-specific and target-specific
generators should live in their owning modules or repos.

## Compatibility Kept

The legacy Node CLI still exposes narrow `typescript` and `zod` commands because
they are part of the compatibility bridge while `packages/wesley-cli/` remains.
Those commands no longer depend on `@wesley/generator-js`.

The remaining table-shaped compatibility behavior lives in:

- `packages/wesley-cli/src/utils/table-projections.mjs`
- `packages/wesley-cli/src/commands/typescript.mjs`
- `packages/wesley-cli/src/commands/zod.mjs`

The code is intentionally CLI-local. It is not a new generator package and is
not a product projection authority.

## Compatibility Removed

The historical `models` command is deleted. Model-class scaffolding was not a
compiler-truth surface and had no retained generic Wesley owner.

The Node host no longer exposes built-in generator shims. Generator behavior now
comes from explicit module capabilities, Rust-native emitters, or external
target owners.

## Files Removed

- `.github/workflows/pkg-generator-js.yml`
- `packages/wesley-generator-js/`
- `test/packages/wesley-generator-js/`
- `test/cli-models.bats`
- `test/packages/README.md`

## Bookkeeping Updated

- `docs/BEARING.md` marks NR-080 complete.
- `docs/LEGACY_NODE_MIGRATION.md` records the package deletion.
- `NODE_RETIREMENT_LEDGER.md`, `LEGACY_COMPATIBILITY_MATRIX.md`, and
  `node-retirement-ledger.json` remove `packages/wesley-generator-js/` from the
  live package inventory.
- The GH-159 backlog item was archived because wiring host shims for the deleted
  package is now the wrong direction.

## Remaining Risk

The legacy Node CLI still carries compatibility projection code. That is part
of the larger `packages/wesley-cli/` deletion gate, not a reason to keep a
standalone JavaScript generator package alive.
