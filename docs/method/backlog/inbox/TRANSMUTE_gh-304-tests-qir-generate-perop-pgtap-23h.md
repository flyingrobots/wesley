# GH-304 tests(qir): generate per‑op pgTAP (2–3h)

- Imported from: GitHub issue
- Issue: #304
- URL: https://github.com/flyingrobots/wesley/issues/304
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
Generated ops come with matching per-op pgTAP assertions, so the test proof evolves with the emitted SQL instead of depending on hand-kept snapshots.

## Sponsor Actor
- Maintainer evolving op emitters
- Reviewer who needs generated ops to carry executable proof

## Playback
A maintainer generates ops and sees per-op pgTAP assertions emitted alongside the SQL artifacts, then runs them through the supported harness.

## Problem
The repo has example pgTAP snapshots for a few ops, but not a supported per-op generation path that keeps test proof coupled to emitted operations.

## Proposed Change
- generate minimal per-op pgTAP assertions alongside compiled ops
- cover parameter order, predicate smoke, and basic shape keys where applicable
- integrate the output with the ops pgTAP harness/CI lane

## Invariants
- generated tests stay deterministic
- test generation follows emitted op structure instead of separate hand-maintained fixtures
- failures point back to specific emitted ops clearly

## Non-Goals
- exhaustive semantic validation of every op form in one slice
- replacing lower-level QIR unit tests
- conflating generated smoke tests with full application correctness

## Acceptance / Tests
- tests are emitted alongside ops artifacts
- CI or the supported harness runs the emitted tests
- failures identify the specific op under test clearly
