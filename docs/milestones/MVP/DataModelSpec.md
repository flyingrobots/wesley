# Data Model Specification — MVP

## Entities

### Canonical IR
- tables[]: name, directives, columns[], primaryKey?, foreignKeys[], indexes[], tenantBy?
- columns[]: name, type, nullable, default?, unique?, directives

### Evidence Bundle
- evidence-map.json: uid → { sql:[], tests:[], ts:[], zod:[] }
- scores.json: { scores: { scs, mri, tci }, readiness: { verdict }, meta }

### Plan (Explain)
- phases[]: { name, steps[] }
- step: { op, table, column?, lockLevel, risk, sqlPreview }

### REALM Output
- realm.json: { verdict: PASS|FAIL, timings, tests: { passed, failed }, notes }

### SHIPME
- Human header + canonical block: commitSha, environment, evidence.scores, plan.summary, tests.summary, realm.verdict, signatures[]

## Constraints & Rules
- Additive diffs only
- FKs start as `NOT VALID`; validated later
- Indexes created CONCURRENTLY
- Backfills idempotent

## Backup & Recovery (MVP)
- Shadow rehearsal is disposable; no recovery needed
- Production backups out of scope; SHIPME tracks what was verified

