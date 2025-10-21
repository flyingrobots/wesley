# Plan for Alignment (Consolidated)

This plan has been consolidated into a single living checklist: `go-public-checklist.md` at the repo root. Please use that document for all task tracking (public readiness + QIR milestones).

Link: ../go-public-checklist.md

## Consistency Remediation
- [x] Normalize directive namespace to canonical `@wes_*` across README and examples (pass completed; continue sweeping edge cases).
- [x] Document aliases + deprecation (prefer `@wes_*`; legacy forms accepted with warnings where present).
- [x] Unify install/usage: use `node packages/wesley-host-node/bin/wesley.mjs` in repo and `@wesley/cli` for global.
- [x] Fix broken/missing docs links in `docs/README.md`; added `docs/guides/quick-start.md` and linked.
- [x] Redirect/replace empty `holmes.md` with workflow-produced report (kept as placeholder, now populated by CI).
- [x] Update config weights to canonical directive names (mapping preserved for legacy).
- [x] Replace `QUICK_START.md` with maintained guide under `docs/guides/quick-start.md`.
- [x] Ensure examples remove stale assets.

## Feature Completion (MVP Vertical Slice)
- [x] Implement minimal RLS generation for core patterns (tenant/owner/shared); extend presets as needed.
- [ ] Extend migration planning to cover backfill/switch/contract (explain mode safe by default).
- [ ] Wire plan phases to emit SQL files per phase for rehearsal (beyond expand/validate).
- [x] Compute SCS/MRI/TCI in `.wesley/scores.json`; validate via schemas (present — gating kept non-blocking).
- [x] Strengthen certificate flow: evidence+REALM artifacts emitted; verification CLI in place (further hardening optional).

## Architecture Alignment
- [x] Remove Node built-ins from core (pure domain). Add pure utils (EventEmitter/hash) where needed.
- [x] dependency-cruiser rule blocks `^node:` imports in core.
- [x] ESLint no-restricted-imports for core (node:*, process, fs, path, etc.).
- [x] CLI refactored to injected adapters (generate/plan/rehearse/up/cert/validate-bundle).
- [x] Host-node owns OS/db/fs interactions; `ctx.shell` available for CLI commands.

## Documentation IA Alignment
- [x] `docs/guides/quick-start.md` created; linked from docs/README.md and root README.
- [ ] Consolidate IA: Concepts / How-To / Reference / Internals / Roadmap (continue pruning dead links).
- [x] Snippets use canonical `@wes_*`; aliases explained once.

## CI/Enforcement
- [x] `.dependency-cruiser.mjs` enforces boundaries in CI.
- [x] ESLint core config added; purity enforced via CI step.
- [x] Architecture Boundary job stabilized (tool-based checks + light smoke).
- [x] Main CI kept lean; CLI E2E and quick checks in dedicated workflows; macOS removed to control Actions cost.

## Roadmap & Issues
- [ ] Surface Vision/Milestones under `docs/roadmap/` with a one-screen “Now” status.
- [x] Create `go-public-checklist.md` as the single source of truth for public readiness and QIR tasks.

## File-Level Tasks (Initial Pass)
- [x] Update README examples to `@wes_*` forms.
- [x] Update `test/fixtures/examples/*.graphql` to canonical directives.
- [x] Add `docs/guides/quick-start.md`; reference host-node CLI entry.
- [x] Add `packages/wesley-core/.eslintrc.cjs` with `no-restricted-imports`.
- [x] Update `.dependency-cruiser.mjs` to forbid `^node:` in core.
- [x] Add `ctx.shell` to host-node and refactor `rehearse`/`up` to use it.

## QIR Alignment Addendum
- [x] Lowering: SELECT/JOIN/LEFT/LATERAL/ORDER BY/LIMIT/OFFSET; NULL/IN/ANY; COALESCE jsonb_agg; deterministic tie-breaker.
- [x] Emission: CREATE VIEW + SQL function (RETURNS SETOF jsonb) with deterministic names/params; robust quoting.
- [ ] Translator: map GraphQL operations → QIR plans (selections, joins, filters, order, pagination, nested lists).
- [ ] CLI wiring: `--ops` path to compile and emit ops; write artifacts to out/examples/ops.
- [ ] Examples + EXPLAIN JSON snapshots; pgTAP smoke for emitted ops (shape, filters, RLS where relevant).

---

Owner: Core team  
Review cadence: Weekly until MVP sign-off  
Target: Public MVP with BLADE demo and experimental QIR behind `--ops`
