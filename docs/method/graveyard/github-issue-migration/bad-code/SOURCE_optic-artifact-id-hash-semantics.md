# Optic Artifact ID And Hash Semantics

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

`OpticArtifact` currently carries both `artifact_id` and `artifact_hash`, and
the v0 compiler sets `artifact_id = artifact_hash`. That is acceptable as an
initial content-addressed implementation, but the semantics need to be made
explicit before more consumers depend on the shape.

There are two coherent futures:

- collapse the fields if `artifact_id` is always the content hash
- keep both and document that `artifact_id` is a registry/address identity while
  `artifact_hash` remains the canonical content-integrity digest

The current redundancy is useful only if it is deliberate.

## Hill

The optic artifact identity model explains whether `artifact_id` and
`artifact_hash` are aliases in v0 or separate concepts with different future
jobs.

## Done looks like

- docs state the v0 relationship between `artifact_id` and `artifact_hash`
- tests assert the intended v0 relationship
- if the fields can differ later, docs name the condition under which they can
  differ
- `OpticRegistrationDescriptor` uses the chosen terminology consistently
- Echo-facing documentation can explain which field it verifies for content
  integrity

## Repo Evidence

- `crates/wesley-core/src/domain/optic.rs`
- `crates/wesley-core/src/adapters/apollo.rs`
- `docs/NORTHSTAR.md`
