# Continuum Contract Bundle Atlas

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

The current Continuum work is making Wesley's role and compile paths more
honest, but the inspect surface is still mostly file-tree shaped. A maintainer
can find the emitted manifest, IR, registry, and codec artifacts, yet the
relationship between authored schema, generated outputs, witness surfaces, and
neighbor consumers still has to be mentally reassembled.

## Hill

A maintainer can open one local-first "atlas" view for a Continuum contract
bundle and see authored homes, generated artifacts, schema hashes, nearby
consumers, and witness surfaces in one place without browsing half the repo.

## Done looks like

- one local surface renders the current Continuum bundle as a small map instead
  of a pile of paths
- authored homes, derived outputs, and non-authoritative mirrors are visibly
  separated
- schema hash, registry identity, and artifact-family summaries are shown
  together
- the atlas can point at both TTD manifest outputs and Echo IR / codec outputs
- the surface stays local-first and useful even when cross-repo consumers are
  only named, not fetched live

## Repo Evidence

- `docs/architecture/continuum-wesley-role.md`
- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-generator-echo/README.md`
- `docs/invariants/local-first-operation.md`

## Related Carry-Over

- `#365`
- `#366`

