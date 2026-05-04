# BLADE Demo Keys

This folder is intentionally empty and .gitignored. For the demo, generate local keys or provide paths via CLI flags.

Generate Ed25519 keys locally:

```
openssl genpkey -algorithm ed25519 -out holmes.key
openssl pkey -in holmes.key -pubout -out holmes.pub
```

Use them with certificate signing:

```
wesley cert-sign --in SHIPME.md --key holmes.key --signer HOLMES
wesley cert-verify --in SHIPME.md --pub holmes.pub
```

Security note: Never commit private keys. This folder stays local-only.
