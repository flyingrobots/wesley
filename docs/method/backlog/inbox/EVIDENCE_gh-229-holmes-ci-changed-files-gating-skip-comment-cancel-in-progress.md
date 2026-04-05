# GH-229 HOLMES CI changed-files gating + skip comment + cancel in-progress

- Imported from: GitHub issue
- Issue: #229
- URL: https://github.com/flyingrobots/wesley/issues/229
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:52Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `ci`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

# Quick Task: HOLMES CI changed-files gating + skip comment + cancel in-progress

## Overview

Reduce waste by rebuilding HOLMES only when inputs that affect evidence change. Use `paths-filter` to detect relevant changes (schema/ops/core/generators/host-node/holmes/weights) and skip heavy steps on docs-only churn. Always certify on `main`. Add concurrency to cancel in-progress runs on new pushes.

## Acceptance Criteria

- [ ] Add `dorny/paths-filter` step with filters for `schema`, `ops`, `core`, `generators`, `host_node`, `holmes`, `weights`, and `docs_only`.
- [ ] Compute `need_holmes` from filters; gate heavy jobs with `if:`.
- [ ] Post a small skip-comment (no relevant changes) listing triggers for rebuild.
- [ ] Add `concurrency: group: holmes-${{ github.ref }}, cancel-in-progress: true`.
- [ ] `push: main` always runs full HOLMES + certification path.

## Definition of Done

- Tests / validation: push doc-only changes to a PR → HOLMES skips with skip-comment; push schema/generator change → HOLMES runs; merge to main → full run executed.
- Docs / comms touched: Document skip criteria and rebuild triggers in `docs/architecture/holmes-integration.md`.

## Links

- Primary reference: `.github/workflows/wesley-holmes.yml`
- Related issues / PRs: #214, #223, #224

**Estimate:** 5h
