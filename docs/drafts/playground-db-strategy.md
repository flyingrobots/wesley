# Playground In‑Browser DB Strategy (Draft)

Goal: zero‑install, zero‑persistence SQL for the browser demo, with an optional "real PG in WASM" toggle.

## Engines

- Emulated Postgres (default): pg‑mem (TypeScript, runs in main/worker thread)
  - Pros: tiny, instant, no persistence, great for DDL + simple queries
  - Cons: subset of PG; no extensions; some DDL features unsupported
- Real PG (beta, optional): PG → WASM (e.g., postgres-wasm/pglite)
  - Pros: closer to PG semantics
  - Cons: multi‑MB payload; slower startup; extensions mostly unavailable

## Non‑Persistence Guarantees

- Default: memory‑only data structures; no IndexedDB/OPFS writes
- "Incognito" flag: forces engines into ephemeral mode; blocks any cache path
- Refresh wipes state; explicit "Reset session" control tears down workers

## Capability Matrix (indicative)

| Feature | pg‑mem (default) | WASM PG (beta) |
|---|---|---|
| CREATE TABLE/VIEW | ✅ | ✅ |
| GENERATED/DEFAULT | ⚠️ subset | ✅ (some) |
| CREATE INDEX CONCURRENTLY | ⚠️ emulated/no‑op | ⚠️ (depends) |
| NOT VALID constraints | ⚠️ emulated/no‑op | ⚠️ (depends) |
| Triggers | ⚠️ limited | ⚠️ limited |
| Extensions (uuid‑ossp, pgcrypto, pg_trgm) | ❌ | ❌ |
| EXPLAIN/lock radar | ❌ | ⚠️ limited |
| pgTAP | ❌ | ❌ (browser) |

Legend: ✅ supported · ⚠️ partial/emulated · ❌ not available (in browser)

## UX Flow

1) User edits GraphQL → Generate
2) Show artifacts (SQL/Types/Zod/pgTAP)
3) Apply DDL to selected engine (pg‑mem by default)
4) HOLMES consumes bundle → live scores + gates
5) SHADOW REALM (MVP): simulate phases using plan; animate BLADE timeline
6) Optional: run a small SELECT in a query panel against the in‑memory DB

## Events & Observability

- `generator:*` (artifacts/evidence)
- `holmes:*` (scores/verdict/gates/trend)
- `realm:*` (phase/lock/result) — simulated in MVP

## Risks & Mitigations

- Unsupported DDL → surface capability panel + filter/annotate SQL
- WASM size → lazy load, gate behind toggle, cache only when allowed
- Expectations → warn when features require a real server (e.g., pgTAP)

— End draft —
