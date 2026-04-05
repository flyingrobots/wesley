# Continuum Local Compile And Inspect Surface

- Lane: `up-next`
- Legend: `RUNTIME`

## Why now

If Wesley is the contract compiler for Continuum, the local-first operator
surface needs to make that role boringly inspectable. Today the repo has pieces
of a compile path, but not yet one calm workflow that emits and summarizes the
shared contract bundle as a local artifact family.

## Hill

A maintainer can run one local Wesley workflow for the Continuum contract
family, inspect the generated bundle, and understand what was emitted without
depending on downstream repos or ambient network state.

## Done looks like

- one documented local compile path produces the shared contract bundle
- the output tree is predictable and reviewable
- the operator gets a short inspection summary, not just a pile of files
- the workflow stays local-first and deterministic
- failure messages point at the schema or generated contract surface clearly

## Repo Evidence

- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/test/compile-ttd.bats`
- `docs/method/guide.md`
- `docs/invariants/local-first-operation.md`

## Related Carry-Over

- `#176`
- `#366`
