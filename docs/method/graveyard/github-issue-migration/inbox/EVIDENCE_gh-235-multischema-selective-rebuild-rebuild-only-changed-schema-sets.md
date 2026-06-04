# GH-235 Multi‑schema selective rebuild (rebuild only changed schema sets)

- Imported from: GitHub issue
- Issue: #235
- URL: https://github.com/flyingrobots/wesley/issues/235
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:50Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `ci`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: Multi‑schema selective rebuild (rebuild only changed schema sets)

## Overview

In repos with multiple schemas, rebuild only the affected schema sets based on changed files. Avoid full rebuilds when unrelated schema trees do not change.

## Acceptance Criteria

- [ ] Map schemaPaths from config to owning globs.
- [ ] From changed files, compute the subset of schemaPaths that require HOLMES.
- [ ] Run HOLMES per schema set or batch them efficiently; aggregate comments.

## Definition of Done

- Tests / validation: Modify `schema A` only → only A’s evidence rebuilds; modify `schema B` → only B rebuilds.
- Docs / comms touched: Document multi-schema behavior and examples.

## Links

- Primary reference: `wesley.config.mjs`, `.github/workflows/wesley-holmes.yml`
- Related issues / PRs: #231

**Estimate:** 5h
