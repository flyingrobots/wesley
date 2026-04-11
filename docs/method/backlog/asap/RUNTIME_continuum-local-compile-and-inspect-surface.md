# Continuum Local Compile And Inspect Surface

- Lane: `asap`
- Legend: `RUNTIME`

## Why now

Wesley's role is now written down, but the operator surface is still split
between TTD compile outputs and Echo generator evidence. The next load-bearing
move is one calm local workflow that emits the current shared contract bundle
and tells the maintainer what they are looking at.

The repo now has the first Echo-side wrapper step through
`wesley bundle-echo`, which writes bundle artifacts and a mocked
`warp-ttd`-style `deliveries` inspect surface. The repo also now has a first
current-state witness through `wesley witness-continuum`. The remaining work is
to cash those steps out into the full chosen-family path rather than just the
current minimum surface.

## Hill

A maintainer can run one local Wesley workflow for the current Continuum stack,
inspect the TTD manifest / TypeScript bundle and the Echo IR / codec bundle,
and understand what was emitted without depending on downstream repos or
ambient network state.

## Done looks like

- one documented local command chain produces the current shared contract bundle
- emitted TTD manifest / registry outputs and Echo IR / codec outputs are
  summarized in one inspect surface
- the output tree is predictable and reviewable
- the operator gets a short inspection summary, not just a pile of files
- the workflow stays local-first and deterministic
- failure messages point at the schema or generated contract surface clearly
- the happy path is one screen long and does not require repo folklore

## Canonical operator chain

The packet should cash out to a literal boring path:

1. find the canonical schema for the chosen family
2. run one TTD compile command
3. run one Echo bundle command for the same schema
4. inspect one short artifact summary
5. run `wesley witness-continuum`
6. read one proof result

## Repo Evidence

- `docs/architecture/continuum-wesley-role.md`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/commands/witness-continuum.mjs`
- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-cli/test/bundle-echo.bats`
- `packages/wesley-cli/test/witness-continuum.bats`
- `packages/wesley-generator-echo/README.md`
- `packages/wesley-generator-echo/test/core-types.test.mjs`
- `docs/method/guide.md`
- `docs/invariants/local-first-operation.md`

## Related Carry-Over

- `#176`
- `#366`
