# GH-230 HOLMES PR controls via PR body checkboxes + label overrides

- Imported from: GitHub issue
- Issue: #230
- URL: https://github.com/flyingrobots/wesley/issues/230
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:54Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `ci`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: HOLMES PR controls via PR body checkboxes + label overrides

## Overview

Allow PR authors to control comment mode and verbosity via checkboxes in the PR body (e.g., update vs append, include trendline, include dashboard link) with label overrides (`holmes:single-comment`, `holmes:trend`).

## Acceptance Criteria

- [ ] First HOLMES run posts a config snippet with checkboxes (if not present).
- [ ] github-script reads PR body and labels to set flags.
- [ ] Respect flags in comment behavior (append vs update) and content (trendline/dashboard link).

## Definition of Done

- Tests / validation: Toggle checkboxes and labels and verify behavior changes on next run.
- Docs / comms touched: Document flags in contributor guide and HOLMES integration doc.

## Links

- Primary reference: `.github/workflows/wesley-holmes.yml`
- Related issues / PRs: #224, #228, #225

**Estimate:** 3h
