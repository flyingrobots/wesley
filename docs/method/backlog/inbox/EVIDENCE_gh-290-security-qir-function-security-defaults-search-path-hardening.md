# GH-290 security(qir): function SECURITY defaults + search_path hardening

- Imported from: GitHub issue
- Issue: #290
- URL: https://github.com/flyingrobots/wesley/issues/290
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:21Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `security`, `group:qir-phase-c`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

Context\n- Default to SECURITY INVOKER when RLS covers base tables; allow configurable SECURITY DEFINER with SET search_path = pg_catalog, <app_schema>.\n\nAcceptance\n- Config knob + docs\n- Emitted SQL includes explicit SECURITY and safe search_path when applicable\n\nLabels: group:qir-phase-c, security, enhancement
