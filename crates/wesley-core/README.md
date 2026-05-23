# wesley-core

`wesley-core` is Wesley's Rust compiler kernel. It parses GraphQL SDL into
domain-empty Level 1 IR, computes schema hashes and schema deltas, and exposes
operation-selection and directive-argument analysis primitives.

This crate is intended to be embedded by native Wesley tools and by downstream
systems that need Wesley's GraphQL semantics without the CLI.

Execution boundaries that need explicit resilience policy can wrap a lowering
port with `ResilientLoweringPort` and a `ResiliencePolicy`. The wrapper uses
`ninelives` for Rust-side timeout policy while leaving ordinary deterministic
parse and semantic errors as compiler errors.

See the repository
[README](https://github.com/flyingrobots/wesley#readme) and
[architecture guide](https://github.com/flyingrobots/wesley/blob/main/docs/ARCHITECTURE.md)
for the full project context.
