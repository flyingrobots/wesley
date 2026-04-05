# GH-95 feat(security): baseline DAST with OWASP ZAP

- Imported from: GitHub issue
- Issue: #95
- URL: https://github.com/flyingrobots/wesley/issues/95
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:21Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `chore`, `security`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

## Summary
Introduce a lightweight dynamic scan using OWASP ZAP (Dockerized baseline scan) against our local demo endpoints.

## Details
- Add a GitHub Actions workflow using `owasp/zap2docker-stable zap-baseline.py`.
- Target the docker-compose demo (or a minimal test service) spun up in CI.
- Export alerts as HTML + SARIF; fail on medium+ findings configurable via inputs.
- Retain artifacts for triage and link to Security tab when SARIF upload is supported.

## Motivation
- Free/open-source DAST coverage complements SAST and catches runtime misconfigurations before go-live.

## Acceptance Criteria
- Workflow runnable on demand (workflow_dispatch) and scheduled (weekly) without manual intervention.
- Documentation explains how to tune alert severities and suppress known findings.
- Added to go-public checklist once baseline passes.
