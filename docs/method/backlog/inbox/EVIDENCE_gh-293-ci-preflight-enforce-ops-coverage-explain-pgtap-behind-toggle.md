# GH-293 ci(preflight): enforce ops coverage (EXPLAIN + pgTAP) behind toggle

- Imported from: GitHub issue
- Issue: #293
- URL: https://github.com/flyingrobots/wesley/issues/293
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:24Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `ci`, `tests`, `group:qir-phase-c`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

Context\n- Preflight already validates QIR/Envelope/Manifest. Add an optional toggle to require EXPLAIN snapshots and pgTAP presence for compiled ops.\n\nAcceptance\n- Toggle env/flag causes preflight to exit non‑zero when ops coverage is incomplete\n- Docs explain how to enable it\n\nLabels: ci, tests, group:qir-phase-c
