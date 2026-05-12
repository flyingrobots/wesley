# Echo Optic Artifact Registration Fixture

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

Wesley can now compile an `OpticArtifact` and emit an
`OpticRegistrationDescriptor`. The next executable proof belongs in Echo or a
small Echo-facing fixture: a runtime accepts the artifact, verifies the
descriptor, stores the requirements, and returns an opaque
`OpticArtifactHandle`.

This should stay narrower than invocation, capability grants, admission tickets,
or law witnesses.

## Hill

Echo can register one Wesley-compiled optic artifact and return an opaque
runtime-local handle.

## Done looks like

- fixture accepts `OpticArtifact` plus `OpticRegistrationDescriptor`
- runtime verifies `artifact_hash`
- runtime verifies `requirements_digest`
- runtime verifies `operation_id`
- runtime stores admission requirements internally
- runtime returns `OpticArtifactHandle { kind: "optic-artifact-handle", id }`
- red test rejects tampered `artifact_hash`
- red test rejects tampered `requirements_digest`
- red test rejects mismatched `operation_id`
- no capability grants, invocation, or law witness semantics are added in this
  slice

## Repo Evidence

- `crates/wesley-core/src/domain/optic.rs`
- `test/fixtures/runtime-optics/`
- Echo repo runtime registration surface, once selected
