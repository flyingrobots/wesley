# Go Public Checklist (Wesley)

This checklist tracks the remaining work before we “go public” and the follow‑on QIR milestones. Check off items as they are completed. Keep changes surgical per AGENTS.md.

## Repo Readiness — Must
- [ ] Tighten README messaging; add “Experimental QIR” pointer to `docs/guides/qir-ops.md`.
- [ ] Add a Compatibility section to README (Node 18/20/22, pnpm 9, Ubuntu-only CI).
- [ ] Mark required checks on `main` (branch protection): CI build-test, Architecture Boundary Enforcement, CLI Quick Check.
- [ ] Keep SHIPME/HOLMES non-blocking until bundles are consistently present.
- [ ] Enable branch protection rules: require PRs, reviews, dismiss stale approvals, linear history (merge).
- [ ] Verify `.wesley/` and `example/out/` are ignored from source control; no secrets/DSNs anywhere.
- [ ] Confirm LICENSE at root and license fields across package.json files (audit all packages).
- [ ] Confirm `.github/pull_request_template.md` and `CODEOWNERS` present and correct.
- [ ] Review SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md for clarity/links.
- [ ] Guard or remove remaining Claude workflows (jsdoc/claude.yml) to avoid spend on forks; ensure actions are pinned.
- [ ] Prepare v0.1.0 release: tag, GitHub Release notes linking README + Quick Start.

## Repo Readiness — Should
- [ ] Add label mappings in ISSUE_TEMPLATE (bug/feature/chore/rfc) and default labels.
- [ ] Configure Dependabot/Renovate for actions and dev deps (weekly cadence).
- [ ] Audit package metadata: ensure `private: true` where not publishable; set `name`, `repository`, `bugs`, `homepage` fields.
- [ ] Docs polish: link Quick Start prominently from README; add “What’s generated” visual; add CI costs note explaining no macOS.

## Repo Readiness — Nice to Have
- [ ] Minimal docs site (Pages/Docusaurus) mirroring README + guides.
- [ ] Contributor onramp: label starter issues (good first issue) and open a “Roadmap” issue.

## Migrations & Planning (DDL)
- [ ] Extend migration planning to cover backfill/switch/contract phases (explain‑only by default).
- [ ] Emit per‑phase SQL files for rehearsal beyond expand/validate.

## QIR — Phase C (CLI Wiring, Examples)
- [ ] Wire `--ops` in CLI/host-node to compile operations → QIR → SQL via `emitView`/`emitFunction` (keep default behavior unchanged).
- [ ] Implement minimal GraphQL operation → QIR plan builder:
  - [ ] Resolve root table, selected columns/joins.
  - [ ] Nested lists → LATERAL + `jsonb_agg`.
  - [ ] Variables → `ParamRef` with type hints.
  - [ ] WHERE/ORDER/LIMIT/OFFSET mapping to Predicate/OrderBy.
- [ ] Replace ORDER BY tie-breaker heuristic with actual PK/unique keys from Schema metadata.
- [ ] Add example operations under `example/ops/` and emit SQL to `example/out/ops/`.
- [ ] Add EXPLAIN (FORMAT JSON) snapshots for emitted SQL.
- [ ] Add pgTAP smoke tests for emitted views/functions (shape, filtering); include RLS cases when applicable.
- [ ] Update docs: add “Using --ops via CLI” section to `docs/guides/qir-ops.md` and link from Quick Start.

## QIR — Phase D (Enhancements)
- [ ] Add DISTINCT ON support and pagination helpers (cursor-based option).
- [ ] Option to emit `RETURNS TABLE (...)` for function signatures (keep jsonb default).
- [ ] Diagnostics: EXPLAIN JSON analysis + optional HOLMES gating in dedicated workflow.
- [ ] Security hardening: exhaustive param-safety tests; ensure no string concatenation for params in lowering.

## Docs IA & Roadmap
- [ ] Consolidate docs IA (Concepts / How‑To / Reference / Internals / Roadmap); prune dead links.
- [ ] Surface Vision/Milestones under `docs/roadmap/` with a one‑screen “Now” status.

## Public Launch — Short Plan
- [ ] README note + CI costs note (why Ubuntu-only).
- [ ] Guard/remove remaining Claude workflows.
- [ ] Set required checks and branch protection on `main`.
- [ ] Tag release + publish Release notes.
- [ ] Minimal ops→QIR translator + `--ops` path (Phase C).
- [ ] Example ops + snapshots (SQL + EXPLAIN JSON).
- [ ] pgTAP smoke for ops emission.
- [ ] Docs update for CLI `--ops` usage.
