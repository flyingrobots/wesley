# MVP Killer Demo: From Schema to SHIPME (Friday Deploy)

This demo proves the promise: one schema → safe migrations → shadow rehearsal → signed certificate. It is memorable, repeatable, and fast.

## Storyboard
- Morning: Edit schema.graphql (add a column + index + FK)
- Noon: Transform → artifacts generated; plan shows lock impact
- Afternoon: Rehearse in REALM‑lite shadow DB; pgTAP passes
- Evening: SHIPME.md created, signed, verified; deploy gate turns green

## Prereqs
- Node 18+, pnpm
- Postgres available for shadow (e.g., docker DSN)
- Repo cloned; `pnpm install`

## Walkthrough (Commands + Expected)

1) Transform
```bash
wesley transform --schema ./test/fixtures/examples/ecommerce.graphql \
  --target postgres,typescript,zod,pgtap --out out
```
Expected:
- out/schema.sql, out/tests.sql, out/types.ts, out/zod.ts
- .wesley/evidence-map.json and bundle with artifact hashes

2) Plan (Explain)
```bash
wesley plan --schema ./test/fixtures/examples/ecommerce.graphql --explain
```
Expected:
- Phase ordering shown: expand → backfill → validate → switch → contract
- Lock levels listed (CIC, NOT VALID, VALIDATE)

3) Rehearse (REALM‑lite)
```bash
export SHADOW_DSN=postgres://postgres:postgres@localhost:5432/shadow
wesley rehearse --dsn $SHADOW_DSN --timeout 300000
```
Expected:
- Applies plan on shadow DB
- Runs pgTAP; summary printed
- Writes .wesley/realm.json with PASS/FAIL and metrics

4) Certify
```bash
wesley cert create --env production --out SHIPME.md
wesley cert sign --signer holmes --key ~/.wesley/keys/holmes --in SHIPME.md
wesley cert sign --signer wat    --key ~/.wesley/keys/wat    --in SHIPME.md
wesley cert verify --in SHIPME.md
```
Expected:
- SHIPME.md includes human summary + canonical JSON block
- REALM verdict: PASS; Indubitability Index present; thresholds satisfied

5) Gate
```bash
wesley deploy --env production   # stubbed to require SHIPME
```
Expected:
- Refuses without valid SHIPME.md (unless --force); prints badge on success

## Artifacts Snapshot
- Evidence: SCS/MRI/TCI
- Plan: wave order & lock impact
- Test: pgTAP summary
- REALM: rehearsal verdict with timings
- SHIPME: signed, machine‑verifiable certificate

## Demo Tips
- Use “no‑change” path once to showcase transform narrative
- Toggle a backfill to show idempotence
- Show `--dry-run` vs real rehearsal
