# Optic Artifact Hash Stability

- Lane: `bad-code`
- Legend: `EVIDENCE`

## Why now

Runtime optic artifacts now carry `artifact_hash` and `requirements_digest`.
Those fields are the integrity spine for Echo registration and capability
matching, but the current test only proves that the values are present and
stable across repeated compilation of the same fixture.

The next cleanup is to prove the negative cases that make the model useful:
requirements changes must change the requirements digest, payload shape changes
must change the artifact hash, and identical SDL plus operation input must keep
both values stable.

## Hill

Wesley has focused tests proving optic artifact identity is stable when it
should be stable and changes when authority-relevant or shape-relevant content
changes.

## Done looks like

- same SDL and operation compile to the same `artifact_hash`
- same SDL and operation compile to the same `requirements_digest`
- changing the declared footprint changes `requirements_digest`
- changing law claim directives changes `requirements_digest`
- changing selected payload shape changes `artifact_hash`
- changing only non-semantic formatting does not change hashes, if the compiler
  claims formatting independence for that surface

## Repo Evidence

- `crates/wesley-core/src/domain/optic.rs`
- `crates/wesley-core/src/adapters/apollo.rs`
- `crates/wesley-core/tests/runtime_optic_artifact.rs`
- `test/fixtures/runtime-optics/`
