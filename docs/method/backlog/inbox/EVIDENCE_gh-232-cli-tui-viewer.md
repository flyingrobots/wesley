# GH-232 CLI TUI viewer —

- Imported from: GitHub issue
- Issue: #232
- URL: https://github.com/flyingrobots/wesley/issues/232
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:21Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `holmes`, `pkg:wesley-cli`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: CLI TUI viewer — `wesley holmes tui --pr <n>`

## Overview

Provide a terminal UI to fetch HOLMES/WATSON/MORIARTY artifacts for a PR (with GH auth) and render a compact, navigable view (scores, breakdowns, gates) without relying on Actions artifact visibility.

## Acceptance Criteria

- [ ] Authenticate to GitHub (token) and download latest run artifacts for a PR.
- [ ] Render SCS/TCI/MRI, executive summary, and breakdown tables in TUI.
- [ ] Handle missing/partial artifacts gracefully.

## Definition of Done

- Tests / validation: Run against a sample PR; verify offline browsing after fetch.
- Docs / comms touched: Add usage to README and HOLMES docs; print a one-liner in PR comments.

## Links

- Primary reference: `packages/wesley-cli`
- Related issues / PRs: #225, #224

**Estimate:** 8h
