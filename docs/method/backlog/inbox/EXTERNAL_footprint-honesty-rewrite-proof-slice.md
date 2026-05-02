# External footprint honesty rewrite proof slice

- Lane: `inbox`
- Legend: `EXTERNAL`
- Rank: `1`

## Ownership note

This is product/runtime module work, not active Wesley core work. Wesley should
only provide the generic directive, lowering, module capability, and artifact
plumbing needed by an external module to implement this target.

## Why now

The stack doctrine is now explicit:

1. GraphQL families define graph entities, graph rewrites, declared footprints,
   and cross-boundary types.
2. an external module compiles the lawful boundary through Wesley.
3. runtimes keep handwritten internals behind that boundary.

What is still missing is the first concrete proof that an external module can
compile a footprinted graph rewrite into a bounded Rust authoring surface
instead of merely narrating the footprint in manifests.

## Hill

The external module compiles one narrow proof slice in which:

- one GraphQL mutation declares a footprint
- the external module carries that footprint into generated runtime-facing Rust
  artifacts
- the generated Rust surface exposes only the declared capability boundary
- a valid implementation compiles
- an invalid implementation that reaches beyond the declared footprint fails at
  compile time

## Done looks like

- one authored GraphQL proof fixture contains:
  - graph entity nouns
  - one mutation rewrite
  - one explicit `@wes_footprint`
- the external module emits one bounded Rust rewrite API artifact for that
  mutation
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
