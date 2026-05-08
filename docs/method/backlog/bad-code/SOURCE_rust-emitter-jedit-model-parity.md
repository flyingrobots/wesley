# Rust Emitter Jedit Model Parity

- Lane: `bad-code`
- Legend: `SOURCE`

## Why now

`wesley emit rust` now emits basic Rust model declarations from Wesley L1 IR
through a structured Rust AST/printer projection. That proves the Rust-native
path for jedit-shaped GraphQL contracts, but it is still a model surface rather
than a complete jedit runtime binding.

## Hill

Wesley can generate the Rust contract layer that jedit, Echo, warp-ttd, and
Continuum can all treat as a shared authority, without any handwritten shadow
model beside the authored GraphQL schema.

## Done looks like

- generated Rust output is documented with examples
- object, interface, input object, enum, union, scalar, list, nullability, and
  reserved-word behavior are covered by golden tests
- generated models can be consumed by a jedit-facing Rust crate without local
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
