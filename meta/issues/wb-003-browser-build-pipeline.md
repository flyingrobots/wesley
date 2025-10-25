---

## Additional Notes

Collaborate with release engineering to integrate size budgets and artifact publishing.

## Dependencies

- **Blocked by:** [WB-001](./wb-001-browser-adapter-spike.md)
- **Blocks:** [WB-004](./wb-004-browser-playground-ui.md)

# [WB-003] Browser Build & Packaging Pipeline

## Overview

Set up the build infrastructure required to bundle Wesley core + browser host for modern browsers, including ESM outputs, optional WASM shims, and automated size/regression checks.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: `docs/features/host-browser.md`
- [ ] Related Issues / PRs: WB-001, WB-002
- [ ] Feature Flags / Experiments: n/a
- [ ] Other Assets: `meta/milestones/wesley-in-the-browser.md`

## User Story

As a **Wesley maintainer**, I want **a reproducible build pipeline for browser bundles**, so that **we can ship updates safely and monitor performance over time**.

## Acceptance Criteria

- [ ] Configure Rollup/Vite pipeline that outputs ESM bundle + optional web worker build.
- [ ] Bundle size budgets enforced in CI (fail if > 1.5 MB uncompressed or > 500 KB gzip baseline).
- [ ] Source maps and version metadata embedded for debugging.
- [ ] Automated smoke test loads bundle in headless browser and exercises adapter API.

## Definition of Done

CI pipeline produces versioned artifacts, size reports published, and documentation added for release process.

## Scope

### In-Scope

- Build tooling, config, CI jobs, size budgets

### Out-of-Scope

- UI playground integration (WB-004)

### Deliverables

- **Est. Lines of Code:** 300-500 (configs + scripts)
- **Est. Blast Radius:** build scripts, CI workflows, package.json exports

## Implementation Details

### High-Level Approach

Use Rollup with plugin ecosystem (replace, node-polyfills where necessary), produce multiple entrypoints, and integrate with GitHub Actions for size tracking.

### Affected Areas

- packages/wesley-host-browser
- tools/build/ (new scripts)
- .github/workflows/browser-build.yml

### Implementation Steps

- [ ] Author Rollup config targeting modern browsers + worker entry.
- [ ] Introduce bundle size analytics (Calibre or bundlewatch) in CI.
- [ ] Add automated smoke test using Playwright or Puppeteer.
- [ ] Document build & publish steps in /docs.

## Test Plan

### Happy Path

- [ ] CI job builds bundle and smoke test executes `transform()` successfully.

### Edge Cases

- [ ] Production build with minification retains source maps.

### Failure Cases

- [ ] Build fails if size budgets exceeded.

### Monitoring & Success Metrics

- [ ] Bundle size trend tracked over time.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| GitHub Actions | Headless Chrome | TBD | pending | |

## Requirements

### Hard Requirements

- Output must be tree-shakeable and published under consistent semver tag.

### Soft Requirements

- Provide optional ES module for web workers.

### Runtime Requirements

- Ensure CSP-friendly builds (no eval when possible).

### Dependencies & Approvals

- [ ] WB-001 completed
- [ ] Partial support from WB-002 for entrypoints

---

## Production Notes

### Priority: 4 / 5

Needed to ship adapter but can run in parallel after WB-001.

### Complexity: 3 / 5

Medium complexity configuration + CI integration.

### Estimate: 60 - 80 hours

Includes setup, iterations, and test infrastructure.

### Risk & Rollback

- **Primary Risks:** Tooling incompatibilities, slow builds.
- **Mitigations:** Evaluate Rollup vs Vite-only; fallback to Webpack if blocking issues.
- **Rollback / Kill Switch:** Keep Node host as default; mark browser build experimental until stable.
