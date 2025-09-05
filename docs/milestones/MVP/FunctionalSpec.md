# Functional Specification — MVP

## Workflows

1) Transform
- Input: GraphQL SDL (`--schema <file>`)
- Output: SQL, TS, Zod, pgTAP, evidence bundle
- Targets selected via `--target <csv>`

2) Plan (Explain)
- Input: Current IR (from SDL) and previous snapshot (optional)
- Output: Phased plan (expand/backfill/validate/switch/contract) with lock-level explain

3) Rehearse (REALM‑lite)
- Input: Plan, Shadow DSN
- Behavior: Apply plan; run pgTAP; capture timing
- Output: `.wesley/realm.json` verdict + metrics

4) Certify (SHIPME)
- Input: Evidence + REALM + scores
- Output: `SHIPME.md`; signatures; `wesley cert verify`

## Inputs / Outputs
- Inputs: SDL, optional previous schema snapshot, DSN for rehearsal
- Outputs: Generated artifacts (SQL/TS/Zod/pgTAP), evidence bundle, realm.json, SHIPME.md

## Business Rules & Validation
- Only additive diffs executed in MVP
- FKs created `NOT VALID`, validated in Validate phase
- Indexes created CONCURRENTLY
- Backfills must be idempotent or skipped

## Error Scenarios
- Parse failures → `PARSE_FAILED` with location if available
- Plan violations (destructive change) → explain-only with error code
- Rehearsal failures → exit with shadow fail code; hint to `--dry-run`

## Integrations
- Postgres via DSN for rehearsal
- ajv for evidence/bundle validation
- Optional: docker-compose for pgTAP

