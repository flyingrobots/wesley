# Continuum Conformance And Round-Trip Witness

- Lane: `up-next`
- Legend: `EVIDENCE`

## Why now

Continuum fails if the generated contract family is only "supposed to match"
across runtimes. Wesley needs a witness lane that proves canonical bytes,
registry ids, and fixture vectors stay compatible instead of relying on trust.

## Hill

Wesley can produce and verify conformance fixtures for the chosen shared
contract family so downstream hot and cold runtimes have machine-checkable
compatibility proof rather than adapter folklore.

## Done looks like

- fixture vectors are emitted from the schema-owned family
- round-trip checks verify canonical bytes or canonical structured values
- failures identify the contract family and schema hash clearly
- docs explain what the witness proves and what it does not prove
- the proof lane strengthens `evidence-truth` instead of faking platform
  compatibility

## Repo Evidence

- `packages/wesley-generator-ttd/test/integration/e2e-pipeline.test.mjs`
- `packages/wesley-generator-ttd/test/integration/determinism.test.mjs`
- `packages/wesley-core/src/ttd/hasher.mjs`
- `packages/wesley-core/src/ttd/manifest.mjs`
- `docs/invariants/evidence-truth.md`

## Related Carry-Over

- `#448`
- `#451`
