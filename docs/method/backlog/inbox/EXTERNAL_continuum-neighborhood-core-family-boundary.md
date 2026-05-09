# External Continuum neighborhood-core family boundary

- Lane: `inbox`
- Legend: `EXTERNAL`
- Rank: `1`

## Ownership note

This is Continuum product-family work, not Wesley core work. It belongs in
Continuum or a Continuum-owned Wesley module repo once Wesley's generic module
capability registry can host the needed target behavior.

## Why now

Continuum now has a concrete authored neighborhood-core packet and needs its
own external Wesley module to treat it as the first generated
admission/publication family slice.

That slice freezes:

- `NeighborhoodCore`
- `NeighborhoodParticipant`
- shared `AdmissionOutcomeKind`
- shared singleton-vs-plural site truth
- shared neighborhood participant roles

It remains distinct from the adjacent families in the witness ladder:

- `NeighborhoodCore`
- `ReintegrationDetail`
- `ReceiptShell`

If the external Continuum module skips that cut, neighboring product surfaces
will keep rebuilding one giant receipt-shaped inspector blob from different
directions.

## Hill

The Continuum-owned module takes the authored neighborhood-core family and
compiles it as the first concrete admission/publication slice, while preserving
the boundary between local neighborhood truth, reintegration/seam detail, and
explanatory receipt shell.

## Done looks like

- the external Continuum module treats `continuum-neighborhood-core-family.graphql`
  as the concrete compiler target for this slice
- the boundary still explains what remains in:
  - reintegration detail
  - receipt shell
- `witness-continuum` can point to the right family surface instead of assuming
  one omnibus receipt payload
- `warp-ttd` and host adapters get a cleaner generated contract target

## Repo Evidence

- Continuum `0022`
- `schemas/continuum-neighborhood-core-family.graphql`
- `docs/invariants/realization-coherence.md`
- `docs/invariants/witness-scope-honesty.md`
- `docs/design/0003-continuum-contract-compiler/continuum-contract-compiler.md`
- Continuum `0016`
- Continuum `0020`
