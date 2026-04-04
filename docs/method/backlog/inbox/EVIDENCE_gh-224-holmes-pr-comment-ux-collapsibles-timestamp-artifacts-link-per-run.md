# GH-224 HOLMES PR comment UX — collapsibles, timestamp, artifacts link, per-run history

- Imported from: GitHub issue
- Issue: #224
- URL: https://github.com/flyingrobots/wesley/issues/224
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:47Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `chore`, `ci`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: HOLMES PR comment UX — collapsibles, timestamp, artifacts link, per-run history

## Overview

Improve readability and traceability of the HOLMES PR comment by wrapping each report block in collapsible sections, adding a visible run timestamp, linking directly to the run’s artifacts, and posting a new comment for each run (rather than updating in-place) to preserve PR history.

## Acceptance Criteria

- [ ] Each run posts a fresh comment with <details> sections for HOLMES, WATSON, and MORIARTY.
- [ ] Comment includes `Run: <ISO timestamp> · see workflow artifacts` linking to the current run.
- [ ] Keep “Evidence valid only for commit <sha>” visible in the HOLMES section.

## Definition of Done

- Tests / validation: Trigger multiple pushes to a PR and confirm a new comment appears per run with collapsibles and working artifact link.
- Docs / comms touched: Add a short note in docs/architecture/holmes-integration.md about comment behavior and how history is preserved.

## Links

- Primary reference: .github/workflows/wesley-holmes.yml
- Related issues / PRs: #214, #192, #193
