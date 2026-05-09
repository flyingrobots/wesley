# RUNTIME v2 transform runtime and ledger cutover

Legacy `ROADMAP.md` still described the major runtime cutover from imperative
CLI orchestration toward one `transform`-centered, ledger-backed run model.

Done when:
- `transform` is the canonical orchestration path
- run-oriented commands share one durable run model
- replay and resume semantics are explicit and bounded
- snapshots are projection/cache surfaces rather than independent truth
