# GH-233 Air‑gapped local viewer —

- Imported from: GitHub issue
- Issue: #233
- URL: https://github.com/flyingrobots/wesley/issues/233
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:23Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `holmes`, `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Quick Task: Air‑gapped local viewer — `wesley holmes airgap --pr <n>`

## Overview

Serve a local static dashboard that renders HOLMES/WATSON/MORIARTY JSON reports fetched for a PR. Enables private exploration without relying on Actions artifact UI or external network after fetch.

## Acceptance Criteria

- [ ] CLI downloads artifacts and starts a local server to host the dashboard.
- [ ] Dashboard reads local JSONs and renders SCS/TCI/MRI, breakdowns, and verdicts.
- [ ] Works offline after initial fetch.

## Definition of Done

- Tests / validation: Load localhost and verify the dashboard renders the PR’s reports.
- Docs / comms touched: Document airgap mode; link from PR comments.

## Links

- Primary reference: `docs/holmes-dashboard`, `packages/wesley-cli`
- Related issues / PRs: #225

**Estimate:** 8h
