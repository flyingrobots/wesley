# GH-274 Coverage ingestion: upload coverage-summary.json and enforce gates

- Imported from: GitHub issue
- Issue: #274
- URL: https://github.com/flyingrobots/wesley/issues/274
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T16:06:01Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `ci`, `tests`, `progress`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Add coverage upload to pkg workflows (start with @wesley/core/@wesley/cli).
- Persist coverage-summary.json as artifact.
- Have compute-progress read coverage and enforce thresholds for Alpha/Beta.
