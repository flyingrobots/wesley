# BLADE Demo Keys

This folder is intentionally empty and .gitignored. For the demo, generate local keys or provide paths via CLI flags.

Generate Ed25519 keys locally:

```
openssl genpkey -algorithm ed25519 -out holmes.key
openssl pkey -in holmes.key -pubout -out holmes.pub
```

Pass to the one‑shot command:

```
wesley blade --schema test/fixtures/blade/schema-v2.graphql \
  --sign-key test/fixtures/blade/keys/holmes.key \
  --pub test/fixtures/blade/keys/holmes.pub
```

Security note: Never commit private keys. This folder stays local-only.
