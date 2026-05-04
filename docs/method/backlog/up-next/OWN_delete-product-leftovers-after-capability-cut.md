# Delete remaining product leftovers after capability cut

- Lane: `up-next`
- Legend: `OWN`
- Rank: `2`

## Why now

The first product-module extraction happened, but not the whole one.

What moved out already:

- product CLI/profile ownership
- product module home in the owning repo

What is still lingering in Wesley:

- product-shaped compile helpers
- realization verification helpers
- product workspace utilities and bootstrap residue
- product generators that still live in the wrong repo

Those leftovers should not be ripped out blindly before the module capability
runtime and module-driven compile path exist. But once those exist, the old
bootstrap residue should stop lingering.

## Hill

Wesley no longer carries product-specific execution residue after the module
capability runtime and module-driven compile target discovery are in place.

## Done looks like

- the remaining product-specific compile/realization helpers have a real home
  in the owning product repo
- Wesley no longer carries old product workspace bootstrap residue
- stale docs and internal imports that still imply Wesley-owned product
  behavior are removed
- the extraction map can mark the product leftovers as complete rather than
  still-active debt

## Current Slice Status

Inventory is now explicit in
`docs/design/wesley-extraction-map.md#post-capability-cut-inventory`.

Product/database code deletion has started after the inventory slice. The
inventory classifies each remaining surface as:

- `delete`
- `relocate`
- `defer`

There is no product legacy-support requirement. Each implementation slice should
pick one classified row and either remove it from Wesley or prove that its
external home already owns it.

## Repo Evidence

Seed evidence for this card is below. The complete post-capability-cut
classification lives in the extraction map inventory linked above.

- `docs/design/wesley-extraction-map.md`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/utils/warpspace.mjs`
- `packages/wesley-generator-echo/`

Deleted in the first cleanup slice:

- generic `compile` compatibility descriptors for `warp-ttd` and `echo`
- `packages/wesley-cli/src/commands/verify-realization.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- root `verify:realization`
- stale Continuum witness and realization Bats coverage
- stale module-owned command skip-list entries for missing product commands

Deleted in the doctor cleanup slice:

- unused hard-coded `@wesley/generator-echo`, `@wesley/generator-ttd`, and
  `@wesley/generator-supabase` well-known generator list in
  `packages/wesley-cli/src/commands/doctor-checks.mjs`

Deleted in the WARPspace bootstrap cleanup slice:

- `packages/wesley-host-node/bin/warpspace.mjs`
- `packages/wesley-host-node/src/warpspace-program.mjs`
- `packages/wesley-host-node/src/warpspace/init.mjs`
- `packages/wesley-host-node/test/warpspace-init.test.mjs`
- host-node `bin.warpspace`
- obsolete WARPspace bootstrap bad-code backlog notes

Deleted in the WARPspace output lookup cleanup slice:

- `packages/wesley-cli/src/utils/warpspace.mjs`
- `packages/wesley-cli/test/warpspace.test.mjs`
- `packages/wesley-cli/test/warpspace.bats`
- `--warpspace` options from `compile-ttd`, `bundle-echo`, `typescript`, and
  `zod`
- WARPspace-backed default file/root resolution from generic CLI commands
- `smol-toml` dependency from `@wesley/cli`

Deleted in the TTD generator package cleanup slice:

- empty `packages/wesley-generator-ttd/` package shell
- package-local TTD Vitest suite that only exercised `@wesley/core/ttd`
- package README and metadata advertising a non-existent `src/index.mjs`
- preserved the remaining CLI `compile-ttd` fixture under
  `packages/wesley-cli/test/fixtures/basic-ttd-protocol.graphql`

Deleted in the TTD generated metadata cleanup slice:

- generated `schema.json`, `ttd-ir.json`, and TypeScript headers no longer
  claim the deleted `@wesley/generator-ttd` package produced them
- `compile-ttd` coverage now asserts the current legacy metadata surface is
  `@wesley/core/ttd`

Resolved in the Echo lint-hook cleanup slice:

- fixed indentation-only ESLint failures in `packages/wesley-generator-echo/src/emitRewriteApi.mjs`
  and `packages/wesley-generator-echo/src/index.mjs`
- removed the tracked bad-code note after the exact blocker lint command passed

Resolved in the Echo golden fixture cleanup slice:

- updated `packages/wesley-generator-echo/test/fixtures/basic-v2.ir.json` and
  `packages/wesley-generator-echo/test/fixtures/joins-v2.ir.json` to include
  explicit `footprint: null` on operations without footprint directives
- removed the tracked bad-code note after the full Echo package test passed

Deleted in the TTD/Echo public CLI command cleanup slice:

- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-cli/test/bundle-echo.bats`
- root `test/cli-composition.bats` cases that invoked `compile-ttd`
- command-only `packages/wesley-cli/test/fixtures/basic-ttd-protocol.graphql`
- `packages/wesley-cli/src/commands/index.mjs` exports for the removed
  commands

The matching extraction-map rows now mark TTD/Echo public CLI commands and
legacy Continuum Bats coverage as done.

Deleted in the CLI Echo dependency cleanup slice:

- `packages/wesley-cli/package.json` no longer declares
  `@wesley/generator-echo`
- `pnpm-lock.yaml` no longer links `@wesley/generator-echo` into the
  `packages/wesley-cli` importer

Deleted in the Echo generator package cleanup slice:

- `packages/wesley-generator-echo/`
- `@wesley/generator-echo` progress metadata
- the package-local Echo IR, codec, golden vector, and plugin adapter tests
- the now-superseded bad-code note for the package's host-node dependency audit

The matching extraction-map row now marks Continuum generator packages as done.
Any future Echo or TTD generator belongs in a Continuum-owned module/repo.
