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
- Both emitters have tests against the jedit-shaped fixture.
- A local smoke check against the real jedit hot text contract succeeded on
  2026-05-08:
  - schema lowering succeeded
  - Rust model emission succeeded
  - TypeScript declaration emission succeeded

## Capability Gap

The real jedit contract is more than a data model. Its root `Query` and
`Mutation` fields define capability-like surfaces, including inputs, return
types, and generic directive data.

Wesley currently lowers root fields and field directives, but L1 fields do not
carry field arguments. That means the emitters can produce model declarations
for `Mutation` and `Query`, but they do not yet produce useful operation or
capability bindings such as:

- operation name
- query versus mutation kind
- argument list and input object type
- result type
- directive payloads attached to the root field

That gap matters for jedit because capabilities are invoked operations, not
just structs.

## Progress Ledger

| Item | Status | Weight |
| --- | --- | ---: |
| Rust-native CLI is the primary Wesley front door | Done | 10 |
| L1 schema lowering works for jedit-shaped models | Done | 10 |
| Rust model emitter exists and is AST/printer-based | Done | 10 |
| TypeScript model emitter exists and is AST/printer-based | Done | 10 |
| Representative jedit fixture is tracked in Wesley tests | Done | 8 |
| Real jedit contract lowers and emits in local smoke checks | Partial | 7 |
| Full real-contract fixture is tracked hermetically in Wesley | Not started | 10 |
| Generic schema operation/capability catalog preserves root args | Not started | 20 |
| Rust/TypeScript operation binding emission exists | Not started | 15 |
| jedit consumes generated artifacts without shadow models | Not started | 10 |

Current score: 42 / 100.

## Next Move

Add a generic schema operation catalog to Wesley core and test it with a copied
full jedit hot text contract fixture.

The API should stay domain-empty and Echo-neutral. It should describe GraphQL
root operation fields as data:

```rust
pub struct SchemaOperation {
    pub operation_type: OperationType,
    pub field_name: String,
    pub arguments: Vec<OperationArgument>,
    pub result_type: TypeReference,
    pub directives: BTreeMap<String, serde_json::Value>,
}
```

The first CLI surface should be inspection, not generation:

```bash
wesley schema operations --schema <path> --json
```

Once that is proven, Rust and TypeScript operation binding emission can build on
the catalog instead of inventing separate parser paths.

## Progress

`[#####################-----------------------------] 42%`
