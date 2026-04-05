# GH-225 Publish HOLMES dashboard to Pages and link from PR comment

- Imported from: GitHub issue
- Issue: #225
- URL: https://github.com/flyingrobots/wesley/issues/225
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:20Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `docs`, `ci`, `holmes`, `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Quick Task: Publish HOLMES dashboard to Pages and link from PR comment

## Overview

Publish the `docs/holmes-dashboard` viewer to GitHub Pages (or as a static artifact with a stable URL) and include a link in the HOLMES PR comment so reviewers can quickly explore SCS/TCI/MRI details with the JSON reports.

## Acceptance Criteria

- [ ] Build & deploy the dashboard to Pages on each run (or nightly) with the run’s JSON reports.
- [ ] Add a link in the HOLMES PR comment to the dashboard for the current run.
- [ ] Ensure access/permissions for external collaborators viewing the dashboard.

## Definition of Done

- Tests / validation: Open a PR, get a comment with a working dashboard link that renders the current run’s reports.
- Docs / comms touched: Update docs/architecture/holmes-integration.md with deployment and link strategy.

## Links

- Primary reference: docs/holmes-dashboard
- Related issues / PRs: #192, #193, #214
