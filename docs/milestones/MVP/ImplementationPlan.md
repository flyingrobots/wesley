# MVP Implementation Plan

This plan ships a minimal, credible vertical slice: Transform → Plan → Rehearse → Certify.

## Phase 1 — Contracts & Wiring
- Canonical IR schema (JSON) shared by parser/generators; contract tests
- Wire Node runtime to use real `GraphQLAdapter.parse` (remove stub)
- Unify CLI entry (`program.mjs`); introduce `wesley transform` (alias `generate`)
- Fix broken exports in `@wesley/tasks` and `@wesley/slaps` (remove phantoms)

Exit criteria:
- Transform uses real IR; evidence bundle validates
- CLI help shows `transform`, `plan`, `rehearse`, `cert`

## Phase 2 — Generators (Minimum Useful)
- Postgres DDL: CREATE TABLE, defaults, UNIQUE/INDEX (CIC), FK as NOT VALID; VALIDATE step deferred to plan
- Zod/Types: Ensure `@wesley/generator-js` consumes canonical IR; emit types and zod
- pgTAP: Structure/constraints tests; minimal RLS probes if annotated

Exit criteria:
- Running `wesley transform` produces SQL/Types/Zod/pgTAP with evidence + hashes

## Phase 3 — Diff & Phased Migrations (Additive Only)
- Diff: detect additions (table/column/index/unique/FK)
- Emit phases: expand (nullable/CIC/NOT VALID) → backfill (idempotent) → validate (VALIDATE CONSTRAINT) → switch/contract (set NOT NULL if safe)
- `wesley plan --explain`: show lock levels and phase ordering

Exit criteria:
- Planned steps align with zero‑downtime patterns; explain output clear

## Phase 4 — Rehearsal (REALM‑lite)
- `wesley rehearse --dsn`: apply plan on shadow DB; run pgTAP
- Output `.wesley/realm.json` with PASS/FAIL, timings, and summaries
- `--dry-run` to skip execution but print explain

Exit criteria:
- Rehearsal succeeds on example; pgTAP passes; realm.json written

## Phase 5 — SHIPME & Certificate
- `wesley cert create|sign|verify` to assemble/verifiy SHIPME.md
- Include scores (SCS/MRI/TCI), plan summary, pgTAP, REALM verdict, signatures
- `wesley deploy` (stub) refuses without valid SHIPME.md

Exit criteria:
- End-to-end demo produces a verified SHIPME.md and a green gate

## Phase 6 — CLI Polish & Docs
- Swap “generate” to “transform” in docs; no‑change narration
- Add JSON logging and stable exit codes for CI
- Author MVP docs (this folder) + Quick Start

## Phase 7 — Hardening
- Add contract tests for IR, evidence, and cert schemas
- Add CI workflow to run transform→rehearse on example; verify SHIPME

## Optional Phase 8 — ORM Proofs (if time)
- `@wesley/generator-prisma` and `@wesley/generator-drizzle` (schema files + hashes)

## Risks & Mitigation
- Scope creep → freeze specs before coding; defer destructive diffs
- Lock surprising behavior → rely on explain/dry‑run and additive design; pgTAP catches regressions

