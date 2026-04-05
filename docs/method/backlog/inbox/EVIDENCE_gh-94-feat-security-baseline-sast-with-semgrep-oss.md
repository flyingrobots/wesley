# GH-94 feat(security): baseline SAST with Semgrep OSS

- Imported from: GitHub issue
- Issue: #94
- URL: https://github.com/flyingrobots/wesley/issues/94
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:19Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `chore`, `security`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Add a zero-cost SAST pass using Semgrep OSS to catch obvious code smells before release.

## Details
- Add a GitHub Actions workflow running Semgrep with the official OSS ruleset (`semgrep ci --config auto`).
- Scope initial run to critical packages (`packages/wesley-*`, `scripts/`, `.github/`).
- Fail build on high-severity findings; report others as warnings for triage.
- Upload SARIF results to GitHub Security for centralized tracking.

## Motivation
- Complements Dependabot/Scorecard by catching common security bugs and insecure patterns without licensing fees.

## Acceptance Criteria
- Workflow runs on push + PR for main branches.
- Findings visible in Security tab; documentation explains how to suppress false positives.
- Added to go-public checklist once green.
