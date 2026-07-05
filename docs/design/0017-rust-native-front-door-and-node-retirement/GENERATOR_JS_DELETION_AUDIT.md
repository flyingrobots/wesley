# Generator JS Deletion Audit

<!-- docs-truth: status=active owner=@flyingrobots -->

This audit closes NR-080 in the Node retirement checklist.

## Decision

`packages/wesley-generator-js/` is deleted.

Generic TypeScript output is no longer a Node package responsibility. Retained
generic TypeScript output belongs in `crates/wesley-emit-typescript/` and the
native `wesley emit typescript` command. Product-specific and target-specific
generators should live in their owning modules or repos.

## Compatibility Bridge Closed

During the migration, narrow Node CLI `typescript` and `zod` compatibility
commands remained local to `packages/wesley-cli/` after
`packages/wesley-generator-js/` was deleted. That bridge is now closed:
`packages/wesley-cli/` has also been deleted, generic TypeScript output lives in
`crates/wesley-emit-typescript/`, and Zod output is not retained as generic
Wesley product surface.

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
- The GH-159 work item was closed because wiring host shims for the deleted
  package is now the wrong direction.

## Remaining Risk

No JavaScript generator package or Node CLI projection bridge remains as
compiler authority. Future TypeScript projection work belongs in
`crates/wesley-emit-typescript/`; future Zod output needs an external target
owner before returning to the repo.
