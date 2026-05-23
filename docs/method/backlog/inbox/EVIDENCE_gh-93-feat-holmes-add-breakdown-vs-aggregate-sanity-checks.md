# GH-93 feat(holmes): add breakdown vs aggregate sanity checks

- Imported from: GitHub issue
- Issue: #93
- URL: https://github.com/flyingrobots/wesley/issues/93
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:40Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `pkg:wesley-core`, `pkg:wesley-holmes`, `group:holmes-scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary

Ensure top-level SCS/TCI/MRI scores stay consistent with their breakdown components by adding automated sanity checks and fail-fast guardrails.

## Details

- After computing breakdowns, recompute aggregate scores and compare against published SCS/TCI/MRI (within configurable tolerance).
- Fail bundle generation or emit warnings when discrepancies exceed tolerance (configurable).
- Update validate-bundle/holmes CLI to run the same validation for safety.

## Motivation

- Manual edits or future heuristics could desync aggregates from components, undermining trust.

## Acceptance Criteria

- Bundles with mismatched aggregates fail validation (or at least warn loudly).
- Tests cover matching and mismatching scenarios.
- Documentation describes the sanity check and tolerance settings.
