# Playground Demo Scenarios (Draft)

Purpose: demonstrate, in‑browser and zero‑install, that Wesley produces real Postgres artifacts and safe, zero‑downtime migrations — plus GraphQL → Postgres RPC — with honest capability notes.

## Scenario A — Real Postgres DDL (Browser)

- Input: editable GraphQL SDL (ecommerce subset)
- Action: Generate → show emitted SQL (tables, indexes, constraints) + Types + Zod + pgTAP
- Apply: load into `pg-mem` (default) and display which statements applied, which were emulated/skipped
- Evidence: HOLMES runs on emitted bundle, shows SCS/TCI/MRI + deductions
- Success: user sees and can scroll real DDL, and a query panel returns rows

## Scenario B — GraphQL → Postgres RPC

- Input: canned Ops (QIR) for read endpoints (e.g., products_by_name)
- Action: Compile Ops → emit SQL functions (or fallback views if `CREATE FUNCTION` unsupported)
- Apply: to `pg-mem` (views) or WASM PG (functions), then run sample SELECT
- Evidence: HOLMES includes RPC artifacts in evidence and TCI sub‑metrics
- Success: user calls an RPC (function/view) and sees results inline

## Scenario C — Postgres migrations “that just work”

- Input: edit SDL to add non‑breaking changes (new column with default; new index)
- Action: Plan → emit expand/backfill/validate/contract scripts
- Apply: to `pg-mem` and/or WASM PG, validate idempotence (apply twice = no change) and show plan trace
- Evidence: HOLMES gate “Migration Risk” is ✅ for plan; idempotence checks pass
- Success: user sees migration plan apply cleanly and repeatably

## Scenario D — Zero‑downtime safe migrations (SHADOW REALM™)

- Input: edit SDL to do a rename via expand/backfill/switch/contract
- Action: Rehearse (simulate) — animate BLADE phases, show lock levels and when reads/writes are safe
- Apply: WASM PG (beta) — run the plan with small data, show EXPLAIN and timing where possible
- Evidence: HOLMES risk vectors reflect drops/renames and plan mitigations
- Success: user grasps the choreography: expand → backfill → validate → switch → contract, without downtime

## Capability Notes

- Default engine: `pg-mem` — memory‑only, fast, subset of PG; no extensions
- WASM PG (beta): closer to PG; heavier; still without extensions; EXPLAIN limited
- In both cases, no persistence: refresh = reset. A “Reset session” button wipes state.

## Event Timeline (for all scenarios)

- generator:* (artifacts/evidence)
- holmes:* (scores/gates/verdict/trend)
- realm:* (phase/lock/result) — simulated for pg‑mem; more detailed on WASM PG

— End draft —
