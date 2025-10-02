# Plan for Alignment with Vision

This document tracks the concrete actions needed to bring the repository into alignment with its stated vision and guardrails. Each item is a checklist entry; we’ll check them off as work lands on main.

## Consistency Remediation
- [ ] Normalize directive namespace to canonical `@wes_*` across README and examples.
- [ ] Clearly document aliases and deprecation timeline (prefer `@wes_*`; accept `@wesley_*` and bare forms with warnings).
- [ ] Unify install/usage instructions (single blessed path; make clear the actual executable is provided by `@wesley/host-node`).
- [ ] Fix broken/missing docs links in `docs/README.md` (remove or add pages for `guides/*`, `internals/event-flow.md`, `internals/parser.md`).
- [ ] Remove or redirect the empty `holmes.md` at repo root to real docs.
- [ ] Update `wesley.config.mjs` weights to use canonical directive names (`@wes_pk`, `@wes_fk`, etc.) or clearly map legacy names.
- [ ] Correct `QUICK_START.md` inaccuracies or replace with a living guide under `docs/guides/quick-start.md`.
- [ ] Ensure examples do not reference removed assets (e.g., `example/demo.sh`).

## Feature Completion (MVP Vertical Slice)
- [ ] Implement RLS generation in `@wesley/generator-supabase` for core patterns (tenant, owner, shared) to match docs.
- [ ] Extend migration planning to cover backfill/switch/contract phases with explain output.
- [ ] Wire plan phases to emit corresponding SQL files for rehearsal beyond expand/validate.
- [ ] Compute and write SCS/MRI/TCI based on generated artifacts; validate via schemas.
- [ ] Strengthen certificate flow: verify evidence + REALM verdicts and basic signer plumbing in CLI/HOLMES.

## Architecture Alignment
- [ ] Remove all Node built-in imports from `@wesley/core` (e.g., `node:buffer`), keeping core pure.
- [ ] Add dependency-cruiser rule to block `^node:` imports from `packages/wesley-core/src`.
- [ ] Add ESLint no-restricted-imports for core (block `node:*`, `process`, `fs`, `path`, etc.).
- [ ] Refactor CLI commands to use injected adapters only (no direct `node:*`); start with `rehearse` and `up`.
- [ ] Keep OS/db/filesystem interactions in `@wesley/host-node` adapters; expose a minimal `ctx.shell` wrapper for CLI.

## Documentation IA Alignment
- [ ] Create `docs/guides/quick-start.md` and make `docs/README.md` link valid.
- [ ] Consolidate the IA to Concepts, How-To, Reference, Internals, Roadmap (no dead links).
- [ ] Lead all snippets with canonical `@wes_*`; explain aliases once.

## CI/Enforcement
- [ ] Update `.dependency-cruiser.mjs` to catch `^node:` and enforce no Node imports in core.
- [ ] Add ESLint config scoped to `packages/wesley-core` to block node APIs and process usage.
- [ ] Add CI step that fails on boundary violations (imports and node:* usage) in core and CLI.
- [ ] Keep main CI lean; ensure CLI e2e stays in dedicated workflows.

## Roadmap & Issues
- [ ] Surface Vision/Milestones under `docs/roadmap/` with a one-screen “Now” status.
- [ ] Mirror MVP tasks from this plan into GitHub Issues with labels (if repo visibility permits).

## File-Level Tasks (Initial Pass)
- [ ] Replace directive usage in `README.md` examples to `@wes_*` where applicable.
- [ ] Update `example/*.graphql` to canonical directives (table/pk/fk/index/default), and prefer `@wes_rls`.
- [ ] Add `docs/guides/quick-start.md` and point users at `@wesley/host-node` CLI entry.
- [ ] Add `packages/wesley-core/.eslintrc.cjs` with `no-restricted-imports`.
- [ ] Update `.dependency-cruiser.mjs` to forbid `^node:` in core.
- [ ] Add `ctx.shell` to host-node runtime and refactor `rehearse`/`up` commands to use it.

---

Owner: Core team  
Review cadence: Weekly until MVP sign-off  
Target: MVP ready with BLADE demo at production-parity locks

