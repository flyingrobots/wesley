# BLADE Demo Keys

This folder is intentionally empty and .gitignored. It held local keys for the
retired Node CLI's certificate walkthrough; see the README one level up.

Generate Ed25519 keys locally:

```bash
openssl genpkey -algorithm ed25519 -out holmes.key
openssl pkey -in holmes.key -pubout -out holmes.pub
```

The retired CLI used them like this. The Rust `wesley` binary has no `cert-sign`
or `cert-verify` command:

```text
wesley cert-sign --in SHIPME.md --key holmes.key --signer HOLMES
wesley cert-verify --in SHIPME.md --pub holmes.pub
```

Security note: Never commit private keys. This folder stays local-only.
