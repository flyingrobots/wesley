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
- `crates/wesley-emit-rust` can emit operation request/response bindings from
  `SchemaOperation` data through `emit_rust_with_operations`.
- `crates/wesley-emit-typescript` can emit operation request/response bindings
  and operation metadata constants from `SchemaOperation` data through
  `emit_typescript_with_operations`.
- `wesley emit rust` and `wesley emit typescript` now include root operation
  bindings when the schema contains root `Query`, `Mutation`, or
  `Subscription` fields.

## Capability Gap

The real jedit contract is more than a data model. Its root `Query` and
`Mutation` fields define capability-like surfaces, including inputs, return
types, and generic directive data.

Wesley now has a generic operation catalog for those root fields and can project
that catalog into Rust and TypeScript operation bindings. Echo-specific
footprint honesty still remains external to Wesley core; Wesley preserves
`@wes_footprint` as generic directive JSON for Echo-owned tooling to interpret
later.

## Progress Ledger

| Item                                                                    | Status      | Score |
| ----------------------------------------------------------------------- | ----------- | ----: |
| Rust-native CLI is the primary Wesley front door                        | Done        |     8 |
| L1 schema lowering works for jedit-shaped models                        | Done        |     8 |
| Rust model emitter exists and is AST/printer-based                      | Done        |     8 |
| TypeScript model emitter exists and is AST/printer-based                | Done        |     8 |
| Representative jedit model fixture is tracked in Wesley tests           | Done        |     5 |
| Real jedit contract lowers and emits in local smoke checks              | Done        |     5 |
| Full jedit runtime fixture is tracked hermetically in Wesley            | Done        |     8 |
| Generic schema operation catalog preserves root args/results/directives | Done        |    15 |
| Native CLI exposes schema operation inspection                          | Done        |     5 |
| Rust operation binding emission exists                                  | Done        |    10 |
| TypeScript operation binding emission exists                            | Done        |    10 |
| jedit consumes generated artifacts without shadow models                | Not started |     0 |

Current score: 90 / 100.

## Next Move

Adopt the generated artifacts in the sibling repos that consume the contract.
Those changes should not be made from this repository session unless explicitly
authorized in those repos.

Suggested out-of-repo prompts:

- In the jedit repository: replace handwritten hot text runtime shadow models
  with Rust and TypeScript artifacts generated from Wesley's
  `test/fixtures/consumer-models/jedit-hot-text-runtime.graphql` equivalent,
  then update imports until jedit uses the generated request/response bindings.
- In the Echo repository: consume Wesley's schema operation catalog or generated
  Rust operation bindings, and keep Echo-owned `@wes_footprint` honesty checks
  in Echo rather than moving them into `wesley-core`.
- In the warp-ttd and Continuum repositories: treat Wesley-generated TypeScript
  operation bindings as the protocol boundary for jedit runtime operations.

The current generated operation surface connects root operations such as:

```graphql
createBufferWorldline(
  input: CreateBufferWorldlineInput!
): CreateBufferWorldlineResult!
```

The generated bindings now connect:

- operation kind
- operation field name
- argument object type
- result type
- preserved directive metadata for downstream Echo-owned tooling

## Progress

`[#############################################-----] 90%`
