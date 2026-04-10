# Continuum Cross-Leg Schema Hash Divergence

- Lane: `bad-code`
- Legend: `TRANSMUTE`

## Why this stinks

The authored `schemas/continuum-receipt-family.graphql` currently compiles
successfully through both `wesley compile-ttd` and `wesley bundle-echo`, but
the two legs report different schema hashes for the same SDL.

That means the repo can currently emit multiple generated legs for one authored
family without one stable family identity. That cuts directly against the new
`realization-coherence` invariant.

## Symptom

For the same authored schema:

- `compile-ttd --schema schemas/continuum-receipt-family.graphql --dry-run --json`
  returned schema hash
  `eab74917ce8de571ed3a21a94e8c08d08c89528897b90e84552cdbcffb06ba13`
- `bundle-echo --schema schemas/continuum-receipt-family.graphql --out-dir /tmp/wesley-receipt-family-out --json`
  returned schema hash
  `16bf631145b60e0ec240f97484ff2cb5f534cd38c963cf12044985915766a602`

Both commands succeeded. The identity story did not.

## Why now

Wesley can tolerate a narrow witness lane for a while. It cannot tolerate two
different schema-hash stories for one authored contract family if it wants to
act like a contract compiler instead of adjacent generators.

## Done looks like

- one authored schema yields one stable family hash across TTD and Echo legs
- any intentionally distinct hash kinds are named explicitly and are not both
  called `schemaHash`
- conformance and realization surfaces can point at one family identity
  without command-specific folklore

## Repo Evidence

- `schemas/continuum-receipt-family.graphql`
- `packages/wesley-cli/src/commands/compile-ttd.mjs`
- `packages/wesley-cli/src/commands/bundle-echo.mjs`
- `packages/wesley-core/src/ttd/hasher.mjs`
- `packages/wesley-core/src/domain/schemaHash.mjs`
- `docs/invariants/realization-coherence.md`
