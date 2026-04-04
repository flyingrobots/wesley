# GH-434 Resolve the vite vs rolldown-vite override conflict before taking prod bumps

- Imported from: GitHub issue
- Issue: #434
- URL: https://github.com/flyingrobots/wesley/issues/434
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T16:06:11Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `out-of-band`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

## Problem
PR #429 (`dependabot/npm_and_yarn/main/production-dependencies-0813ff24ca`) cannot be merged as-is because it bumps root `vite` to `^8.0.0` while the repo still globally overrides `vite` to `npm:rolldown-vite@7.1.14` in the root `pnpm.overrides` block.

That combination attempts to resolve `vite@npm:rolldown-vite@8.0.0`, which does not exist.

## Why this matters
This is not a one-off Dependabot glitch. It is a real policy conflict in the repo:
- package manifests want to move forward
- the workspace override forces the old `rolldown-vite` alias
- grouped production updates will keep failing until that decision is made explicitly

## Suggested scope
- Decide whether Wesley is staying on `rolldown-vite@7.x` for now or moving to Vite 8.
- If staying on `rolldown-vite`, pin manifests and Dependabot strategy so grouped prod updates stop proposing impossible combinations.
- If moving to Vite 8, remove or replace the alias strategy and validate the website/build stack end to end.
- Revisit the remaining safe prod bumps after the override decision is settled.

## Source
- Superseded branch triage: PR #432
- Original rejected PR: #429
