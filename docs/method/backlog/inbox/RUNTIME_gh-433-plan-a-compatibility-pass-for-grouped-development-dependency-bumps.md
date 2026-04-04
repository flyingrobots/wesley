# GH-433 Plan a compatibility pass for grouped development dependency bumps

- Imported from: GitHub issue
- Issue: #433
- URL: https://github.com/flyingrobots/wesley/issues/433
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T16:06:09Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `out-of-band`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

## Problem
PR #431 (`dependabot/npm_and_yarn/main/development-dependencies-cf3ed49629`) cannot be merged safely on top of current `main`.

The grouped update pulls in major toolchain changes including:
- `eslint` 10 / `@eslint/js` 10
- website test/tooling upgrades
- `dependency-cruiser`, `postcss`, `postcss-nesting`, and related lint/build tooling bumps

On current `main`, the branch introduces unsupported peer ranges and needs a deliberate compatibility pass instead of a blind dependabot merge.

## Why this matters
The branch is directionally useful, but landing it as-is would turn CI green-by-accident into CI red-by-design. We need to decide whether Wesley wants to move the lint stack to the ESLint 10 ecosystem now, and if not, extract only the safe minors.

## Suggested scope
- Audit current peer constraints for `eslint-plugin-promise`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-config-mantine`, and any other hard-pinned ESLint 9 peers.
- Decide whether to hold the repo at ESLint 9 for now or upgrade the full lint stack together.
- Rebuild a minimal follow-up branch from PR #431 that keeps only compatible bumps.
- Re-run the architecture-boundary and website/tooling paths after the extracted update.

## Source
- Superseded branch triage: PR #432
- Original rejected PR: #431
