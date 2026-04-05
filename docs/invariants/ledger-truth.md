# ledger-truth

## Invariant statement

Where Wesley has a run model, the append-only ledger record outranks snapshots,
cache state, and materialized artifacts. Those surfaces may summarize or
project runtime truth, but they must not become competing authorities.

## Preserved when

- replay performs zero writes by default
- snapshots and materializations are treated as projections or cache
- inspect/status/report surfaces can identify the run record they are
  describing
- new runtime work moves commands toward one run model instead of inventing new
  side stores with equal authority

## Violated when

- snapshot files or output trees become normal migration truth
- replay, inspect, or report flows mutate runtime state implicitly
- command handlers bypass the run model and create new de facto sources of
  runtime truth without explicit projection semantics

## How to check

- inspect run-oriented command behavior and tests for replay-without-writes and
  projection-only snapshots
- verify ROADMAP and command docs still describe the ledger as runtime truth
- challenge any new state file that is not clearly a projection, cache, or
  append-only record
