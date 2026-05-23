# GH-279 host-browser: native ParserPort (no graphql-js) + IR integration

- Imported from: GitHub issue
- Issue: #279
- URL: https://github.com/flyingrobots/wesley/issues/279
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:58Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `enhancement`, `host`, `pkg:wesley-host-browser`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

Implement a browser-friendly ParserPort without graphql.js.

- Minimal SDL parser sufficient for IR construction.
- Wire to GenerationPipeline in browser host.
- Add contracts that assert real IR shape (not header-only).
- Keep bundle small; avoid Node/polyfills.
