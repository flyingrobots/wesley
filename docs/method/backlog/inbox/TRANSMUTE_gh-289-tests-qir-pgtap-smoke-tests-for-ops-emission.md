# GH-289 tests(qir): pgTAP smoke tests for ops emission

- Imported from: GitHub issue
- Issue: #289
- URL: https://github.com/flyingrobots/wesley/issues/289
- Imported on: 2026-04-04
- GitHub updated: 2026-03-25T00:38:57Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `tests`, `group:qir-phase-c`, `work:integrity`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

## Work Type
`integrity`

## Hill Supported
The ops pipeline has executable PostgreSQL test proof instead of only generated SQL artifacts and hand-maintained fixture snapshots.

## Sponsor Actor
- Maintainer validating emitted ops behavior
- Reviewer deciding whether generated ops are trustworthy

## Playback
A maintainer generates ops for the example fixture and runs a supported pgTAP smoke lane that validates the emitted operations against a real PostgreSQL fixture.

## Problem
The repo already carries example pgTAP snapshots for ops, but the ops pipeline is not yet a fully supported generated-and-executed pgTAP path. That leaves ops testing more manual and less trustworthy than the rest of the evidence model.

## Proposed Change
- make ops pgTAP smoke tests a supported pipeline path
- connect generated ops artifacts to a real pgTAP execution lane
- surface the results clearly enough for future evidence/scoring consumption

## Invariants
- ops test proof runs against real PostgreSQL behavior
- generated fixtures and executed tests stay deterministic
- the pipeline does not pretend static snapshots are the same as executed proof

## Non-Goals
- full semantic proof of every possible op shape in one slice
- replacing lower-level unit tests
- inventing Holmes scoring changes before the test lane exists

## Acceptance / Tests
- the example ops pipeline runs pgTAP against emitted operations
- failures are explicit and machine-readable enough for later evidence use
- docs explain the supported ops pgTAP path
- the smoke lane is runnable in CI or a documented gated lane
