# GH-87 feat(holmes): emit structured test metadata for TCI

- Imported from: GitHub issue
- Issue: #87
- URL: https://github.com/flyingrobots/wesley/issues/87
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:32Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `pkg:wesley-core`, `pkg:wesley-generator-supabase`, `pkg:wesley-holmes`, `group:holmes-scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary

Replace heuristic-driven TCI confidence with structured test metadata from pgTAP (and other suites) so HOLMES readiness reflects actual pass/fail signals.

## Details

- [ ] Update pgTAP generator to emit per-suite results (total, passed, failed, category).
- [ ] Persist those results in the evidence bundle (history, scores).
- [ ] Refactor ScoringEngine.calculateTCIBreakdown/TCI to consume the structured data.
- [ ] Ensure Watson/Moriarty ignore or gracefully downgrade when metadata is missing. 
- [ ] Add tests for both happy path (complete metadata) and fallback (no metadata). 


## Motivation

- Current TCI falls back to evidence presence; failing test suites can still yield high scores.
- Explicit metrics unblock more deterministic gating and analytics.

## Dependencies

- [x] Coordinate with #52/#78 implementation details.

## Downstream: 

HOLMES CLI, dashboard, schemas.

## Acceptance Criteria

- [ ]  Scores JSON records per-category pass rates derived from real test output.
- [ ] TCI drops when tests fail, without relying on evidence heuristics.
- [ ] Documentation updated to describe new metadata fields.
