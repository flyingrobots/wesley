# Continuum Realization Manifest

- Lane: `up-next`
- Legend: `TRANSMUTE`
- Rank: `1`

## Why now

`wesley compile-ttd`, `wesley bundle-echo`, and `wesley witness-continuum`
already behave like they are walking one authored contract family through
multiple generated legs. The current repo truth for those legs still lives in
command code, output-path lists, and packet prose.

If Wesley is going to cash out "multiple interpretations of one declared
contract" instead of sounding like it runs adjacent generators, it needs one
emitted realization manifest that names each generated leg explicitly.

## Hill

For one admitted Continuum contract family, Wesley emits a realization manifest
that maps the authored schema to each generated leg, its authority status, its
intended consumers, and its current witness obligations.

## Done looks like

- one manifest names family id, authored home, schema hash, and canonical
  compile path
- each generated leg records its kind, at least across `manifest`,
  `typescript`, `ir`, `codec`, `inspect`, `mock`, and `compat` surfaces
- each leg records authority status such as `generated`, `mirror`, `mock`, or
  `compat-only`
- each leg records likely consumers and whether it participates in the current
  witness lane
- `witness-continuum` can read the realization manifest instead of hard-coding
  the current file tree forever
- the shape works first for the current TTD-plus-Echo minimum surface and then
  for the frozen receipt family

## Repo Evidence

- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-cli/src/commands/witness-continuum.mjs`
- `docs/architecture/continuum-wesley-role.md`
- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`
- `docs/build-artifacts.md`

## Related Carry-Over

- `#365`
- `#366`
- `#453`
