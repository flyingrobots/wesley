# Footprint Honesty Rewrite Proof Slice

- Lane: `up-next`
- Legend: `SOURCE`
- Rank: `1`

## Why now

The stack doctrine is now explicit:

1. GraphQL families define graph entities, graph rewrites, declared footprints,
   and cross-boundary types.
2. Wesley compiles the lawful boundary.
3. Echo and other engines keep handwritten internals behind that boundary.

What is still missing is the first concrete proof that Wesley can compile a
footprinted graph rewrite into a bounded Rust authoring surface instead of
merely narrating the footprint in manifests.

## Hill

Wesley compiles one narrow proof slice in which:

- one GraphQL mutation declares a footprint
- Wesley carries that footprint into the generated Echo-facing Rust artifacts
- the generated Rust surface exposes only the declared capability boundary
- a valid implementation compiles
- an invalid implementation that reaches beyond the declared footprint fails at
  compile time

## Done looks like

- one authored GraphQL proof fixture contains:
  - graph entity nouns
  - one mutation rewrite
  - one explicit `@wes_footprint`
- Wesley emits one bounded Rust rewrite API artifact for that mutation
- the emitted Rust API is capability-shaped rather than generic callback-shaped
- one positive compile fixture passes
- one negative compile fixture fails for undeclared access

## Repo Evidence

- `schemas/directives.graphql`
- `packages/wesley-core/src/ttd/extractor.mjs`
- `packages/wesley-core/src/ttd/validation.mjs`
- `packages/wesley-generator-echo/src/index.mjs`
- `docs/architecture/continuum-wesley-role.md`
- `docs/method/backlog/v0.1.0/SOURCE_echo-warp-ttd-proof-family-compilation.md`
