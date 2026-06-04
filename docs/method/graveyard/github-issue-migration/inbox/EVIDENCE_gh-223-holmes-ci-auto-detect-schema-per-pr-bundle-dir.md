# GH-223 HOLMES CI auto-detect schema + per-PR bundle dir

- Imported from: GitHub issue
- Issue: #223
- URL: https://github.com/flyingrobots/wesley/issues/223
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:46Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `chore`, `ci`, `holmes`, `pkg:wesley-holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: HOLMES CI auto-detect schema + per-PR bundle dir

## Overview

Make HOLMES evaluate the PR’s actual schema by auto-detecting a repo schema file and tying the evidence bundle to that schema’s directory (e.g., `<schema-dir>/.wesley`). This removes reliance on the example fixtures and ensures scores reflect the PR.

## Acceptance Criteria

- [ ] Detect schema path in this order: `WESLEY_SCHEMA` (if present & exists) → first tracked `schema.graphql` → first tracked `*.graphql` → fallback to example schema.
- [ ] Expose `schema` and `bundle_dir` as job `outputs` and plumb them through all HOLMES jobs.
- [ ] Always regenerate the bundle for each run; bind scores to the current commit SHA.

## Definition of Done

- Tests / validation: Open a PR that changes the repo schema and confirm HOLMES scores change; inspect the comment for the detected path.
- Docs / comms touched: Add a short note to README/docs on how detection works and how to override with `WESLEY_SCHEMA`.

## Links

- Primary reference: .github/workflows/wesley-holmes.yml
- Related issues / PRs: #214
