# Continuum Receipt Family Artifact Path

- Lane: `up-next`
- Legend: `TRANSMUTE`

## Why now

The Continuum direction should cash out to one boring artifact family, not just
platform prose. After ownership, local inspectability, and witness surfaces
are calmer, the next load-bearing move is to drive one shared envelope family
through the stack end to end.

## Hill

Wesley can compile one receipt-oriented Continuum family such as `Coordinate`,
`Receipt`, `EffectEmission`, `DeliveryObservation`, `Capability`, and related
registry / manifest nouns into a predictable generated bundle from one schema
entry point.

## Done looks like

- the first artifact family is chosen and named explicitly
- one Wesley compile path emits Rust and TypeScript types plus codec contracts
- manifest / registry ids and conformance fixtures travel with the same family
- the output bundle is deterministic enough to diff and review cleanly
- there is no handwritten parallel contract for the chosen family

## Repo Evidence

- `schemas/ttd-protocol.graphql`
- `schemas/echo-core-types.graphql`
- `packages/wesley-core/src/ttd/codegen/orchestrator.mjs`
- `packages/wesley-generator-ttd/`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`

## Related Carry-Over

- `#453`
- `#365`
- `#366`
