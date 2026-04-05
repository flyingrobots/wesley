# GH-260 Website baseline: Vite+React app scaffold + Pages deploy harness

- Imported from: GitHub issue
- Issue: #260
- URL: https://github.com/flyingrobots/wesley/issues/260
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:48Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

## Overview
Scaffold the base website app (Vite+React+Mantine) and ensure the GitHub Pages deploy harness is in place and green. This is the prerequisite surface for the Playground Shell.

## Acceptance Criteria
- [ ] Vite app compiles locally and CI builds artifact
- [ ] Pages workflow deploys site from the built `website/dist`
- [ ] Placeholder route for `/playground` exists (blank)
- [ ] Basic lint/format hooks configured or deferred

## Definition of Done
- CI: docs-site workflow green; site loads; `/playground` route resolves
- Docs: short README section describing `website/` and how to run locally

## Links
- Tracks shell: #259

---
## Checklist
- [ ] Scaffold Vite+React+Mantine app under `website/`
- [ ] Wire docs-site GitHub Pages workflow to build `website/dist`
- [ ] Add `/playground` route (placeholder)
- [ ] Add short README for website dev commands
- [ ] Verify CI build + deploy green
