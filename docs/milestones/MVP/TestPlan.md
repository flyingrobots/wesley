# Test Plan — MVP

## Strategy (Test Pyramid)
- Unit: IR mapping, directive validation, evidence map
- Integration: DDL generator (IR→SQL), diff planner, pgTAP emission
- E2E: Transform → Plan → Rehearse on example; SHIPME verify

## Automation & CI
- CI job runs: transform (example) → plan --explain → rehearse (shadow DSN) → cert create/verify
- Validate evidence and cert schemas with ajv
- Fail gates on thresholds (SCS/MRI/TCI) and pgTAP failures

## Performance & Reliability
- Rehearsal timeout default 5m; measure step durations
- Track average pgTAP duration to detect regressions

## Security & Compliance
- Ensure no secrets in evidence or SHIPME
- Signatures tested for tamper detection (hash mismatch should fail)

## Risk-Based Tests
- Backfill idempotence: re-run rehearsal; no changes applied twice
- Lock patterns: CIC present for indexes; NOT VALID/VALIDATE sequence for FKs

## Defect Management & Quality Gates
- Any parse/generation failures → block; show hints
- SHIPME verify must PASS for demo to be green

