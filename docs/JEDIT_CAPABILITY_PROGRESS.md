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
  AST and printer (`crates/wesley-emit-rust/src/lib.rs:20`, commit `e25bc55a`).
- `crates/wesley-emit-typescript` emits TypeScript declarations through a
  structured declaration/type AST and printer
  (`crates/wesley-emit-typescript/src/lib.rs:27`, commit `e25bc55a`).
- `test/fixtures/consumer-models/jedit-hot-text-core.graphql` is a
  representative jedit-shaped fixture copied into Wesley so tests do not depend
  on a sibling checkout.
- `test/fixtures/consumer-models/jedit-rope.graphql` is a full
  jedit hot text runtime fixture copied into Wesley for hermetic operation
  catalog tests.
- `test/fixtures/consumer-models/stack-witness-0001-file-history.graphql` is a
  173-line jedit-adjacent file-history schema fixture added with pinned binary
  vector test artifacts (`test/fixtures/consumer-models/stack-witness-0001-vectors.json`,
  commit `f459781c`). Rust emit and TypeScript emit tests exercise this schema
  shape in addition to the rope fixture.
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
- `crates/wesley-emit-rust` emits operation request/response bindings from
  `SchemaOperation` data through `emit_rust_with_operations`
  (`crates/wesley-emit-rust/src/lib.rs:27`, commit `05207c10`).
- `crates/wesley-emit-typescript` emits operation request/response bindings and
  operation metadata constants through `emit_typescript_with_operations`
  (`crates/wesley-emit-typescript/src/lib.rs:34`, commit `05207c10`).
- `wesley emit rust` and `wesley emit typescript` include root operation bindings
  when the schema contains root `Query`, `Mutation`, or `Subscription` fields.
- `--metadata-out <path>` flag on both emit commands writes a deterministic JSON
  sidecar recording `schemaHash`, `schemaHashQualified`, `lawHash`,
  `lawDocumentHash`, `profileHash`, `bundleHash`, `lawIrCodec`, `generator`,
  `generatorVersion`, and `executionMode`
  (`crates/wesley-cli/src/main.rs`, commit `909089a8`).
- `emit_rust_with_operations_and_hashes` embeds `WESLEY_SCHEMA_HASH` and
  `WESLAW_HASH` provenance constants directly in the generated Rust output,
  anchoring artifacts to the exact schema and law identity that produced them
  (`crates/wesley-emit-rust/src/lib.rs:34`, commit `9212fde2`).
- `emit_rust_with_operations_and_law` generates law-backed `RustScalarValidator`
  and `RustVariantValidator` types from `LawIrV1` into the Rust output — scalar
  integer range validators and discriminated input variant validators wired
  directly from `weslaw/v1` semantic law
  (`crates/wesley-emit-rust/src/lib.rs:50`, commit `47c6c863`).
- `emit_le_binary_typescript` generates a little-endian binary encode/decode
  codec for all operation variable types (enums, input objects, argument
  serialization), exposed as `wesley emit le-binary-typescript` from the CLI
  (`crates/wesley-emit-typescript/src/le_binary.rs:46`, commit `03843264`).
- The LE binary codec emits `export const OP_<UPPER_SNAKE>: number =
  <stableOpId>` constants derived from the deterministic FNV-1a `stable_op_id`
  algorithm ported into `wesley-core`. This is the cross-language EINT op id
  contract; the identifier convention matches echo-wesley-gen's Rust emit so
  consumers can swap between languages without renaming
  (`crates/wesley-emit-typescript/src/le_binary.rs`, `crates/wesley-core/src/domain/operation.rs`,
  commit `e953eaa2`).

## Capability Gap

The real jedit contract is more than a data model. Its root `Query` and
`Mutation` fields define capability-like surfaces, including inputs, return
types, and generic directive data.

Wesley now has a generic operation catalog for those root fields and projects
that catalog into Rust and TypeScript operation bindings. Law-backed validators
can be co-emitted when a `weslaw/v1` file is supplied. Echo-specific footprint
honesty still remains external to Wesley core; Wesley preserves `@wes_footprint`
as generic directive JSON for Echo-owned tooling to interpret later.

The remaining gap is entirely adoption: jedit and its sibling runtimes replacing
handwritten shadow models with Wesley-generated artifacts.

## Progress Ledger

| Item                                                                          | Status      | Score |
| ----------------------------------------------------------------------------- | ----------- | ----: |
| Rust-native CLI is the primary Wesley front door                              | Done        |     8 |
| L1 schema lowering works for jedit-shaped models                              | Done        |     8 |
| Rust model emitter exists and is AST/printer-based                            | Done        |     8 |
| TypeScript model emitter exists and is AST/printer-based                      | Done        |     8 |
| Representative jedit model fixture is tracked in Wesley tests                 | Done        |     5 |
| Real jedit contract lowers and emits in local smoke checks                    | Done        |     5 |
| Full jedit runtime fixture is tracked hermetically in Wesley                  | Done        |     8 |
| Generic schema operation catalog preserves root args/results/directives       | Done        |    15 |
| Native CLI exposes schema operation inspection                                | Done        |     5 |
| Rust operation binding emission exists                                        | Done        |    10 |
| TypeScript operation binding emission exists                                  | Done        |    10 |
| `--metadata-out` deterministic sidecar records schema/law/bundle identity     | Done        |     5 |
| Provenance hash constants (`WESLEY_SCHEMA_HASH`, `WESLAW_HASH`) in Rust       | Done        |     5 |
| Law-backed validators (`RustScalarValidator`, `RustVariantValidator`) in Rust  | Done        |    10 |
| LE binary TypeScript codec for operation variable serialization                | Done        |     8 |
| Stable `OP_*` cross-language operation ID constants in LE codec               | Done        |     8 |
| Stack Witness 0001 jedit-adjacent fixture with pinned binary vectors          | Done        |     3 |
| jedit consumes generated artifacts without shadow models                      | Not started |     0 |

Current score: **129 / 139**.

## Next Move

Adopt the generated artifacts in the sibling repos that consume the contract.
Those changes should not be made from this repository session unless explicitly
authorized in those repos.

Suggested out-of-repo prompts:

- In the jedit repository: replace handwritten hot text runtime shadow models
  with Rust and TypeScript artifacts generated from Wesley's
  `test/fixtures/consumer-models/jedit-rope.graphql` equivalent,
  then update imports until jedit uses the generated request/response bindings.
- In the Echo repository: consume Wesley's schema operation catalog or generated
  Rust operation bindings, and keep Echo-owned `@wes_footprint` honesty checks
  in Echo rather than moving them into `wesley-core`. Echo's local `stable_op_id`
  copy (pinned to `wesley-core 0.0.4`) should be retired once the dep bumps to
  `0.0.5+` — both implementations are asserted against the same pinned outputs
  (`crates/wesley-core/src/domain/operation.rs`, commit `e953eaa2`).
- In the warp-ttd and Continuum repositories: treat Wesley-generated TypeScript
  operation bindings and the LE binary codec as the protocol boundary for jedit
  runtime operations.

The current generated operation surface connects root operations such as:

```graphql
createBufferWorldline(
  input: CreateBufferWorldlineInput!
): CreateBufferWorldlineResult!
```

The generated bindings now connect:

- operation kind, field name, argument object type, result type
- preserved directive metadata for downstream Echo-owned tooling
- `OP_*` stable numeric IDs for cross-language operation dispatch (commit `e953eaa2`)
- LE binary encode/decode for operation variable wire serialization (commit `03843264`)
- `WESLEY_SCHEMA_HASH` / `WESLAW_HASH` provenance anchors in generated Rust (commit `9212fde2`)
- law-backed scalar and variant validators when a `weslaw/v1` file is supplied (commit `47c6c863`)

## Progress

`[##############################################----] 93%`
