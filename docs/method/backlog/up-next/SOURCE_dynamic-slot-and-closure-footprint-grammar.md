# Dynamic Slot And Closure Footprint Grammar

- Lane: `up-next`
- Legend: `SOURCE`
- Rank: `1`

## Why now

The current footprint-honesty proof slice proves one narrow thing:

- Wesley can generate a bounded Rust authoring surface from flat
  `reads`/`writes`/`creates`/`deletes` declarations.

That is not enough for real graph rewrites such as `jedit`'s
`ReplaceRangeAsTick`, where the concrete rope path and affected-anchor set are
bound dynamically at runtime.

Wesley now needs to treat structured footprint law as a first-class compiler
surface:

- direct slots
- binding sources
- derived closures
- create/update surfaces
- forbidden surfaces

## Hill

Wesley compiles one real shared-family rewrite whose honesty is expressed
through structured slots and closures rather than flat type lists alone.

The next cut should prove:

- the GraphQL directive grammar can express slot and closure bindings
- the extracted TTD/contract surface preserves that structure
- generated Echo-facing Rust surfaces can evolve from flat capability traits
  toward slot-aware context traits
- consumers can tell the difference between compile-time capability shape and
  runtime binding failure

## Done looks like

- one admitted grammar exists for:
  - `slots`
  - `closures`
  - `createSlots`
  - `updates`
  - `forbids`
- one real rewrite family, such as `ReplaceRangeAsTick`, is represented in
  that grammar
- Wesley emits structured IR/manifest footprint data for it
- the next generator step is obvious: slot-aware bounded Rust surfaces

## Repo Evidence

- `schemas/directives.graphql`
- `schemas/ttd-ir.schema.json`
- `packages/wesley-core/src/ttd/`
- `packages/wesley-generator-echo/src/emitRewriteApi.mjs`
- `docs/architecture/continuum-wesley-role.md`
