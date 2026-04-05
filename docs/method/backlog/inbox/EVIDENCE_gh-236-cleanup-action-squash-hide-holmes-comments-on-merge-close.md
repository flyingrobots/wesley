# GH-236 Cleanup action — squash/hide HOLMES comments on merge/close

- Imported from: GitHub issue
- Issue: #236
- URL: https://github.com/flyingrobots/wesley/issues/236
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:17Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `ci`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: Cleanup action — squash/hide HOLMES comments on merge/close

## Overview

Reduce PR noise by hiding or summarizing older HOLMES comments when a PR is merged or closed. Keep the final run visible and link to prior runs via the workflow page or a single summary comment.

## Acceptance Criteria

- [ ] On `pull_request.closed`, run a job to hide/dismiss older HOLMES comments.
- [ ] Optionally post a final summary comment with links to artifacts.
- [ ] Configurable opt-out via label.

## Definition of Done

- Tests / validation: Merge a PR with multiple HOLMES comments and verify cleanup.
- Docs / comms touched: Note cleanup behavior and how to opt out.

## Links

- Primary reference: `.github/workflows/wesley-holmes.yml`
- Related issues / PRs: #224, #230

**Estimate:** 2h
