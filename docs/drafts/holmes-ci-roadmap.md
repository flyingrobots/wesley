# SHA-lock HOLMES CI/UX Roadmap (Draft)

> Smarter rebuilds, commit-bound evidence, readable comments, and self-serve viewing.

## Goals

- Evaluate the PR’s actual schema(s) and bind evidence to the current commit SHA.
- Rebuild intelligently: avoid work on docs-only changes; always certify on main.
- Make reports skimmable in PRs and explorable in a dashboard or local viewers.
- Replace synthetic scores with real evidence (pgTAP for TCI; planned DDL for MRI; per-UID coverage for SCS).

## Rebuild Policy & Change Detection

- Use paths-filter to compute booleans per domain: `schema`, `ops`, `core`, `generators`, `host_node`, `holmes`, `weights`, `docs_only`.
- Rebuild HOLMES when any domain except `docs_only` changes.
- Skip heavy steps on docs-only churn; post a small note: “No evidence inputs changed; previous certification remains valid.”
- Always rebuild (and run SHIPME) on push to `main`.
- Concurrency: `holmes-${{ github.ref }}` with `cancel-in-progress: true`.

## Schema Discovery vs Repo Config

- Auto-detect order: `WESLEY_SCHEMA` (if set) → first tracked `schema.graphql` → first tracked `*.graphql` → fallback to example.
- Add repo config (`wesley.config.mjs`) with:
  - `schemaPaths`: explicit list/globs for multi-schema repos
  - `bundleDir`: where `.wesley` lives (default alongside schema)
  - `rebuildOnGlobs`: additional globs that should trigger rebuilds
  - `commentMode`: `append` | `update`
  - `dashboard`: `{ publish: 'pages'|'artifact', baseUrl?: string }`

## PR Comment UX & Noise Control

- One unified comment per run with `<details>` sections for HOLMES, WATSON, MORIARTY.
- Include `Run: <ISO timestamp> · see workflow artifacts` (direct link to the run).
- Default behavior: append new comment per run (history preserved).
- Opt-in single-comment mode: checkbox in PR body (`- [ ] Update previous comment …`) or label (e.g., `holmes:single-comment`).
- Optional cleanup action: squash or hide older HOLMES comments on merge/close.

## Viewing Artifacts (No 404s)

- Provide local viewers:
  - TUI: `pnpm wesley holmes tui --pr 123` (GH auth; fetch JSON; render bars/tables in terminal).
  - Airgap Web: `pnpm wesley holmes airgap --pr 123` (fetch then serve a local static viewer).
- Comments include a “View locally” snippet for both modes.

## Scoring Upgrades (From Placeholder → Real)

- TCI (Test Confidence): parse pgTAP outcomes per suite (constraints/rls/plan/ops), compute coverage and assign weights; inject into `scores.breakdown.tci` and aggregate.
- MRI (Migration Risk): derive from planned DDL + lock radar + risk vectors; penalize blocking locks, drops/renames, etc.
- SCS (Schema Coverage): use per-UID evidence weights and sources (sql/types/validation/tests) with covered/total weight.

## Trendlines & Dashboard

- Generate a small trendline (SVG/PNG) for SCS/TCI from `.wesley/history.json` and embed near the summary.
- Publish `docs/holmes-dashboard` to Pages (or artifact with stable URL) and link in each PR comment.
- Team dashboard: index by branch, show Moriarty trajectory trends; PMs compare progress at a glance.

## SHIPME After SHADOW REALM

- PR flow: holmes → watson → moriarty → shadow-realm (rehearsal/load/smoke). On success, mark “Ready for SHIPME.”
- Cancel in-progress trials on new pushes.
- On merge to `main`: run full SHIPME certification and tag the certified commit (Deploy on Friday™).

## Action Items (Issues)

1) CI changed-files gating & skip comment; concurrency cancel.
2) PR config toggles (checkboxes/labels) to control append vs update, trendline, dashboard link.
3) Repo config (`wesley.config.mjs`) extensions for schemaPaths/bundleDir/rebuildOnGlobs/commentMode/dashboard.
4) TUI viewer: `wesley holmes tui --pr`.
5) Airgap local web viewer: `wesley holmes airgap --pr`.
6) Integrate pgTAP coverage into HOLMES TCI (replace placeholder 0.7).
7) Multi-schema selective rebuild (rebuild only affected schema sets).
8) Squash/hide HOLMES comments on merge.
9) Team Dashboard index across branches; link from PR comments.
10) (Existing) Publish dashboard to Pages and link in comments.
11) (Existing) Trendline image in PR comments from MORIARTY history.
12) (Existing) Bot identity + optional review gating.

— End draft —

