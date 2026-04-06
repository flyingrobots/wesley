# Broad Zero-Downtime Safety Envelope

- Lane: `inbox`
- Legend: `EVIDENCE`

## Why now

The old README promised zero-downtime behavior and automatic safety properties
in strong public language before the repo had one broad, explicit proof
surface. The roadmap and current docs still show substantial future work around
safe change semantics, rehearsal depth, and durable proof.

That overclaim should not make the underlying goal disappear. Wesley should
still aim to earn a broad, explicit safe-change envelope.

## Hill

Wesley can say exactly which zero-downtime or change-safety claims are proved
today, which are still target state, and how the repo intends to widen the safe
envelope over time.

## Done looks like

- one public safety matrix exists for the current database-change lane
- the matrix distinguishes shipped proof from desired future guarantees
- the matrix is backed by executable tests, witness flows, or rehearsals rather
  than pure prose
- front-door docs stop implying universal zero-downtime safety where the proof
  is still partial, while still naming the broader goal as something Wesley is
  trying to earn

## Repo Evidence

- old `README.md` at commit `6672939`
- `ROADMAP.md`
- `docs/guides/quick-start.md`
- `docs/blade.md`
- `test/fixtures/blade/README.md`
- `packages/wesley-cli/test/plan*.bats`
- `packages/wesley-cli/test/rehearse*.bats`
