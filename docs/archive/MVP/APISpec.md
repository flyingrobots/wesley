# API Specification — MVP

This MVP is CLI-first. The “APIs” are contracts: CLI commands, JSON logs, and JSON schemas.

## CLI Contracts
- `wesley transform`: see Spec.md for flags and exit codes
- `wesley plan`: `--explain` prints machine-friendly steps in `--json` mode
- `wesley rehearse`: emits `.wesley/realm.json`; supports `--json`
- `wesley cert`: create/sign/verify; `--json` verification payload

## JSON Schemas (Contracts)
- Canonical IR: `schemas/ir.schema.json`
- Evidence bundle: `schemas/evidence-map.schema.json`, `schemas/scores.schema.json`
- SHIPME canonical block (to be added): `schemas/shipme.schema.json`
- REALM output: `schemas/realm.schema.json`

## Request/Response Examples
- `wesley plan --json` outputs plan nodes with phase, lock level, affected tables
- `wesley cert verify --json` yields `{ ok: true, badge: "[REALM] … PASS", thresholds: {...} }`

## Auth / Rate Limits / Versioning
- N/A for local CLI MVP; version fields embedded in evidence and certs

