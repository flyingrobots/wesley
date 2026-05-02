# External Continuum lane identity family boundary

- Lane: `inbox`
- Legend: `EXTERNAL`
- Rank: `1`

## Ownership note

This is Continuum product-family work, not Wesley core work. It belongs in
Continuum or a Continuum-owned Wesley module repo once Wesley's generic module
capability registry can host the needed target behavior.

## Why now

The Continuum ownership map and lane packets now say more clearly:

- `Lane` is the deeper base kind
- `Worldline` and `Strand` are lane forms with different admission/governance
- `Braid` is a compositional object over lanes, not just another lane

The external Continuum module should freeze how much of that identity story
belongs in shared authored families versus host-local runtime truth. Right now
the risk is that hosts and debugger surfaces each publish their own slightly
different lane noun stack.

## Hill

The Continuum-owned module records the family boundary for shared lane identity
nouns and leaves the right runtime-specific detail to hosts without letting the
public contract drift or flatten the ontology.

## Done looks like

- one packet states which lane nouns are contract-worthy now
- the packet names what belongs in a shared authored family versus host-local
  elaboration
- the cut explains how `warp-ttd` protocol ownership and receipt-family
  ownership relate
- downstream generators can emit stable lane identity surfaces without
  pretending every host has identical runtime structure

## Repo Evidence

- `schemas/ttd-protocol.graphql`
- `schemas/continuum-receipt-family.graphql`
- `docs/architecture/continuum-wesley-role.md`
- `docs/architecture/continuum-minimum-shared-contract-surface.md`
- Continuum `0001`, `0002`, and `0014`
