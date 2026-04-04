# GH-276 CI speed-ups: Playwright cache + Bats optimization

- Imported from: GitHub issue
- Issue: #276
- URL: https://github.com/flyingrobots/wesley/issues/276
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T16:06:07Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `ci`, `out-of-band`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Cache Playwright Chromium to speed browser job; avoid apt-get bats by using a prebuilt action or vendored binaries.
