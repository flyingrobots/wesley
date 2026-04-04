# GH-88 feat(holmes): tag breakdown components with provenance

- Imported from: GitHub issue
- Issue: #88
- URL: https://github.com/flyingrobots/wesley/issues/88
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:33Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `pkg:wesley-core`, `pkg:wesley-holmes`, `group:holmes-scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Annotate each SCS/TCI/MRI sub-metric with its data provenance (tests, evidence, heuristic) and surface warnings when we fall back to heuristics.

## Details
- Extend ScoringEngine to attach metadata (e.g., `source: tests|evidence|heuristic`).
- Update scores.schema.json and HOLMES renderer/CLI to display provenance and highlight heuristic fallbacks.
- Consider failing readiness if critical components rely on heuristics (configurable).
- Add CLI/CI logging when heuristics are used so teams can prioritize proper coverage.

## Motivation
- Consumers currently can’t tell whether a breakdown score is derived from real tests or guesses.
- Provenance improves trust and guides remediation.

## Acceptance Criteria
- Every breakdown node exposes provenance info.
- Readiness gates (or HOLMES report) warn when heuristics drive a score.
- Documentation clarifies how provenance is determined.
