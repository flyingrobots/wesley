# Wesley WARPspace bootstrap residue

- Lane: `bad-code`
- Legend: `OWN`

## Why now

Continuum already has the real home for `warp` under `continuum/apps/warp/`.
Wesley still carries an older WARPspace bootstrap residue under
`wesley-host-node`.

This is no longer just "legacy but harmless." It actively muddies ownership:

- a reader can still think Wesley owns the workspace bootstrap
- the old bootstrap path can look like a second authoritative home
- new work can accidentally keep landing in the wrong repo because the residue
  still exists

This is a different problem from the existing note about `warpspace init` still
requiring a local manifest and authority root. That note is about bootstrap UX.
This note is about wrong-repo ownership residue.

## Hill

Wesley stops carrying the old WARPspace bootstrap residue once the Continuum
home is the only real bootstrap path.

## Done looks like

- the lingering WARPspace bootstrap files in `wesley-host-node` are deleted or
  reduced to clearly transitional shims with a removal plan
- docs no longer imply Wesley owns the workspace bootstrap story
- new bootstrap work lands only in Continuum

## Repo Evidence

- `packages/wesley-host-node/src/warpspace-program.mjs`
- `packages/wesley-host-node/src/warpspace/init.mjs`
- `packages/wesley-host-node/bin/warpspace.mjs`
- `docs/design/wesley-extraction-map.md`

