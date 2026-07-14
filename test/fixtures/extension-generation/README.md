# Extension Generation Fixture

This domain-empty fixture proves the public `wesley-core` semantic-generation
contract without embedding a target implementation.

- `schema.graphql` is lowered into canonical Shape IR and the root-operation
  catalog.
- `semantic-source.json` stands in for an external owner's explicit declaration
  artifact.
- `generated-profile.json` stands in for one externally owned generated output.
- `input.json`, `provenance.json`, and `review.json` are checked canonical
  projections produced by the public Rust API.

The fixture test recomputes every digest, compares the checked projections with
canonical bytes, and validates them against the published schemas. The profile
shape has no meaning inside Wesley; a real extension owns its output schema and
semantic verifier.
