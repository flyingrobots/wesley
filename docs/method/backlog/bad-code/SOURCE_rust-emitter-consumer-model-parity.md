# Rust emitter consumer model parity

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

`wesley emit rust` now emits basic Rust model declarations from Wesley L1 IR
through a structured Rust AST/printer projection. That proves the Rust-native
model path for consumer-shaped GraphQL contracts, but it is still a model
surface rather than a complete runtime binding.

The jedit hot-text fixture remains useful coverage because it pressures real
consumer shapes. It should not make Wesley own jedit product behavior.

## Hill

Wesley can generate a Rust contract model layer that external consumers can
treat as shared artifact truth, without handwritten shadow models beside the
authored GraphQL schema.

## Done looks like

- generated Rust output is documented with examples
- object, interface, input object, enum, union, scalar, list, nullability, and
  reserved-word behavior are covered by golden tests
- generated models can be consumed by an external Rust crate without local
  structural rewrites
- serde behavior, crate imports, and custom scalar hooks are configurable enough
  for real consumers
- operation/protocol generation has an explicit owner and does not get smuggled
  into the basic model emitter

## Repo Evidence

- `crates/wesley-emit-rust/src/lib.rs`
- `crates/wesley-cli/src/main.rs`
- `test/fixtures/consumer-models/jedit-hot-text-core.graphql`
- `crates/wesley-emit-typescript/src/lib.rs`
