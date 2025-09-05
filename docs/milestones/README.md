# Milestones Roadmap

This document tracks Wesley’s product milestones from MVP to broader vision. It provides an index of milestone docs and a quick view of what “done” means at each stage.

## Map of Contents (MoC)
- MVP
  - docs/milestones/MVP/README.md
  - docs/milestones/MVP/Example.md
  - docs/milestones/MVP/UserStories.md
  - docs/milestones/MVP/ImplementationPlan.md
  - docs/milestones/MVP/Spec.md
  - docs/milestones/MVP/DX.md
  - docs/milestones/MVP/PRD.md
  - docs/milestones/MVP/FunctionalSpec.md
  - docs/milestones/MVP/TechnicalArchitecture.md
  - docs/milestones/MVP/UXDesign.md
  - docs/milestones/MVP/APISpec.md
  - docs/milestones/MVP/DataModelSpec.md
  - docs/milestones/MVP/TestPlan.md

## Vision Roadmap

1) MVP: Transform → Plan → Rehearse → Certify (SHIPME)
- Transform from GraphQL to IR → SQL/Types/Zod/pgTAP (evidence + hashes)
- Diff to phased migrations (expand/backfill/validate/switch/contract)
- Rehearse on a shadow DB (REALM-lite) with explain/dry-run, run pgTAP
- Certify via SHIPME.md (HOLMES + WAT-SUM signatures, REALM verdict)

2) ORM Proofs and Drift Discipline
- Add Prisma/Drizzle generators (hash-pinned to IR)
- End-to-end drift detection and round‑trip checks

3) Planning and Orchestration (TASKS/SLAPS, v1)
- TASKS: Minimal artifacts (tasks.json, dag.json, waves.json, coordinator.json)
- SLAPS: Rolling‑frontier runner (locks/quotas/retries/checkpoints) + explain mode

4) Shadow REALM (Advanced)
- Traffic mirroring adapters, deeper smoke drills (RLS probes, perf budgets)
- REALM approvals update SHIPME.md automatically

5) Full TASKS v3 / SLAPS Spec Alignment
- Evidence‑based dependencies (confidence, mutual exclusions)
- Circuit breakers + hot plan patches, telemetry, dashboards

6) Multi‑backend and Ecosystem
- Additional databases (MySQL/SQLite), more targets (TypeORM/tRPC/JSON Schema)
- Visual plan/explain UI, VSCode plugin, Next.js/Supabase stack polish

## Definition of Done (Each Stage)
- Spec implemented per stage’s Spec.md
- Docs updated with examples and acceptance criteria
- CI gates: evidence schemas pass, tests pass, SHIPME verified for demo

## Risks & Mitigation (High‑level)
- Scope creep → Freeze MVP contracts first; ship minimal vertical slice
- Lock‑safety claims vs reality → Start additive‑only diff; prove with REALM-lite
- Drift across packages → Canonical IR schema + contract tests

