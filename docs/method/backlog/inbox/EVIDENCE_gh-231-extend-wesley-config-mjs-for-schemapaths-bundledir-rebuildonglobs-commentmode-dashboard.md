# GH-231 Extend wesley.config.mjs for schemaPaths/bundleDir/rebuildOnGlobs/commentMode/dashboard

- Imported from: GitHub issue
- Issue: #231
- URL: https://github.com/flyingrobots/wesley/issues/231
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:49Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `chore`, `ci`, `pkg:wesley-host-node`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: Extend wesley.config.mjs for schemaPaths/bundleDir/rebuildOnGlobs/commentMode/dashboard

## Overview

Promote schema discovery from heuristics to configuration. Add fields to `wesley.config.mjs` to declare schema locations, where to write bundles, what globs trigger rebuilds, preferred comment mode, and dashboard settings. CI reads config first, then falls back to detection.

## Acceptance Criteria

- [ ] Introduce `schemaPaths`, `bundleDir`, `rebuildOnGlobs`, `commentMode`, `dashboard` in config schema.
- [ ] Update CLI/generate pipeline and CI to use config when present.
- [ ] Validate config with helpful errors; document examples.

## Definition of Done

- Tests / validation: Multi-schema repo correctly lists two schemas and HOLMES runs only for changed set.
- Docs / comms touched: Add config reference to README and docs/architecture/holmes-integration.md.

## Links

- Primary reference: `wesley.config.mjs`
- Related issues / PRs: #223, #229

**Estimate:** 5h
