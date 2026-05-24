# wesley-core

`wesley-core` is Wesley's Rust compiler kernel. It parses GraphQL SDL into
domain-empty Level 1 IR, computes schema hashes and schema deltas, and exposes
operation-selection and directive-argument analysis primitives.

This crate is intended to be embedded by native Wesley tools and by downstream
systems that need Wesley's GraphQL semantics without the CLI.

Execution boundaries that need explicit resilience policy can wrap a lowering
port with `ResilientLoweringPort` and a `ResiliencePolicy`. The wrapper uses
`ninelives` for Rust-side cooperative timeout policy while leaving ordinary
deterministic parse and semantic errors as compiler errors.

Rust-native module planning can use `ModuleTargetRegistry`,
`ModuleTargetDescriptor`, and `HostFunctionPolicy` to model target selection,
execution mode, portability floor, requested/granted/denied capabilities, and
deny-by-default WASM host imports before any dynamic module or WASM execution
hook exists.

The timeout observes async cancellation points. It does not preempt
synchronous CPU-bound parser or lowering work that runs to completion inside a
single future poll; lowerers that need hard deadlines should run behind a
process, thread, or runtime boundary that can be cancelled independently.

See the repository
[README](https://github.com/flyingrobots/wesley#readme) and
[architecture guide](https://github.com/flyingrobots/wesley/blob/main/docs/ARCHITECTURE.md)
for the full project context.
