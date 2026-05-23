# Assurance Fixture Schemas

These schemas are retained for generic certificate and HOLMES workflow tests.

## Files

- `schema-v1.graphql` — baseline
- `schema-v2.graphql` — adds a nullable column + index (safe, additive)

## Run

```
wesley transform --schema test/fixtures/blade/schema-v1.graphql --emit-bundle --out-dir out
wesley cert-create --out SHIPME.md
wesley cert-verify --in SHIPME.md
```

Optional signing & verify (generate keys locally)

```
# one‑time
openssl genpkey -algorithm ed25519 -out test/fixtures/blade/keys/holmes.key
openssl pkey -in test/fixtures/blade/keys/holmes.key -pubout -out test/fixtures/blade/keys/holmes.pub

wesley cert-sign --in SHIPME.md --key test/fixtures/blade/keys/holmes.key --signer HOLMES
wesley cert-verify --in SHIPME.md --pub test/fixtures/blade/keys/holmes.pub
```
