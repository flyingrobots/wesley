# Holmes Artifact Diagnostic Sidecar

- Lane: `cool-ideas`
- Legend: `EVIDENCE`

## Why now

The Holmes comment loader now preserves report and markdown parse/read
diagnostics, but the human PR comment intentionally stays calm and high-signal.
That leaves a useful middle layer unclaimed: a maintainer-friendly diagnostic
surface that exposes malformed or unreadable artifact reasons without dumping
debug noise into the reviewer-facing summary.

## Hill

A maintainer can open one Holmes-side diagnostic artifact or workflow summary
surface and see exactly why a report artifact was missing, invalid, or
unreadable, while the public PR comment remains concise and glossary-backed.

## Done looks like

- Holmes artifact loader diagnostics are emitted to one inspectable sidecar
  surface during comment/report generation
- the public PR comment stays human-friendly and does not leak raw parser noise
- workflow operators can tell the difference between malformed JSON, unreadable
  markdown, and simply missing artifacts without reproducing locally
- tests pin the diagnostic sidecar contract
- the diagnostic surface remains reproducible from local artifact inputs

## Repo Evidence

- `packages/wesley-holmes/src/pr-comment.mjs`
- `packages/wesley-holmes/test/pr-comment.test.mjs`
- `.github/workflows/wesley-holmes.yml`
- `docs/architecture/holmes-architecture.md`
- `docs/invariants/evidence-truth.md`

## Related Carry-Over

- `#224`
- `#451`
- `#466`
