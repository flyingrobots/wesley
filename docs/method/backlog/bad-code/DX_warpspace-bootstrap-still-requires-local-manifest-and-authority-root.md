# WARPspace Bootstrap Still Requires Local Manifest And Authority Root

- Lane: `bad-code`
- Legend: `DX`

## Why now

The first `warpspace init` prototype in `@wesley/host-node` is real enough to
materialize a host repo from a Continuum stack release manifest and run the
first generation pass.

But it still depends on explicit local-development inputs:

- `--manifest <continuum-stack-release.json>`
- `--authority-root <continuum-root>`

That is acceptable for proving the bootstrap seam.
It is not yet the boring consumer story described in Continuum.

## Hill

A maintainer can point `warpspace init` at a released stack profile without
also hand-supplying local authored-home paths, and the command can still
materialize the right shared family and lock the exact stack tuple into the
host repo.

## Done looks like

- `warpspace init --profile demo` can resolve a released Continuum stack
  manifest without an explicit local filesystem path
- the bootstrap flow no longer requires `--authority-root` for the standard
  release path
- local sibling overrides remain possible, but they are clearly override mode
- host-side dependency installation is either performed directly or surfaced as
  an explicit bootstrap step instead of being left implicit

## Repo Evidence

- `packages/wesley-host-node/bin/warpspace.mjs`
- `packages/wesley-host-node/src/warpspace-program.mjs`
- `packages/wesley-host-node/src/warpspace/init.mjs`
- `packages/wesley-host-node/test/warpspace-init.test.mjs`
