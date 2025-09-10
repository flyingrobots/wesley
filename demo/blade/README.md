# BLADE Demo — Daywalker Deploys

BLADE: Boring, Lock‑Aware, Audited Deployments, Effortless.

This demo shows a one‑line schema change flowing through:
- transform → plan (lock‑aware) → rehearse (shadow DB) → certify → verify
- Ending with a memorable badge: “Daywalker Deploys.”

## Files
- `schema-v1.graphql` — baseline
- `schema-v2.graphql` — adds a nullable column + index (safe, additive)

## Run (one‑shot)

Option A — new wrapper command (quick start)

```
wesley blade \
  --schema demo/blade/schema-v2.graphql \
  --out-dir demo/out \
  --docker \
  --env production
```

Option B — explicit DSN (skip docker auto‑up)

```
wesley blade \
  --schema demo/blade/schema-v2.graphql \
  --out-dir demo/out \
  --dsn postgres://wesley:wesley_test@localhost:5432/wesley_test \
  --env production
```

Optional: simulate upgrade from v1 to v2

```
# Seed baseline snapshot from v1
wesley generate --schema demo/blade/schema-v1.graphql --out-dir demo/out --quiet

# Then run blade against v2 to see additive changes
wesley blade --schema demo/blade/schema-v2.graphql --out-dir demo/out --dry-run
```

Optional signing & verify (generate keys locally)

```
# one‑time
openssl genpkey -algorithm ed25519 -out demo/blade/keys/holmes.key
openssl pkey -in demo/blade/keys/holmes.key -pubout -out demo/blade/keys/holmes.pub

# include in blade
wesley blade --schema demo/blade/schema-v2.graphql \
  --sign-key demo/blade/keys/holmes.key \
  --pub demo/blade/keys/holmes.pub
```

## What to watch
- Plan explains: CREATE INDEX CONCURRENTLY; FK NOT VALID → VALIDATE.
- Rehearsal verdict: PASS with timings in `.wesley/realm.json`.
- SHIPME.md: human header + canonical JSON + optional signatures.
- Badge: printed line with status and sha.

## Taglines
- “BLADE: Cut through downtime.”
- “Daywalker Deploys.”
- “Boring deploys, on purpose.”
