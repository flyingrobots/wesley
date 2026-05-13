# Preflight Latency Instrumentation

- Lane: `bad-code`
- Legend: `DX`

## Why now

`pnpm run preflight` is the right repo health gate, but it is too opaque when it
feels slow. The command prints check results, not enough timing or phase
information to answer the basic operator question: which check is taking the
time, and is that time expected?

This makes normal agent and human work feel stalled. It also makes it too easy
to accept latency creep because there is no visible budget, no per-check timing
history, and no clear split between cheap local checks and heavier release-gate
checks.

## Hill

Preflight reports per-check latency, explains the slowest phases, and has an
explicit local latency budget so slowdowns become visible debt instead of
ambient frustration.

## Done looks like

- `pnpm run preflight` prints each check name before it starts
- each check reports elapsed time in the final summary
- the summary highlights the slowest three checks
- the command distinguishes cheap local checks from heavier full-gate checks
- a documented latency budget exists for ordinary local preflight
- CI or a fixture test protects the timing-report shape
- slow checks have follow-on backlog items or documented justification

## Repo Evidence

- `scripts/preflight.mjs`
- `package.json`
- `docs/method/backlog/bad-code/RUNTIME_preflight-check-registry.md`
