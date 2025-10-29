# Product Requirements Document (PRD) — MVP

## Business Context & Problem
Teams duplicate schema across SQL, ORMs, TS types, validation, and tests, causing drift and risky deploys. Wesley eliminates drift by transforming a single GraphQL schema into the entire data layer and proving safety before production.

## Goals (MVP)
- Transform → Plan → Rehearse → Certify (SHIPME) end-to-end, CLI-first
- Default zero‑downtime patterns with explainability
- CI‑grade evidence and signatures to gate production

## Non-Goals (MVP)
- Destructive diffs; full TASKS/SLAPS; traffic mirroring; UI

## User Stories & Acceptance
See docs/milestones/MVP/UserStories.md

## Success Metrics / KPIs
- E2E demo < 15 min on clean machine
- 100% evidence schema validation in CI
- Rehearsal pass rate ≥ 95% on example
- SHIPME verification required by deploy stub

## Scope Boundaries (Explicitly OUT)
- DROP column/table execution
- Rolling-frontier SLAPS with circuit breakers
- Visual dashboards

## Risks & Mitigation
- Safety claims vs reality → additive-only, rehearsal mandatory, pgTAP
- Package drift → freeze IR schema, single CLI entry, contract tests
- Time → strict MVP boundaries; ship vertical slice first

