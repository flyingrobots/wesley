# Continuum Local Compile And Inspect Surface

- Lane: `asap`
- Legend: `RUNTIME`

## Why now

Wesley's role is now written down, but the operator surface is still split
between TTD compile outputs and Echo generator evidence. The next load-bearing
move is one calm local workflow that emits the current shared contract bundle
and tells the maintainer what they are looking at.

## Hill

A maintainer can run one local Wesley workflow for the current Continuum stack,
inspect the TTD manifest / TypeScript bundle and the Echo IR / codec bundle,
and understand what was emitted without depending on downstream repos or
ambient network state.

## Done looks like

- one documented local compile path produces the current shared contract bundle
- emitted TTD manifest / registry outputs and Echo IR / codec outputs are
  summarized in one inspect surface
- the output tree is predictable and reviewable
- the operator gets a short inspection summary, not just a pile of files
- the workflow stays local-first and deterministic
- failure messages point at the schema or generated contract surface clearly

## Repo Evidence

- `docs/architecture/continuum-wesley-role.md`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/test/compile-ttd.bats`
- `packages/wesley-generator-echo/README.md`
- `packages/wesley-generator-echo/test/core-types.test.mjs`
- `docs/method/guide.md`
- `docs/invariants/local-first-operation.md`

## Related Carry-Over

- `#176`
- `#366`
