# GH-91 feat(holmes): surface breakdown diagnostics in reports

- Imported from: GitHub issue
- Issue: #91
- URL: https://github.com/flyingrobots/wesley/issues/91
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:38Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `pkg:wesley-holmes`, `group:holmes-scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Augment HOLMES investigation output with a short diagnostic section that highlights sub-metrics below thresholds or relying on heuristics so reviewers can triage quickly.

## Details
- After the breakdown tables, add a “Primary Risks” section summarizing any components under threshold (or heuristic).
- Include tooltip/markdown guidance linking to relevant docs/tests.
- Feed the same summary into CLI JSON for automation (e.g., GitHub comments).

## Motivation
- Reviewers currently scan tables manually; automated summaries speed decision making.

## Acceptance Criteria
- HOLMES markdown + JSON include a diagnostic block listing risky sub-metrics.
- Scores schema updated if new fields are introduced.
- Tests verify diagnostics trigger under low scores and remain empty when all metrics pass.
