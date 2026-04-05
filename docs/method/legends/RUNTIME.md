# RUNTIME

## Scope

`RUNTIME` covers Wesley's execution lifecycle: orchestration seams, run model,
hosts and runtime adapters, replay/resume behavior, local inspection, and
operator-facing command surfaces for transform/plan/rehearse/certify/replay.

## Guards

- `ledger-truth`
- `local-first-operation`
- `governance-boundaries`
- `docs-runtime-honesty`

## Standing playback questions

- Can an operator inspect, replay, rehearse, or resume without hidden writes or
  shelling out through the wrong seam?
- Do the lifecycle and host surfaces explain runtime state honestly enough for a
  human and an agent to act on it?
