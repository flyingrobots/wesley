# Runtime Optic GraphQL Validation Coverage

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

Runtime optic artifacts now claim `shape.valid.v1`. The current compiler checks
the review-driven admission risks around root arguments, recursive input object
literals, enum values, nested list wrappers, and fragment type-condition
compatibility. That is the right immediate fix, but the hard law name should not
depend on scattered local checks forever.

Before Echo or another runtime treats `shape.valid.v1` as a broad trust anchor,
Wesley should audit runtime optic lowering against the GraphQL executable
validation rules it intends to support.

## Hill

`shape.valid.v1` has an explicit validation coverage matrix for runtime optic
operations, and every checked rule has a regression test or a deliberately
documented non-goal.

## Done Looks Like

- runtime optic validation has a documented matrix of covered GraphQL
  executable rules
- each covered rule has a named regression test
- unsupported GraphQL features are rejected explicitly or documented as v0
  non-goals
- `shape.valid.v1` documentation points to the coverage matrix
- future gaps are logged as concrete backlog items instead of remaining implicit

## Repo Evidence

- `crates/wesley-core/src/adapters/apollo.rs`
- `crates/wesley-core/tests/runtime_optic_artifact.rs`
- `docs/NORTHSTAR.md`
