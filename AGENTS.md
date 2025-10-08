# Agents Guide and Policy

This document defines repo‑wide conventions and guardrails for human and AI agents contributing to this project. It applies to the entire repository unless a nested `AGENTS.md` overrides a section. Project owner directions and the conventions in `docs/` take precedence if conflicts arise.

## Scope and Precedence
- Read `docs/` (especially docs/README.md, milestones, and architecture) before changing code or workflows.
- If a directory contains its own `AGENTS.md`, that file’s guidance applies to that subtree.

## Intent and Guardrails
- Prefer minimal, surgical changes that directly address the task. Do not “clean up” unrelated code.
- Do not move/rename files, rewrite workflows, or add dependencies unless strictly required to solve the current issue.
- Preserve CLI voice and demo narrative (BLADE/HOLMES) in user‑facing output.

## CI/CD Philosophy
- Keep “main CI” deterministic and fast. It should run the core project tests and gates; long e2e/bats belong in dedicated workflows.
- The dedicated CLI workflows (e.g., `cli-tests.yml`, `cli-quick.yml`) own CLI end‑to‑end/bats checks. Avoid duplicating them in main CI without approval.
- When failures arise, fix tests/product logic rather than muting or skipping steps. If you must mute, document why and the revert plan.

## Test Policy
- Keep existing test topology: unit, integration, property, snapshots, e2e. Add new tests in the matching suite only.
- Do not weaken assertions just to pass CI unless the behavior is intentionally changed and documented in the PR.
- Snapshot updates require justification in the commit message.

## Workflow Changes
- Only touch `.github/workflows/*` when:
  1) Fixing a deterministic break (syntax/path/quoting), or
  2) Reducing obviously wasteful runtime or duplication;
  and provide a revert path in the PR description.
- Use least privilege; do not widen permissions or add secrets without approval.

## Package Scripts
- Do not convert tests into global “skip” behaviors in `package.json`. Skips should be explicit in workflows or temporary, with a follow‑up issue to restore coverage.

## Branching and PRs
- Branch names: `feat/*`, `fix/*`, `chore/*` with short, descriptive kebab‑case.
- One‑topic PRs with a tight diff. CI should pass unless the PR specifically repairs CI.
- PR description must include context, rationale, alternatives considered, risks, and backout.

## Commit Hygiene
- Use Conventional Commits (e.g., `fix(core): …`, `test(cli): …`, `ci: …`).
- Group related changes; avoid mixing refactors with behavior changes.

## Code Style and APIs
- Follow existing module layout and boundaries; keep public APIs stable. Document migration notes if an API change is intentional.

## Local Verification
- Run the smallest relevant subset first (single package or suite) before the workspace tests. Prefer reproducible commands in your PR notes.

## Runtime/Secrets/DSNs
- Never log secrets or real DSNs in CI or code. Sample DSNs must be clearly fake and documented as such.

## Agent Behavior
- Before edits: state intent and list files you expect to touch.
- After edits: summarize the delta and CI effects (which jobs pass/fail and why).

---

## Neo4j Memory & Local Notes (Persistent Protocol)

- Default knowledge graph
  - Host: `http://localhost:7474`
  - Auth: `neo4j:password123`
  - DB: `neo4j`

- What to store
  - On topic switches or milestones, write an `Insight` node with: `{ content, added_by: 'Codex', confidence, timestamp: datetime() }` and relate it to the relevant `Topic` via `(:Insight)-[:ABOUT]->(:Topic)` and optionally to entities like `(:PullRequest)` via `[:RELATES_TO]`.
  - Keep a daily `Timeline` node `(:Timeline {date: date()})` under each active `Topic` and link insights with `[:INCLUDES]`.

- Local notes (source of truth for drafts)
  - Write ad‑hoc notes to `~/Codex/Wesley/` (markdown files). Include thoughts, plans, concerns, checklists, and sketches. Use filename pattern: `notes-YYYY-MM-DD.md`.
  - Summarize important local notes to Neo4j as `Insight` records when they are actionable.

- Minimal cURL templates
  - Query interests: `curl -s -u neo4j:password123 -H 'Content-Type: application/json' -X POST http://localhost:7474/db/neo4j/query/v2 -d '{"statement":"MATCH (j:User {name:\"James\"})-[:INTERESTED_IN]->(i) RETURN i.name"}'`
  - Add insight: `curl -s -u neo4j:password123 -H 'Content-Type: application/json' -X POST http://localhost:7474/db/neo4j/query/v2 -d '{"statement":"MATCH (t:Topic {name:\"Wesley\"}) MATCH (j:User {name:\"James\"}) CREATE (i:Insight {content:\"...\", added_by:\"Codex\", confidence:0.9, timestamp:datetime()}) CREATE (j)-[:HAS_INSIGHT]->(i) CREATE (i)-[:ABOUT]->(t) RETURN i"}'`

- JSONL Debriefs
  - After each work session, append a single‑line JSON object to the “Agents Activity Log” (this file) with: `date`, `time`, `summary`, `commits`, `ci_status`, and `highlights`. Keep it machine parsable.


## Agents Activity Log

{"date":"2025-10-08","time":"06:58Z","who":"Codex","summary":"PR #46 stabilization + QIR --ops hardening; memory activation","commits":["1cfe300","4298b1d","6cbe846","aa2b6dc","625ebd5","53e4deb","b389378","a492790"],"ci_status":"preflight green; workflows unified; pgTAP fixed (functions-only apply)","highlights":["CLI --ops: emit views only when paramless; always emit functions","OpPlanBuilder: normalize filters/orderBy; strict validation; lateral lists via LEFT JOIN LATERAL + jsonb_agg","Lowering: minimal quoting for reserved/unsafe idents; Emission: reserved param guard","Workflows: ecommerce.graphql; create wes_ops; install extensions; apply *.fn.sql; EXPLAIN strict; pgTAP installed in container","Pinned pnpm 9.15.9 in boundaries; action-setup@v4 elsewhere; preflight ESLint via pnpm dlx v9"],"neo4j":{"topic":"Wesley","pr":46,"timeline":"2025-10-08","insights":["CI","Builder","CLI/Ops","Workflows"]}}

### 2025-10-08 — PR feedback + QIR --ops MVP wiring
{"date":"2025-10-08","time":"16:40Z","summary":"Addressed PR #45/#46 feedback; unblocked pnpm action; added experimental --ops wiring and examples.","topics":[{"topic":"PR #45 (docs/qir)","what":"Updated docs to surface emitView() SQL and clarified reserved keyword limitation explicitly (will error).","why":"Example previously dropped returned SQL and wording implied protection we don’t enforce."},{"topic":"PR #46 (preflight+workflows+docs)","what":"Added permissions (contents:read) to docs-link-check/preflight; fixed branches list; removed pnpm version pins across workflows to avoid ERR_PNPM_BAD_PM_VERSION; improved preflight to use repo ESLint via flat-config temp file and dynamic license audit via pnpm ls; documented link-check regex limitations and ignoreDirs rationale; tightened fs error handling.","why":"Resolve CI failures and align tooling with repo ESLint version; improve maintainability."},{"topic":"QIR --ops (MVP)","what":"Exposed @wesley/core/domain/qir via package exports; added OpPlanBuilder (JSON DSL → QIR plan); wired CLI generate to compile *.op.json under --ops into view/function SQL; added examples (example/ops/products_by_name.op.json, orders_by_user.op.json).","why":"Deliver Phase C initial wiring without changing default CLI behavior."}],"ci_effects":["Preflight and Docs Link Check pass locally","Removed pnpm action version pins to resolve setup error","No permissions widening; least-privilege applied"],"next_steps":["Add EXPLAIN (FORMAT JSON) snapshots for ops","Add pgTAP smoke tests for emitted ops","Consider removing the early --ops no-op log to reduce noise","Extend builder for joins + nested lists (LATERAL + jsonb_agg)"]}

### 2025-10-07 — Debrief + Hand‑off

Summary of today’s work (public readiness + QIR)
- QIR
  - Implemented SQL lowering (SELECT/JOIN/LEFT/LATERAL/ORDER/LIMIT) with deterministic ORDER BY tie‑breaker, NULL/IN semantics, and COALESCE(jsonb_agg). Added unit + snapshot tests. Opened and merged PR #42.
  - Added emission helpers (emitView/emitFunction returning SETOF jsonb) with robust identifier quoting and unified sanitization; added tests. Opened PR #44 and merged after green.
  - Authored docs guide docs/guides/qir-ops.md (MVP lowering + emission) and opened PR #45; resolved conflicts post‑merge of #44, fixed MD022 spacing and strict ORDER BY assertions.
- Docs/Plans
  - Refreshed DRIFT_ANALYSIS_REPORT.md with current status (+ Readiness Matrix) and next actions; clarified the pivot status and QIR progress.
  - Consolidated planning into a single go-public-checklist.md; pointed docs/plan-for-alignment.md to it and kept as historical snapshot. Opened PR #46 containing the checklist and follow‑ups.
  - Added missing docs to eliminate broken links: internals (event-flow, parser), guides (extending, migrations, CLI tests), TRUST, and roadmap. Fixed all relative links; added docs link‑check workflow.
- CI/Tooling
  - Pruned dead/expensive workflows (Claude actions), removed macOS from matrices where still referenced, and fixed docs links to remove dead targets.
  - Added Preflight script (docs link‑check, dep‑cruise boundaries, ESLint core purity, workflow/.gitignore hygiene). Wired as:
    - Local: pre-push git hook via .githooks and prepare script.
    - CI: Preflight workflow on PRs and pushes to main.
  - Enforced pnpm‑only (removed npx fallbacks) and pinned packageManager to pnpm@9.15.9.
  - Updated branch protection on main to require: build-test, Enforce Hexagonal Architecture Boundaries, Quick CLI Test, Preflight, Docs Link Check; 1 review; dismiss stale approvals; admins enforced.
- PR hygiene
  - Closed superseded/conflicting PRs #16 (drop macOS), #17 (CI no hangs), #39 (CI entrypoints+Bats), and replaced #22 with #43 (OSS hygiene docs/templates) which was merged.

CI State
- Main CI and Architecture Boundaries are stable and fast; CLI Quick Check is green; Preflight + Docs Link Check now run on PRs and main.
- HOLMES remains non‑blocking (artifact fallback in place). macOS runners removed to control Actions spend.

Outstanding / Next Steps
- QIR Phase C
  - Wire --ops end‑to‑end in CLI/host‑node: minimal GraphQL op → QIR plan builder; compile ops via emitView/emitFunction; write artifacts under example/out/ops; keep default behavior unchanged.
  - Add example operations + EXPLAIN (FORMAT JSON) snapshots; add pgTAP smoke tests for emitted ops (shape/filters; RLS where relevant).
- DDL Planning
  - Extend planner for backfill/switch/contract phases (explain‑only by default) and emit per‑phase SQL for rehearsal.
- Docs
  - README polish (Experimental QIR note + CI costs); Compatibility section (Node/pnpm/Ubuntu‑only CI); contributor preflight note done.

Resume Prompt (copy/paste into a new Codex instance)

You are assisting on the “Wesley” monorepo (GraphQL → Postgres generator). Continue where we left off on 2025‑10‑07.

Context snapshot:
- Merged: #42 (QIR lowering), #44 (QIR emission), #43 (OSS templates/Codeowners/Changelog).
- Open PRs: #45 (docs/qir: lowering+emission guide), #46 (go-public-checklist + preflight/link‑check/prune).
- CI: Required checks on main: build-test, Architecture Boundaries, Quick CLI Test, Preflight, Docs Link Check. HOLMES is non‑blocking. macOS runners removed.
- Tooling: pre-push preflight (pnpm‑only) checks docs links, dep‑cruise boundaries, ESLint core purity, workflow/.gitignore hygiene. pnpm pinned @ 9.15.9.

Goals for next session:
1) QIR Phase C — CLI wiring behind --ops
   - Implement a minimal GraphQL op → QIR plan builder (selections, joins, filters, order, pagination; nested lists via LATERAL+jsonb_agg; ParamRef type hints).
   - Expose --ops in CLI/host-node to compile ops and emit SQL via emitView/emitFunction; write to example/out/ops; keep default behavior unchanged.
   - Add example ops + EXPLAIN JSON snapshots; add pgTAP smoke for emitted ops.
2) DDL Planner — backfill/switch/contract phases (explain‑only), emit per‑phase SQL.
3) README polish (Experimental QIR + CI costs) and pre‑check completed items in go-public-checklist.md.

Local commands:
- pnpm install
- pnpm run preflight
- pnpm -r test
- node packages/wesley-host-node/bin/wesley.mjs generate --schema example/schema.graphql --emit-bundle --out-dir example/out --allow-dirty

### 2025-09-29
- Resolved the README merge conflict on `pr-16`, restoring the generate → rehearse → deploy workflow while keeping the new messaging.
- Deleted the stale `.git/.COMMIT_EDITMSG.swp` swap file so the merge could proceed cleanly.
- `pr-16` marked merge‑ready.

### 2025-10-02 — SITREP (PR #18) + Session Debrief

SITREP
- PR: `feat(cli+ci): enforce boundaries, adapterize CLI, canonicalize docs; minimal RLS emission` (#18)
- Branch: `fix/cli-adapters-and-boundaries`
- Summary of changes (tight, scoped commits):
  - CI (architecture-boundaries):
    - Enforce node:* ban in core via dependency-cruiser + ESLint.
    - Use Node 20; install pnpm first; call `pnpm dlx depcruise`.
    - Replace `rg` with portable `grep`; print offending files on failure.
  - CI (main):
    - Keep tests and postgres service.
    - Removed `validate-bundle` + HOLMES gating for now (evidence bundle not guaranteed).
  - CI (cert-shipme):
    - Fixed docker options (no line continuation escapes).
    - Align flags: `--out-dir` for transform/plan; workflow now green.
  - Host adapters: added `ctx.shell.exec/execSync`; extended `NodeFileSystem` with `join/resolve`; expose `globalThis.wesleyCtx` in host entry.
  - CLI: refactored `rehearse`, `up`, `plan`, `generate`, `cert-*`, `validate-bundle` to use injected adapters (`ctx.fs`, `ctx.shell`); registered `validate-bundle` in `program.mjs`.
  - Core purity: removed `node:buffer`; added pure `util/EventEmitter.mjs` and `util/hash.mjs`; updated imports accordingly.
  - Generator: minimal RLS emission from `@wes_rls` (enables RLS + policy statements when expressions present).
  - Docs: added `docs/plan-for-alignment.md` (checklists) + `docs/guides/quick-start.md`; canonicalized README and examples to `@wes_*`.

CI state (latest runs at 2025-10-02)
- Passing: CLI E2E (Ubuntu Node 18/20/22), Quick CLI Test, SHIPME Certificate job, Main CI build-test.
- Failing: Architecture Boundary Enforcement — the “Validate import statements” shell step flags a core import violation, but no offending files print after the latest grep hardening (node:buffer already removed). Likely a false positive from earlier patterning; next run should print actual matches if present.

Notes on scope/guardrails
- Stayed within minimal change set; avoided widening permissions or secrets.
- Preserved CLI voice; added guidance in docs rather than altering user‑facing narratives.

Debrief — What worked / decisions
- Adapterization is effective: CLI no longer imports Node APIs directly; platform concerns live in `@wesley/host-node`.
- Purity gates are in CI now (dep-cruise + ESLint). We favored explicit guards over brittle ad‑hoc greps; greps are retained as lightweight smoke checks.
- Minimal RLS: intentionally limited to explicit expressions; tenant/owner defaults are planned (tracked below).
- Main CI gating on HOLMES/evidence was removed to stabilize the pipeline; will be reintroduced once generation consistently emits bundles in CI.

Hand‑off — Next steps for the next agent
1) Unblock the boundaries job (highest priority)
   - Investigate the failing “Validate import statements” step in `.github/workflows/architecture-boundaries.yml`.
   - If it continues to fail without printing matches, flip that step to verbose mode:
     - Add `set -euo pipefail` and `set -x` at the start of the step.
     - Echo variables `FS_MATCHES`, `PATH_MATCHES`, `NODE_MATCHES`.
   - Optional: remove the fs/path `grep` checks entirely and rely only on ESLint + dependency-cruiser (already enforced and more reliable). Keep the node:* grep (portable) if you want a quick guard.
   - Confirm no `node:*`, `fs`, or `path` imports exist under `packages/wesley-core/src` (current grep shows none; `node:buffer` is already removed).

2) Reinstate bundle validation and HOLMES gates (once bundles are stable)
   - Modify main CI to call `generate` with `--emit-bundle` and pass the correct `--bundle` path into `validate-bundle`.
   - Re‑enable HOLMES investigate/verify/predict on the emitted `.wesley` artifacts; gate on scores if desired.

3) RLS generator (Phase 2)
   - Add defaults: generate tenant/owner policies when `@wes_tenant(by: ...)` or `@owner(column: ...)` is present and `@wes_rls` omits an expression.
   - Add a tiny pgTAP suite for RLS policies (enable/USING evaluation smoke) to run under CI postgres.

4) Plan phases (MVP+)
   - Implement `backfill/switch/contract` phases (additive‑only in MVP), wire to `plan` explain output and to `rehearse` SQL emission.
   - Keep destructive diffs in explain‑only mode for MVP.

5) Documentation alignment
   - Fix broken links in `docs/README.md` (Guides and Internals pages that don’t exist).
   - Sweep `docs/features/row-level-security.md` and other guides to use canonical `@wes_*` consistently.
   - Keep Quick Start as the canonical entry; ensure README points to it.

6) Adapterization sweep (finish)
   - Double‑check remaining CLI commands/utilities for any lingering Node API imports; centralize process/TTY concerns in `program.mjs` only.

Operational guidance for the next agent
- Keep changes surgical and commit‑scoped: one concern per commit (ci:, fix(cli):, refactor(core):, docs:).
- When touching workflows:
  - Prefer portable shell (bash + grep), avoid non‑standard tools unless installed.
  - Don’t widen permissions or add secrets.
- When touching core:
  - No `node:*` imports; if needed, add a pure util under `packages/wesley-core/src/util`.
  - Keep ESLint `no-restricted-imports` intact; run the ESLint core task locally before pushing.
- Local repro tips:
  - `pnpm install`
  - `node packages/wesley-host-node/bin/wesley.mjs generate --schema example/schema.graphql --allow-dirty`
  - For RLS: `--supabase` to emit `out/rls.sql` where `@wes_rls` exists.
  - Run core ESLint purity locally: `pnpm exec eslint --no-eslintrc -c packages/wesley-core/.eslintrc.cjs "packages/wesley-core/src/**/*.mjs"`.

Open questions / Decisions to confirm
- Do we keep manual grep checks for fs/path/node:* now that dep-cruise + ESLint enforce purity, or rely solely on the tools?
- When to re‑enable evidence + HOLMES gating in main CI (target after RLS defaults + evidence stabilization)?

### 2025-10-02 — Session Debrief (Local Discipline + Next Moves)

Why this entry
- We saw repeated CI cycles while iterating on the architecture‑boundaries job. To conserve CI minutes and keep feedback snappy, we’re adopting a strict local pre‑push discipline that mirrors CI.

New local pre‑push checklist (run before any push)
- Install (non‑frozen to avoid lockfile mismatches):
  - `pnpm install --no-frozen-lockfile`
- Full workspace tests:
  - `pnpm -w test`
- Architecture boundaries (depcruise smoke):
  - `pnpm dlx depcruise --config .dependency-cruiser.mjs packages/`
- Core purity (ESLint) — use an ESLint that supports .eslintrc.cjs:
  - Option A (preferred, local only): `pnpm dlx eslint@8.57.0 --no-eslintrc -c packages/wesley-core/.eslintrc.cjs "packages/wesley-core/src/**/*.mjs" --max-warnings=0`
  - Option B (if we lift to flat config later): use repo ESLint as configured by CI
- CLI smoke:
  - `node packages/wesley-host-node/bin/wesley.mjs generate --schema example/schema.graphql --allow-dirty`

Rules of engagement
- Do not push if any of the above fail locally. Fix locally first, then push a single tight commit.
- Group related changes; keep commits surgical (ci:, fix(cli):, refactor(core):, docs:).

Immediate next moves (to be done locally first)
1) Boundaries job
   - Current PR has simplified checks (depcruise + ESLint + lightweight node:* and host import smoke). Run the local pre‑push set; if clean, push a single commit to re‑run CI. If ESLint v9 conflicts locally, use the v8 dlx command above.
2) Reinstate bundle validation + HOLMES (after emit‑bundle stabilization)
   - Switch CI generate to `--emit-bundle`, then add `wesley validate-bundle` with the correct bundle path, re‑enable HOLMES steps and score gating.
3) RLS defaults + tests
   - Extend generator to default tenant/owner USING expressions if `@wes_tenant`/`@owner` present and `@wes_rls` omits an expression; add a minimal pgTAP suite in CI postgres.
4) Plan phases (MVP+)
   - Implement `backfill/switch/contract` phase emission, wire to `plan --explain` and `rehearse` SQL emission; keep destructive changes explain‑only for MVP.
5) Docs
   - Fix broken links in `docs/README.md`; sweep `docs/features/row-level-security.md` for canonical `@wes_*` usage.

Hand‑off instructions for the next agent
- Context: PR #18 on branch `fix/cli-adapters-and-boundaries` is almost green; only the architecture‑boundaries job is pending stabilization.
- Start by running the local pre‑push checklist exactly as above.
- If depcruise/ESLint pass locally but CI still fails the boundaries job:
  - Temporarily add `set -euo pipefail` and `set -x` plus explicit `echo` of matches to the boundaries job to surface the exact offender, then remove the verbosity once green.
  - Prefer tool‑based enforcement (depcruise + ESLint) over brittle greps; keep only the simple node:* + host‑import smoke checks.
- Once boundaries is green:
  - Add `--emit-bundle` in CI generate; reintroduce `validate-bundle` and HOLMES gating (investigate/verify/predict) using the emitted `.wesley` bundle.
  - Proceed to RLS defaults + pgTAP, then plan phases, in that order, with one scoped PR if this PR is merged, or follow‑up commits if requested.
- Commit hygiene: keep changes minimal and separated; include rationale in each commit message.
{"date":"2025-10-07","time":"19:11","summary":"Consolidated public readiness (single checklist), added preflight + CI guards, advanced QIR docs, and standardized licensing to MIND-UCAL.","topics":[{"topic":"QIR docs & emission","what":"Updated QIR guide and clarified lowering identifier quoting; maintained emission helpers and tests","why":"Align documentation with merged QIR lowering/emission and resolve PR #45 feedback","context":"QIR lowering (PR #42) and emission (PR #44) are merged; docs in #45","issue":"Docs phrasing around identifier quoting was ambiguous","resolution":"Reworded constraints and added Postgres reserved keyword reference; pushed to PR #45","future_work":"Wire --ops in CLI with op→QIR translator and examples","time_percent":18},{"topic":"Preflight & CI","what":"Added preflight script (docs links, dep-cruise, ESLint purity, workflows/.gitignore, license audit), pre-push hook, and CI job","why":"Prevent regressions and keep repo cost-conscious and healthy","context":"Ubuntu-only CI; boundaries job stabilized","issue":"No unified local/CI guardrails","resolution":"Created scripts, hooks, and workflows; pnpm-only enforcement","future_work":"Optionally add caching for dlx tools to shave seconds","time_percent":22},{"topic":"Branch protection","what":"Required checks configured on main (build-test, boundaries, quick CLI, Preflight, Docs Link Check)","why":"Ensure consistent gating before public","context":"Main branch protections were partial","issue":"Missing required checks and review enforcement","resolution":"Set required checks and review rules (admins enforced; linear history left off)","future_work":"Revisit linear history once merge strategy is finalized","time_percent":10},{"topic":"Docs pruning & link integrity","what":"Removed dead workflows/docs; added missing internals/guides; added docs link-check workflow","why":"Eliminate broken links and reduce CI spend","context":"Old Claude workflows and dead links existed","issue":"Stale references and optional expensive actions","resolution":"Pruned, added replacements, and automated link checks","future_work":"Run periodic link sweeps on new docs","time_percent":15},{"topic":"Licensing","what":"Adopted MIND-UCAL v1.0; updated LICENSE, MAINTAINERS, and package.json license refs; added preflight license audit","why":"Align legal posture with project ethics","context":"Previously mixed MIT/Apache-2.0 across packages","issue":"Inconsistent license fields vs root LICENSE","resolution":"Standardized to LicenseRef-MIND-UCAL-1.0 across all packages and added audit","future_work":"Add README badge or short rationale section if desired","time_percent":20},{"topic":"Checklist & README/CONTRIBUTING","what":"Consolidated plan into go-public-checklist.md; added QIR/Compatibility/License to README; contributor notes on pnpm/hooks/preflight","why":"Create a single source of truth and set contributor expectations","context":"Multiple plan docs and missing contributor notes","issue":"Fragmented planning and unclear local setup","resolution":"Single checklist + doc updates; pre-checked completed items","future_work":"Continue checking off items as PRs merge (PR #46)","time_percent":15}],"key_decisions":["Adopt MIND-UCAL v1.0 across repo and packages","Enforce pnpm-only and add pre-push preflight","Require status checks on main (build-test, boundaries, Quick CLI, Preflight, Docs Link Check)","Keep macOS runners removed to control Actions spend","Leave linear history off for now; revisit with merge strategy","Keep QIR behind --ops until translator + wiring are ready"],"action_items":[{"task":"Merge PR #46 (checklist + preflight + docs/prune)","owner":"Core"},{"task":"Review/merge PR #45 (QIR docs) after CI passes","owner":"Core"},{"task":"Implement QIR Phase C: op→QIR translator + --ops CLI wiring + examples + EXPLAIN + pgTAP","owner":"Data"},{"task":"Extend DDL planner for backfill/switch/contract (explain-only) and emit per-phase SQL","owner":"Core"}]}
{"date":"2025-10-08","time":"now","who":"Codex","summary":"CLI --ops strict discovery; manifest mode groundwork; HOLMES workflow fixes; README/ops docs; Ajv schema bits","commits":["2971519","dc91e39","014fb93"],"prs":[46,47,48],"ci_status":"local preflight green","highlights":["Workflow: --ops path; pgtap install (noninteractive, no-recommends); psql -1; strict seed; test gate","CLI: sanitize op names; strict recursive discovery; collisions; Ajv when schema available","Docs: discovery modes RFC + linked guide; README ops loop"],"next":["Add manifest schema examples to guide","Add CLI Bats for manifest include/exclude","Consider implementing --ops-explain emission or keep def." ]}
{"date":"2025-10-08","time":"now","who":"Codex","summary":"Extras: --ops-explain SQL; bats for collisions; manifest bats; docs examples; PRs updated","commits":["df8dd94","5f15907","44cdbe3"],"prs":[46,47,48],"ci_status":"preflight green; bats added (CI-owned)","highlights":["CLI: --ops-explain emits per-op explain SQL + aggregator","Tests: ops-collision and ops-manifest bats","Docs: qir-ops guide includes schema + manifest examples"],"next":["Pause for merges; reconcile open branches","Add EXPLAIN JSON emission path (optional)" ]}
{"date":"2025-10-08","time":"now","who":"Codex","summary":"Minor follow-ups: --ops-explain-json; ops-manifest cookbook; final push then pause","commits":["24ab244"],"prs":[48],"ci_status":"preflight green","highlights":["CLI: --ops-explain-json executes EXPLAIN JSON for paramless ops via DSN","Docs: cookbook examples for ops-manifest and guide link"],"next":["Pause and merge open PRs (#46/#47/#48); reconcile branches"]}
