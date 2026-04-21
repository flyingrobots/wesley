# Delete remaining Continuum leftovers after capability cut

- Lane: `up-next`
- Legend: `OWN`
- Rank: `2`

## Why now

The first Continuum extraction happened, but not the whole one.

What moved out already:

- Continuum CLI/profile ownership
- Continuum module home in the Continuum repo

What is still lingering in Wesley:

- Continuum-shaped compile helpers
- realization verification helpers
- `warpspace` utilities and bootstrap residue
- Continuum generators that still live in the wrong repo

Those leftovers should not be ripped out blindly before the module capability
runtime and module-driven compile path exist. But once those exist, the old
bootstrap residue should stop lingering.

## Hill

Wesley no longer carries Continuum-specific execution residue after the module
capability runtime and module-driven compile target discovery are in place.

## Done looks like

- the remaining Continuum-specific compile/realization helpers have a real home
  in `continuum`
- Wesley no longer carries the old `warpspace` bootstrap residue
- stale docs and internal imports that still imply Wesley-owned Continuum
  behavior are removed
- the extraction map can mark the Continuum leftovers as complete rather than
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

