# wesley-core

`wesley-core` is Wesley's Rust compiler kernel. It parses GraphQL SDL into
domain-empty Level 1 IR, computes schema hashes and schema deltas, and exposes
operation-selection and directive-argument analysis primitives.

This crate is intended to be embedded by native Wesley tools and by downstream
systems that need Wesley's GraphQL semantics without the CLI.

See the repository [README](../../README.md) and
[architecture guide](../../docs/ARCHITECTURE.md) for the full project context.
