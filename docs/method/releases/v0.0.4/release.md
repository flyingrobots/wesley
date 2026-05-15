# Wesley v0.0.4 Release Packet

## Summary

Wesley `0.0.4` is a narrow Rust crate release for the runtime optic compiler
surface. It publishes Wesley-owned canonical admission requirement bytes on
every runtime optic artifact.

## Included Scope

- `wesley-core` exposes `OpticAdmissionRequirementsArtifact`.
- `compile_runtime_optic()` emits canonical requirement bytes, an explicit
  `wesley.requirements.canonical-json.v0` codec, and a digest computed from the
  exact byte buffer.
- `OpticArtifact` carries both structured `OpticAdmissionRequirements` and the
  canonical requirements artifact.
- Documentation explains that downstream runtimes should import the canonical
  bytes instead of reserializing Wesley structs.

## Sponsored Users

- Echo adapter work can import compiler-owned requirement truth from
  `wesley-core` instead of maintaining temporary adapter-local canonical JSON.
- Runtime authors can verify the requirement digest against bytes without
  depending on private serialization assumptions.

## Version Justification

This is a patch release because it adds a small public data surface to an
experimental `0.0.x` compiler API without changing runtime optic lowering
semantics, authority behavior, registration behavior, or CLI command behavior.

## Non-Goals

- No Echo changes.
- No admission enforcement.
- No `CapabilityGrant` validation.
- No runtime handle semantics.
- No `@wes_footprint` rename.
- No new runtime optic executable subset behavior.

## Acceptance

- Publishable Rust crate manifests all use version `0.0.4`.
- Release notes describe the canonical requirements artifact.
- Release prep guard passes for `0.0.4`.
- Package sanity passes for `0.0.4`.
- Full preflight passes before opening the release PR.
