# MVP Design & Technical Specifications

This spec freezes the contracts required to deliver the MVP vertical slice.

## 1) Canonical IR (JSON Schema)
- Top-level: `{ tables: Table[] }`
- `Table`: `{ name, directives, columns: Column[], primaryKey?, foreignKeys: FK[], indexes: Index[], tenantBy? }`
- `Column`: `{ name, type, nullable, default?, unique?, directives }`
- `FK`: `{ column, refTable, refColumn }`
- `Index`: `{ columns: string[], name?, using? }`
- Directives include canonical `@wes_*` aliases resolved by parser
- File: `schemas/ir.schema.json` (added in Phase 1)

Notes:
- Types: GraphQL scalars map to PG (`ID→uuid`, `String→text`, `Int→integer`, `Float→double precision`, `Boolean→boolean`, `DateTime→timestamptz`). Arrays: `[]` suffix.
- Parser errors use code `PARSE_FAILED` with helpful hints.

## 2) Transform Targets (MVP)
- Postgres DDL (SQL):
  - CREATE TABLE columns (nullable unless nonNull), defaults
  - UNIQUE constraints, CREATE INDEX (CONCURRENTLY)
  - FOREIGN KEY constraints emitted as `NOT VALID`; validation deferred
- TypeScript/Zod:
  - Types inferred from PG types; nullability and arrays respected
  - Zod schemas with defaults where applicable
- pgTAP:
  - Structure/constraints tests + optional basic RLS probes if annotated

Evidence:
- `.wesley/evidence-map.json` records artifact locations for IR elements
- Hash all artifacts (content SHA) and include in bundle

## 3) Diff & Phased Migrations (Additive Only)
- Supported: add table, add column (nullable), add index/unique, add FK (NOT VALID)
- Phases:
  - Expand: CREATE columns (nullable), CREATE INDEX CONCURRENTLY, ADD CONSTRAINT (NOT VALID)
  - Backfill: Idempotent updates (guards); optional if defaults cover it
  - Validate: `VALIDATE CONSTRAINT` (FKs), `SET NOT NULL` only when verified safe
  - Switch/Contract: Minimal for MVP (no DROPs)

Plan Explain:
- Show steps with lock classification (SHARE/ROW_EXCLUSIVE/SHARE_UPDATE_EXCLUSIVE/etc.)
- Compute rough risk per step via `MigrationExplainer`

## 4) Rehearsal (REALM‑lite)
- CLI: `wesley rehearse --dsn <shadow>`
- Behavior: apply plan, run pgTAP, capture timing
- Output: `.wesley/realm.json` with `{ verdict: PASS|FAIL, tests: { passed, failed }, timings, notes }`
- Flags: `--dry-run` (no DB writes), `--timeout` (ms)

## 5) SHIPME.md
- Human header + canonical JSON block
- Required fields:
  - commitSha, timestamp, environment
  - evidence.scores: { scs, mri, tci }
  - plan.summary: phase counts, lock highlights
  - tests.summary: pgTAP pass/fail
  - realm.verdict: PASS|FAIL with timings
  - signatures: [ { signer: "HOLMES", keyId, sig }, { signer: "WAT-SUM", keyId, sig } ]
  - badge string for quick status
- CLI:
  - `wesley cert create --env <env> --out SHIPME.md`
  - `wesley cert sign --signer <name> --key <path> --in SHIPME.md`
  - `wesley cert verify --in SHIPME.md`

## 6) CLI Commands (MVP)
- `wesley transform`:
  - Flags: `--schema <file>`, `--target <csv>`, `--out <dir>`, `--json`, `--quiet`, `--debug`
  - Exit codes: 0 ok; 2 compile/parse error; 4 generation failed
- `wesley plan`:
  - Flags: `--schema <file>`, `--explain`, `--json`
  - Exit codes: 0 ok; 5 validation/plan failed
- `wesley rehearse`:
  - Flags: `--dsn`, `--dry-run`, `--timeout <ms>`, `--json`
  - Exit: 0 success; 13 shadow fail
- `wesley cert`:
  - Subcommands: create, sign, verify, badge
  - Exit: 0 ok; 8 invalid certificate

## 7) Thresholds (Defaults)
- SCS ≥ 0.80 (schema coverage weighted)
- MRI ≤ 0.40 (migration risk)
- TCI ≥ 0.70 (test coverage)

## 8) Logging & Telemetry
- Default console with levels; `--json` structured output
- Include timestamps, codes, and hints for common failures

## 9) Non‑Goals & Open Questions
- Non‑Goals: destructive diffs in MVP; full TASKS v3; traffic mirroring
- Open Questions: default REALM smoke suite, pg version matrix, signer key management (local vs KMS)

