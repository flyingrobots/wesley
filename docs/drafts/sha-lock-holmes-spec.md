# SHA-lock HOLMES — Specification (Draft)

> Modes: Interactive CLI (TUI), CI/CD Automation, and ChatOps/App (On‑Demand Reviewer)

## 1. Purpose

Provide a commit‑bound, evidence‑driven evaluation of deployment safety and readiness for schema changes. HOLMES consumes a Wesley evidence bundle, produces machine‑readable + human‑readable reports, and integrates with CI/CD, local workflows, and ChatOps.

## 2. Operating Modes

### I) Interactive CLI (Developer/TUI)
- Entrypoints:
  - `wesley holmes report --bundle-dir <path> [--history-file <path>] [--json <out>]`
  - `wesley holmes tui --pr <number>` (fetch artifacts with GH auth; local viewer)
  - `wesley holmes airgap --pr <number>` (fetch artifacts, serve local web viewer)
- Inputs: `.wesley/{bundle.json,scores.json,history.json}`, optional weights.
- Outputs: Markdown, JSON, interactive TUI or localhost dashboard.
- Use cases: explore scores, drill into breakdowns, compare commits offline.

### II) CI/CD Automation (Non‑Interactive)
- Trigger: pull_request (opened/synchronize/reopened) and push: main.
- Detection:
  - Config‑first discovery via `wesley.config.mjs` (schemaPaths, bundleDir, rebuildOnGlobs).
  - Fallback auto‑detect: `WESLEY_SCHEMA` → `schema.graphql` → first `*.graphql` → example.
- Rebuild policy:
  - Changed‑files gating using `paths-filter` on domains: `schema/ops/core/generators/host_node/holmes/weights/docs_only`.
  - Run HOLMES when any non‑docs domain changed; skip otherwise with short status comment.
  - Always run full flow on `push: main`. Concurrency cancels in‑flight runs per branch.
- Artifacts: upload `{bundle.json,scores.json,history.json}`, dashboard bundle, optional trendline image.
- Comment UX:
  - New comment per run with `<details>` sections (HOLMES/WATSON/MORIARTY).
  - Includes `Run: <ISO time> · see workflow artifacts` link and commit binding.
  - Optional single‑comment update mode controlled by PR checkboxes or labels.
- Integration:
  - Optionally run SHADOW REALM trials (rehearsal/load/smoke) before SHIPME.
  - On merge to `main`: run SHIPME certification and tag certified SHA.

### III) ChatOps / App (On‑Demand Reviewer)
- Trigger: GitHub App or bot via PR comments/commands (e.g., `@sha-lock-holmes investigate`), or scheduled enforcement.
- Capabilities:
  - Fetch current artifacts or regenerate as allowed; post a Review (approve/request changes) based on thresholds.
  - Respond to commands: set thresholds, toggle single‑comment mode, attach dashboard link, re‑run a specific mode.
- Security: fine‑grained PAT or App with `pull-requests:write`, `contents:read`, `actions:read` scopes.

## 3. Inputs & Configuration
- Evidence bundle: `.wesley/bundle.json` (sha, timestamp, evidence, scores) + `scores.json` + `history.json`.
- Config: `wesley.config.mjs` fields:
  - `schemaPaths: string[]`
  - `bundleDir: string`
  - `rebuildOnGlobs: string[]`
  - `commentMode: 'append' | 'update'`
  - `dashboard: { publish: 'pages' | 'artifact', baseUrl?: string }`
- Env: `WESLEY_SCHEMA` override; `GITHUB_TOKEN`/App creds for fetch.

## 4. Outputs
- Structured JSON: holmes/watson/moriarty reports (validated schemas).
- Markdown: investigation/verification/prediction.
- CI comments with collapsibles and run metadata.
- Optional: trendline image, Pages dashboard URL, SHIPME cert/tag on main.

## 5. Scoring (Target)
- SCS: evidence‑weighted coverage across per‑UID elements (sql/types/validation/tests).
- TCI: pgTAP sub‑suites (constraints/rls/plan/ops) with weights; computed from pass/fail counts.
- MRI: DDL plan risk (lock levels, drops/renames/type changes/index strategy), lock radar.
- Thresholds: gate verdicts (ELEMENTARY/REQUIRES INVESTIGATION/YOU SHALL NOT PASS).

## 6. CI Behavior & Policies
- Detect → Generate → Investigate → Verify → Predict → (optional) Shadow‑Realm → Comment → (main) SHIPME
- Skip policy: if docs‑only changes, post minimal status and reuse last certification.
- Concurrency: cancel in‑flight on new pushes to same ref.
- PR Controls: checkboxes in body + labels to tune comment update mode, trendline, dashboard link.

## 7. Security & Privacy
- Artifacts limited to repo permissions; external viewers use TUI/airgap.
- Bot/App tokens scoped minimally; secrets managed per‑repo/org.

## 8. Extensibility
- Additional sub‑metrics, custom weights via `.wesley/weights.json`.
- Additional viewers (VSCode webview), more ChatOps commands, organization dashboards.

— End specification (draft) —
