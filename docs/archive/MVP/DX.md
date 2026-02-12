# Developer Experience (DX) — MVP

Design principles: fast feedback, clear errors, predictable contracts.

## Installation & Env
- Node ≥ 18.17, pnpm
- Postgres for rehearsal (docker-compose or local DSN)
- `pnpm install`; `pnpm -r build` optional

## Commands
- `wesley transform --schema <file> --target postgres,typescript,zod,pgtap --out out`
- `wesley plan --schema <file> --explain`
- `wesley rehearse --dsn <shadow> [--dry-run] [--timeout 300000]`
- `wesley cert {create|sign|verify} [--json]`

## Logs & Exit Codes
- Default: friendly console; `--json` emits structured logs for CI
- Exit codes consistent with Spec.md; common errors include code & hint

## No‑Change UX
- Transform narrates “homeostasis maintained” when artifacts unchanged
- Evidence still updated with timestamp and IR hash

## Evidence & Contracts
- IR schema frozen; generators read canonical IR
- Evidence bundle validated by ajv in CI; include artifact hashes & paths

## Testing Locally
- `wesley rehearse --dsn $SHADOW_DSN` to dry-run migration plan
- `pnpm run docker:test` for pgTAP via docker-compose (optional)

## Conventions
- Canonical directives: `@wes_*` (aliases warn)
- CLI: `transform` is primary verb; `generate` remains an alias for now
- One CLI entry point; dynamic imports tolerate missing optional targets

## Developer Hints (Examples)
- ENOENT schema → prints “Try: wesley transform --schema path/to/schema.graphql”
- Empty stdin → prints an example echo pipeline
- Plan shows lock levels + affected tables

## Code Style & Structure
- Keep core pure (no Node deps); adapters live in host-node
- Contract tests for IR and evidence; avoid brittle snapshots

