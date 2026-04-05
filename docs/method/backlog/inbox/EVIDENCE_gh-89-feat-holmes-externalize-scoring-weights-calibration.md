# GH-89 feat(holmes): externalize scoring weights & calibration

- Imported from: GitHub issue
- Issue: #89
- URL: https://github.com/flyingrobots/wesley/issues/89
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:35Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `ci`, `holmes`, `scoring`, `pkg:wesley-core`, `pkg:wesley-holmes`, `group:holmes-scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Move hard-coded SCS/TCI/MRI weights and thresholds into configurable policy objects so teams can calibrate readiness without code changes.

## Details
- Introduce a configuration file or CLI flags for weight/threshold tuning (with sane defaults).
- Validate weights sum to 1 and thresholds are within [0,1].
- Update ScoringEngine to consume the config, falling back to defaults when unspecified.
- Surface the active policy in bundle.json for traceability.

## Motivation
- Current weights (0.45/0.2/0.2/0.15 + fixed thresholds) are embedded in code, making experimentation difficult.
- Different environments (dev/staging/prod) may require different tolerances.

## Acceptance Criteria
- Configurable weights/thresholds respected by ScoringEngine and readiness calculations.
- scores.schema.json + docs updated to explain policy exposure.
- Tests covering default vs. custom policy paths.
