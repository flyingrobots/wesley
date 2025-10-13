# Go Public Checklist (Wesley)

This checklist tracks the remaining work before we “go public” and the follow‑on QIR milestones. Check off items as they are completed. Keep changes surgical per AGENTS.md.

## HOLMES Scoring Enhancements — Must
- [ ] [#52](https://github.com/flyingrobots/wesley/issues/52) Decompose SCS/TCI/MRI into sub-metrics and expose breakdowns in HOLMES JSON/markdown/dashboard.
- [ ] [#53](https://github.com/flyingrobots/wesley/issues/53) Load declarative weights from `.wesley/weights.json` with documented precedence.
- [ ] [#54](https://github.com/flyingrobots/wesley/issues/54) Honor `@wes_evidence` (or equivalent) so scoring respects contextual evidence requirements.
- [ ] [#55](https://github.com/flyingrobots/wesley/issues/55) Enrich dashboard insights (why/volatility/balancing metrics/celebrate improvements).
- [ ] [#56](https://github.com/flyingrobots/wesley/issues/56) Track ops end-to-end evidence so TCI `e2e_ops` coverage reflects real tests.
- [ ] [#57](https://github.com/flyingrobots/wesley/issues/57) Ensure quick CLI `--emit-bundle` uses real scoring or clearly marks partial bundles.

## Repo Readiness — Must
- [x] Tighten README messaging; add “Experimental QIR” pointer to `docs/guides/qir-ops.md`.
- [x] Add a Compatibility section to README (Node 18/20/22, pnpm 9, Ubuntu-only CI).
- [x] Mark required checks on `main` (branch protection): CI build-test, Architecture Boundary Enforcement, CLI Quick Check, Preflight, Docs Link Check.
- [x] Keep SHIPME/HOLMES non-blocking until bundles are consistently present.
- [ ] [#58](https://github.com/flyingrobots/wesley/issues/58) Decide whether to enforce linear history on `main` before launch.
- [ ] Enable branch protection rules:
  - [x] Require PR reviews (≥1)
  - [x] Dismiss stale approvals on new commits
  - [x] Enforce admins
  - [ ] Enforce linear history (left disabled to support merge strategy)
- [x] Verify `.wesley/` and `example/out/` are ignored from source control; no secrets/DSNs anywhere.
- [x] Confirm LICENSE at root and license fields across package.json files (audit all packages).
- [x] Confirm `.github/pull_request_template.md` and `CODEOWNERS` present and correct.
- [ ] [#59](https://github.com/flyingrobots/wesley/issues/59) Refresh SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md links and guidance.
- [x] Guard or remove remaining Claude workflows (jsdoc/claude.yml) to avoid spend on forks; ensure actions are pinned.
- [ ] [#60](https://github.com/flyingrobots/wesley/issues/60) Prepare v0.1.0 release (notes + tag).

## Repo Readiness — Should
- [ ] [#36](https://github.com/flyingrobots/wesley/issues/36) Add default label set and wire issue template mappings.
- [ ] [#29](https://github.com/flyingrobots/wesley/issues/29) Configure Dependabot/Renovate for actions and dev deps.
- [ ] [#61](https://github.com/flyingrobots/wesley/issues/61) Audit package metadata for publish flags and URLs.
- [ ] [#62](https://github.com/flyingrobots/wesley/issues/62) Polish landing docs (Quick Start link, visual, CI costs note).

## Repo Readiness — Nice to Have
- [ ] [#63](https://github.com/flyingrobots/wesley/issues/63) Publish minimal docs site (Pages/Docusaurus) mirroring README + guides.
- [ ] [#64](https://github.com/flyingrobots/wesley/issues/64) Create contributor onramp (starter issues + roadmap).

## Migrations & Planning (DDL)
- [ ] [#65](https://github.com/flyingrobots/wesley/issues/65) Extend migration planning to cover backfill/switch/contract phases (explain-only).
- [ ] [#66](https://github.com/flyingrobots/wesley/issues/66) Emit per-phase SQL files for rehearsal beyond expand/validate.

## QIR — Phase C (CLI Wiring, Examples)
- [x] Wire `--ops` in CLI/host-node to compile operations → QIR → SQL via `emitView`/`emitFunction` (keep default behavior unchanged).
- [ ] [#67](https://github.com/flyingrobots/wesley/issues/67) Implement minimal GraphQL operation → QIR plan builder:
  - [x] Resolve root table, selected columns (joins pending).
  - [x] Nested lists → LATERAL + `jsonb_agg`.
  - [x] Variables → `ParamRef` with type hints.
  - [x] WHERE/ORDER/LIMIT/OFFSET mapping to Predicate/OrderBy.
- [ ] [#68](https://github.com/flyingrobots/wesley/issues/68) Replace ORDER BY tie-breaker heuristic with actual PK/unique keys from Schema metadata.
- [x] Add example operations under `example/ops/` and emit SQL to `example/out/ops/`.
- [x] Add EXPLAIN (FORMAT JSON) snapshots for emitted SQL (generated in CI and uploaded as artifact).
- [x] Add pgTAP smoke tests for emitted views/functions (basic existence + filter behavior; skips if pgtap unavailable). RLS cases TBD.
- [ ] [#69](https://github.com/flyingrobots/wesley/issues/69) Update docs with a “Using --ops via CLI” section and link from Quick Start.

## QIR — Phase D (Enhancements)
- [ ] [#70](https://github.com/flyingrobots/wesley/issues/70) Add DISTINCT ON support and pagination helpers (cursor-based option).
- [ ] [#71](https://github.com/flyingrobots/wesley/issues/71) Optionally emit `RETURNS TABLE (...)` signatures for generated ops.
- [ ] [#72](https://github.com/flyingrobots/wesley/issues/72) Add EXPLAIN JSON diagnostics + optional HOLMES gating workflow.
- [ ] [#73](https://github.com/flyingrobots/wesley/issues/73) Security hardening: exhaustive param-safety tests / no string concatenation.
- [ ] [#74](https://github.com/flyingrobots/wesley/issues/74) Identifier safety: reserved keywords, 63-char limits, configurable quoting.

## Docs IA & Roadmap
- [ ] [#75](https://github.com/flyingrobots/wesley/issues/75) Consolidate docs IA (Concepts / How-To / Reference / Internals / Roadmap); prune dead links.
- [x] Surface Vision/Milestones under `docs/roadmap/` with a one‑screen “Now” status.

## Public Launch — Short Plan
- [x] README note + CI costs note (why Ubuntu-only).
- [x] Guard/remove remaining Claude workflows.
- [x] Set required checks and branch protection on `main`.
- [ ] [#60](https://github.com/flyingrobots/wesley/issues/60) Tag release + publish release notes.
- [ ] [#67](https://github.com/flyingrobots/wesley/issues/67) Minimal ops→QIR translator + `--ops` path (Phase C).
- [x] Example ops + snapshots (SQL + EXPLAIN JSON).
- [x] pgTAP smoke for ops emission.
- [ ] [#69](https://github.com/flyingrobots/wesley/issues/69) Docs update for CLI `--ops` usage.
