# GH-228 Render SCS/TCI trendline in PR comment using MORIARTY history.json

- Imported from: GitHub issue
- Issue: #228
- URL: https://github.com/flyingrobots/wesley/issues/228
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:50Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `holmes`, `scoring`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: Render SCS/TCI trendline in PR comment using MORIARTY history.json

## Overview

Generate a small inline chart (SVG/PNG) of SCS/TCI over recent commits using `.wesley/history.json` and embed it near the executive summary to show improvement/regression at a glance.

## Acceptance Criteria

- [ ] Create a tiny renderer (node canvas or SVG) to draw the trend from recent points.
- [ ] Attach image to the run and reference it in the PR comment (or embed data URI within size limits).
- [ ] Respect reduced-motion/accessibility concerns (no animation).

## Definition of Done

- Tests / validation: Push multiple commits to a PR and confirm the image updates with new points.
- Docs / comms touched: Note the chart generation in HOLMES integration docs; link to #77 for long-term dashboard trends.

## Links

- Primary reference: .github/workflows/wesley-holmes.yml; packages/wesley-holmes/src/Moriarty.mjs
- Related issues / PRs: #77, #214
