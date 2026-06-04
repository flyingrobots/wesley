# GH-237 Team Dashboard index across branches (Pages) + link from PR comments

- Imported from: GitHub issue
- Issue: #237
- URL: https://github.com/flyingrobots/wesley/issues/237
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:24Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `docs`, `holmes`, `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Quick Task: Team Dashboard index across branches (Pages) + link from PR comments

## Overview

Publish an index page that enumerates branches with recent HOLMES runs, shows Moriarty trends, and links to each branch’s dashboard. Add a PR comment link to the branch-specific page.

## Acceptance Criteria

- [ ] Build branch index (recent runs, trend sparkline) and deploy to Pages.
- [ ] Link PR comments to the branch’s dashboard.
- [ ] Handle private repos (auth hints) and missing data gracefully.

## Definition of Done

- Tests / validation: Open two PRs and confirm both appear on the index with distinct trendlines.
- Docs / comms touched: Document dashboard URLs and retention policy.

## Links

- Primary reference: `docs/holmes-dashboard`
- Related issues / PRs: #225, #228

**Estimate:** 5h
