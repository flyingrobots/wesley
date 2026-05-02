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

## Repo Evidence

- `docs/design/wesley-extraction-map.md`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/commands/verify-realization.mjs`
- `packages/wesley-cli/src/commands/realization-integrity.mjs`
- `packages/wesley-cli/src/utils/warpspace.mjs`
- `packages/wesley-generator-echo/`
- `packages/wesley-generator-ttd/`
