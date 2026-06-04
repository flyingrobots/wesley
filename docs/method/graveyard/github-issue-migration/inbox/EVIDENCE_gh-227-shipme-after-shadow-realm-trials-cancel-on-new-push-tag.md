# GH-227 SHIPME after Shadow REALM trials — cancel on new push; tag certified SHAs

- Imported from: GitHub issue
- Issue: #227
- URL: https://github.com/flyingrobots/wesley/issues/227
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:07Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `ci`, `group:shadow-realm`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: SHIPME after Shadow REALM trials — cancel on new push; tag certified SHAs

## Overview

Run SHIPME only after the SHADOW REALM trials (rehearsal, load, smoke) complete successfully. If a new commit arrives during trials, cancel the in-progress run. Tag the “Deploy on Friday™”-level secure commit SHAs for traceability.

## Acceptance Criteria

- [ ] SHIPME is triggered only after Shadow REALM job(s) pass.
- [ ] In-progress Shadow REALM trials cancel on new pushes to the PR branch.
- [ ] Create a tag or lightweight release noting the certified commit SHA and date.

## Definition of Done

- Tests / validation: Create a PR, start trials, push new commits; verify cancellation and re-run. On success, ensure SHIPME comment posted and tag created.
- Docs / comms touched: Document the trials → SHIPME sequence and tag naming.

## Links

- Primary reference: .github/workflows/cert-shipme.yml
- Related issues / PRs: #121, #122, #123, #124, #214
