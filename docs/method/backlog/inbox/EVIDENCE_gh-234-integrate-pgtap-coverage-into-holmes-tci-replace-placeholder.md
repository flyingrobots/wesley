# GH-234 Integrate pgTAP coverage into HOLMES TCI (replace placeholder)

- Imported from: GitHub issue
- Issue: #234
- URL: https://github.com/flyingrobots/wesley/issues/234
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:56Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `tests`, `holmes`, `scoring`, `Tracking`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: Integrate pgTAP coverage into HOLMES TCI (replace placeholder)

## Overview

Replace the placeholder TCI value with real coverage computed from pgTAP outputs: constraints, RLS, plan, ops. Aggregate subcomponents with documented weights into `scores.breakdown.tci` and the overall TCI.

## Acceptance Criteria

- [ ] Parse pgTAP outcomes for each suite; compute covered/total and per-suite scores.
- [ ] Inject metrics into the HOLMES report JSON and markdown.
- [ ] Update the PR comment and dashboard to display real TCI values.

## Definition of Done

- Tests / validation: Intentionally break a test suite to observe TCI decrease; restore to see TCI recover.
- Docs / comms touched: Document TCI calculation and weights.

## Links

- Primary reference: `packages/wesley-holmes`, `packages/wesley-host-node`
- Related issues / PRs: #77, #224

**Estimate:** 8h

---
## Tracking (child deliverables)
- #258 TCI: CI wiring + PR comment/dashboard propagation
- #257 TCI: Inject coverage into scores + report rendering
- #256 TCI: Parse pgTAP outputs into coverage metrics

> 1 issue = 1 deliverable. Use this issue to track children, not work.
