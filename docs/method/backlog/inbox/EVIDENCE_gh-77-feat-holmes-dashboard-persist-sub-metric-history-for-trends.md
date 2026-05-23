# GH-77 feat(holmes-dashboard): persist sub-metric history for trends

- Imported from: GitHub issue
- Issue: #77
- URL: https://github.com/flyingrobots/wesley/issues/77
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:16Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `holmes`, `scoring`, `pkg:wesley-holmes`, `pkg:wesley-host-node`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary

The dashboard can now display SCS/TCI/MRI breakdowns for a single bundle, but history.json only stores top-level scores. Persist sub-metric history so HOLMES and MORIARTY visualizations can chart which vectors are improving or regressing.

## Context

- Scores v2 introduces nested `breakdown` payloads (sql/types/validation/tests, etc.).
- `docs/holmes-dashboard/index.html` renders per-bundle tables but lacks trend lines over time.
- WesleyFileWriter.updateHistory currently appends {scs,tci,mri} only.

## Tasks

- Update history persistence to capture breakdown snapshots per day (without breaking existing consumers).
- Extend MORIARTY prediction model to ingest the richer history (ignore gracefully when absent).
- Update dashboard JS to plot sub-metric trends (line charts/tables with color cues).
- Add bats/e2e coverage exercising the new history shape.

## Acceptance Criteria

- history.json records breakdown data alongside top-level scores.
- Dashboard and HOLMES CLI surface trend info without regressions.
- Documentation describes the new history schema and migration notes.
