# Continuum Minimum Shared Contract Surface

- Lane: `asap`
- Legend: `SOURCE`

## Why now

The current bearing says Wesley should earn its Continuum role as contract
compiler, not just imply it. The repo already has protocol-compiler surfaces,
but the minimum shared contract family is not yet frozen as one explicit,
finite, Wesley-owned schema surface.

## Hill

Wesley names one canonical shared contract surface for Continuum and makes it
inspectable enough that a human or agent can tell which nouns are globally
shared, which are derived, and which belong to substrate or runtime policy
instead.

## Done looks like

- the minimum shared surface is listed exactly, not rhetorically
- the canonical schema location for that surface is explicit
- inclusion and exclusion boundaries are documented
- `schema-source-of-truth` and `governance-boundaries` are both preserved
- the docs say plainly that handwritten shadow contracts for these nouns are out
  of bounds

## Repo Evidence

- `docs/plans/ttd-protocol-compiler.md`
- `schemas/ttd-protocol.graphql`
- `schemas/echo-core-types.graphql`
- `docs/invariants/schema-source-of-truth.md`
- `docs/invariants/governance-boundaries.md`

## Related Carry-Over

- `#365`
- `#366`
- `#456`
