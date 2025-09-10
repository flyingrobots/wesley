# BLADE — Daywalker Deploys

BLADE: Boring, Lock‑Aware, Audited Deployments, Effortless.

A memorable, end‑to‑end demo and storytelling wrapper for Wesley that dramatizes the core promise: safe, lock‑aware, evidence‑backed database changes you can ship at 4:58 PM on a Friday.

## Origin Story

- “Wesley Pipes” → “Wesley Snipes” → B.L.A.D.E.
- The Daywalker hunts downtime “vampires” (blocking locks, risky DDL).
- Taglines:
  - “BLADE: Cut through downtime.”
  - “Daywalker Deploys.”
  - “Boring deploys, on purpose.”

## Backronym

- Boring: Deployments are uneventful, predictable, and repeatable
- Lock‑Aware: Plans explain lock levels; uses CONCURRENTLY and NOT VALID → VALIDATE
- Audited: Evidence bundle + SHIPME certificate + signatures
- Deployments, Effortless: One‑shot flow and CLI ergonomics

## What It Demonstrates

- Schema‑first workflow (GraphQL → SQL/DDL/migrations/tests)
- Lock‑aware planning (expand/validate phases; CIC + NOT VALID)
- Shadow rehearsal (REALM) with JSON verdict
- Evidence and certification (SHIPME.md + signatures + badge)

## One‑Shot Flow (CLI)

```
wesley blade \
  --schema demo/blade/schema-v2.graphql \
  --out-dir demo/out \
  --docker \
  --env production \
  [--sign-key holmes.key --pub holmes.pub --signer HOLMES]
```

What happens under the hood:
- transform → plan --explain → rehearse (shadow) → cert-create → [optional sign/verify] → badge

Wrapper command location:
- `packages/wesley-cli/src/commands/blade.mjs`

## Demo Assets

- `demo/blade/schema-v1.graphql` — baseline
- `demo/blade/schema-v2.graphql` — one‑line additive change (nullable + index)
- `demo/blade/README.md` — quick operator guide

Suggestions to enhance the show:
- “Lock radar” highlighting `CREATE INDEX CONCURRENTLY`, `NOT VALID`, `VALIDATE CONSTRAINT`
- ASCII “sword” progress line for phases: Expand | Backfill | Validate | Switch | Contract
- Pre‑generate keys for signing: `holmes.key`/`holmes.pub`

## The Friday 4:58 PM Storyboard

1) The request lands at 4:58 PM; make a one‑line schema change
2) Run `wesley blade` — watch plan explain the locks
3) Rehearsal PASS prints a JSON verdict and timing
4) Create SHIPME.md, sign, and verify a badge
5) Mic drop: “Daywalker Deploys.”

## Evidence + Certificate

- `wesley cert-create` renders `.wesley/SHIPME.md` with a canonical JSON block
- `wesley cert-sign` adds signatures (e.g., HOLMES) to `.wesley/SHIPME.md`
- `wesley cert-verify` prints a badge from `.wesley/SHIPME.md`: `[REALM] PASS — sha abc1234`

## FAQ

- Does this require Docker? No. Use `--dry-run` for rehearsals in CI or local demos without a DB.
- What about destructive changes? The BLADE demo focuses on additive, lock‑safe steps. Destructive diffs are out of MVP scope.
- Why “boring”? Because boring deploys are reliable deploys — repeatable and auditable.

## Why This Works

- Sticky brand + tight narrative
- Aligned with current implementation (low risk to run live)
- Shows the exact value Wesley brings: locks, rehearsal, and receipts

## Next Enhancements

- `wesley stake` alias (friendly wrapper for `cert-sign`)
- Colorized lock levels (`--blade` theme) in plan explain
- Small load generator and “no blocking” pane for live demos
