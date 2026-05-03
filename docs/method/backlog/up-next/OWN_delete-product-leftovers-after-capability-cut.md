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
- `packages/wesley-generator-ttd/`

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
