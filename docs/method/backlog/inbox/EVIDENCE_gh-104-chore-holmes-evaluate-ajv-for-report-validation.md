# GH-104 chore(holmes): evaluate ajv for report validation

- Imported from: GitHub issue
- Issue: #104
- URL: https://github.com/flyingrobots/wesley/issues/104
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:42Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `chore`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Replace the bespoke JSON-schema validator in `packages/wesley-holmes/src/report-schemas.mjs` with Ajv (or similar) to gain better error reporting and schema coverage.

## Motivation
The current validator only supports a subset of JSON schema features. As we add more structure (weights, breakdowns, provenance), maintaining the custom walker becomes risky. Ajv would give us spec compliance and better diagnostics.

## Tasks
- Add Ajv as a dependency for @wesley/holmes.
- Port existing schemas to Ajv (holmes/watson/moriarty reports).
- Update tests to use Ajv for validation.
- Ensure CLI commands still exit with helpful messaging when validation fails.

## Acceptance Criteria
- All report commands use Ajv under the hood.
- CI/test suites cover both valid and invalid payloads.
- Error output remains user-friendly.

(Relates to #102 review feedback.)
