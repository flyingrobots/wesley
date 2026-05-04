---
title: Continuum Receipt Family Artifact Path
lane: v0.1.0
legend: TRANSMUTE
release: v0.1.0
---

# Continuum Receipt Family Artifact Path

- Lane: `up-next`
- Legend: `TRANSMUTE`

## Why now

The Continuum direction should cash out to one boring artifact family, not just
platform prose. After ownership, local inspectability, and witness surfaces
are calmer, the next load-bearing move is to drive one shared envelope family
through the stack end to end.

## Hill

Wesley can compile one frozen receipt-oriented Continuum family:
`Receipt`, `DeliveryObservation`, and `Capability`, with a separate `Witness`
surface, into a predictable generated bundle from one schema entry point.

## Done looks like

- the first artifact family is chosen and named explicitly as `Receipt`,
  `DeliveryObservation`, `Capability`, with `Witness` kept separate
- the authored home is fixed to one schema path
- one Wesley compile path emits Rust and TypeScript types plus codec contracts
- manifest / registry ids and conformance fixtures travel with the same family
- the output bundle is deterministic enough to diff and review cleanly
- there is no handwritten parallel contract for the chosen family

## Frozen authored home

When this item becomes the active design packet, the target authored home is:

- `<continuum-root>/schemas/continuum-receipt-family.graphql`

## Repo Evidence

- `warp-ttd` owns `schemas/warp-ttd-protocol.graphql`
- `echo` owns current runtime schema fragments and tracks old Wesley Echo SDL
  reconciliation in its backlog
- `continuum` owns `schemas/continuum-receipt-family.graphql`
- relocated Continuum-owned TTD compiler evidence at
  `continuum/wesley/ttd/codegen/orchestrator.mjs`
- historical Wesley-local `packages/wesley-generator-ttd/` and
  `packages/wesley-cli/src/commands/compile-ttd.mjs` surfaces were removed
  during the domain-empty extraction

## Related Carry-Over

- `#453`
- `#365`
- `#366`
