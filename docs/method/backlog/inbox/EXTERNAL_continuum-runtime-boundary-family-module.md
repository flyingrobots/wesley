# External Continuum runtime-boundary family module

- Lane: `inbox`
- Legend: `EXTERNAL`

## Capture

Continuum still needs a compiler lane for its runtime-boundary family, but that
work does not belong in the Wesley repo.

The relevant family currently names seven top-level contract nouns:

- `IntentEnvelope`
- `TickResult`
- `ObserverPlan`
- `ObservationRequest`
- `ReadingEnvelope`
- `SuffixShell`
- `ImportOutcome`

## Correct home

This should be pulled in Continuum itself or a Continuum-owned Wesley module
repo. Wesley should supply only the generic module capability contract, target
dispatch, compiler plumbing, artifact bookkeeping, and assurance extension
points needed by that external module.

## Why this moved out of ASAP

The previous Wesley ASAP item treated this as a Wesley compiler lane. That is
now the wrong ownership model. Product runtime-boundary families are external
module work, not core Wesley work.

## Carry-forward constraints

- do not create a Wesley-local authored home for the family
- do not add product targets to `wesley compile`
- do not put observer state semantics in generic Wesley
- use module capabilities once the registry runtime exists
