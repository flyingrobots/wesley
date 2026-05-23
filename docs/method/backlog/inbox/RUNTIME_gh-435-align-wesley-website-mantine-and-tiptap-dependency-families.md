# GH-435 Align wesley-website Mantine and TipTap dependency families

- Imported from: GitHub issue
- Issue: #435
- URL: https://github.com/flyingrobots/wesley/issues/435
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T16:06:13Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `out-of-band`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

## Problem

The website editor dependency surface is still internally uneven after the safe cherry-picks from PR #432:

- PR #427 (`dependabot/npm_and_yarn/main/mantine/notifications-8.3.17`) was rejected as a too-narrow partial Mantine bump
- PRs #426 and #423 were cherry-picked for `@tiptap/pm` and `@tiptap/react`, but the wider TipTap stack in `wesley-website/package.json` still deserves a coherent alignment pass

Current local lockfile/install warnings show remaining peer drift across Mantine and TipTap packages.

## Why this matters

The branch in PR #432 is good enough to merge, but it should not be treated as the final editor dependency shape. We still have avoidable peer-noise and version skew in the website stack.

## Suggested scope

- Align the `@tiptap/*` package set in `wesley-website/package.json` to a coherent version family.
- Decide whether the Mantine website packages should stay on `8.3.10` as a block or move together to the current `8.3.x` line.
- Re-run the website build and any editor-facing tests after the alignment.
- Close PR #427 once this issue is accepted as the replacement work item.

## Source

- Superseded branch triage: PR #432
- Rejected branch/PR: #427
- Partially incorporated branches: #426, #423
