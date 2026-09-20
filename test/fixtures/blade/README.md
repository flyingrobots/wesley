# Assurance Fixture Schemas

These schemas were the walkthrough for the retired Node CLI. The commands below
(`transform`, `cert-create`, `cert-sign`, `cert-verify`) are not commands of the
Rust `wesley` binary, and no test reads this fixture. Issue 832 decides whether
it is removed or rewritten.

## Files

- `schema-v1.graphql` — baseline
- `schema-v2.graphql` — adds a nullable column + index (safe, additive)

## The retired walkthrough

```text
wesley transform --schema test/fixtures/blade/schema-v1.graphql --emit-bundle --out-dir out
wesley cert-create --out SHIPME.md
wesley cert-verify --in SHIPME.md
```

Optional signing and verification, with keys generated locally:

```text
# one‑time
openssl genpkey -algorithm ed25519 -out test/fixtures/blade/keys/holmes.key
openssl pkey -in test/fixtures/blade/keys/holmes.key -pubout -out test/fixtures/blade/keys/holmes.pub

wesley cert-sign --in SHIPME.md --key test/fixtures/blade/keys/holmes.key --signer HOLMES
wesley cert-verify --in SHIPME.md --pub test/fixtures/blade/keys/holmes.pub
```
