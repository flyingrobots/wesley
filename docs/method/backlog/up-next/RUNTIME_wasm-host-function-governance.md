# WASM host function governance

- Lane: `up-next`
- Legend: `RUNTIME`

## Why now

The Rust core design says WASM is the portable capability ABI, but portability
collapses if WASM modules receive different ambient host powers in Rust and
Node. Host functions need a deny-by-default policy before serious portable
capabilities exist.

## Hill

A WASM capability can declare its host imports, and Rust/Node hosts can enforce
the same policy or reject the capability before execution.

## Done looks like

- define the first `pure` host-function profile
- deny filesystem, network, env, process, and ambient clock access by default
- define how future host imports are named, versioned, and reported
- record fuel/time/memory policy expectations for Rust and Node hosts
- execution reports list requested imports, granted imports, denied imports,
  and host profile
- fixture proves a module requiring an unavailable import is rejected before it
  runs

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `crates/wesley-core/src/domain/capability.rs`
- `crates/wesley-core/tests/module_capability_registry.rs`
- `docs/method/backlog/bad-code/RUNTIME_module-loading-trust-boundary.md`
- `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs`

## Current Slice Status

The first pure host-function profile now exists in Rust and rejects unavailable
WASM host imports before execution. Remaining work is host-runtime integration,
resource budgets, and shared Rust/Node report emission.
