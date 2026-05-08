# Jedit Capability Progress
<!-- docs-truth: status=experimental owner=@flyingrobots -->

This page tracks Wesley's progress toward supporting the jedit capability path:
jedit authors its data and operation boundary in GraphQL, Wesley compiles that
contract into Rust and TypeScript surfaces, and downstream tools can build on
those generated contracts without handwritten shadow models.

## Scope

This is the Wesley-side tracker. It does not claim that jedit, Echo, warp-ttd,
or Continuum have adopted the generated artifacts yet.

The invariant is still Wesley's normal compiler boundary:

- authored GraphQL SDL is source truth
- Wesley lowers generic schema meaning
- Rust/TypeScript emitters produce derived artifacts
- Echo-specific footprint honesty remains Echo-owned

## Current Evidence

- `wesley emit rust --schema <path> --out <path>` exists in the native Rust CLI.
- `wesley emit typescript --schema <path> --out <path>` exists in the native
  Rust CLI.
- `crates/wesley-emit-rust` emits Rust models through a structured item/type
  AST and printer.
- `crates/wesley-emit-typescript` emits TypeScript declarations through a
  structured declaration/type AST and printer.
- `test/fixtures/consumer-models/jedit-hot-text-core.graphql` is a
  representative jedit-shaped fixture copied into Wesley so tests do not depend
  on a sibling checkout.
- `test/fixtures/consumer-models/jedit-hot-text-runtime.graphql` is a full
  jedit hot text runtime fixture copied into Wesley for hermetic operation
  catalog tests.
- Both emitters have tests against the jedit-shaped fixture.
- A local smoke check against the real jedit hot text contract succeeded on
  2026-05-08:
  - schema lowering succeeded
  - Rust model emission succeeded
  - TypeScript declaration emission succeeded
- `list_schema_operations_sdl` preserves root `Query`, `Mutation`, and
  `Subscription` fields as `SchemaOperation` data.
- `wesley schema operations --schema <path> --json` exposes the schema operation
  catalog from the native Rust CLI.

## Capability Gap

The real jedit contract is more than a data model. Its root `Query` and
`Mutation` fields define capability-like surfaces, including inputs, return
types, and generic directive data.

Wesley now has a generic operation catalog for those root fields. The remaining
gap is projection: the Rust and TypeScript emitters still produce model
declarations, not callable operation bindings. Echo-specific footprint honesty
also remains external to Wesley core; Wesley preserves `@wes_footprint` as
generic directive JSON for Echo-owned tooling to interpret later.

## Progress Ledger

| Item | Status | Score |
| --- | --- | ---: |
| Rust-native CLI is the primary Wesley front door | Done | 8 |
| L1 schema lowering works for jedit-shaped models | Done | 8 |
| Rust model emitter exists and is AST/printer-based | Done | 8 |
| TypeScript model emitter exists and is AST/printer-based | Done | 8 |
| Representative jedit model fixture is tracked in Wesley tests | Done | 5 |
| Real jedit contract lowers and emits in local smoke checks | Done | 5 |
| Full jedit runtime fixture is tracked hermetically in Wesley | Done | 8 |
| Generic schema operation catalog preserves root args/results/directives | Done | 15 |
| Native CLI exposes schema operation inspection | Done | 5 |
| Rust operation binding emission exists | Not started | 0 |
| TypeScript operation binding emission exists | Not started | 0 |
| jedit consumes generated artifacts without shadow models | Not started | 0 |

Current score: 70 / 100.

## Next Move

Add operation binding emission on top of the schema operation catalog.

The emitters should not reparse SDL. They should consume `SchemaOperation` data
and generate callable Rust/TypeScript surfaces for root operations such as:

```graphql
createBufferWorldline(
  input: CreateBufferWorldlineInput!
): CreateBufferWorldlineResult!
```

The first useful target is generated types or traits/functions that clearly
connect:

- operation kind
- operation field name
- argument object type
- result type
- preserved directive metadata for downstream Echo-owned tooling

## Progress

`[###################################---------------] 70%`
