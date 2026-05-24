---
title: Node Rust core binding strategy
legend: RUNTIME
packet: 0016-rust-core-binding-observatory
status: active
---

# Node Rust core binding strategy

## Why now

The design allows Node to call Rust through a native binding or WASM. The
likely production answer may be N-API for CLI hot paths with WASM as the
portable fallback, but Wesley should not make that decision from taste.

The first strategy decision is therefore evidence-first:

> Measure the boundary before choosing the binding.

## Hill

The Node host can call the Rust kernel through a chosen primary binding and a
documented fallback without changing CLI behavior.

This packet does not implement that binding yet. It defines the decision matrix
and creates the observatory evidence contract that future binding
implementations must satisfy.

## Decision Matrix

| Candidate              | Strength                                                     | Risk                                                                                 | Evidence needed before selection                                                                 |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Rust CLI child process | Already works, simplest rollback, honors current native CLI. | Includes process startup and serialization cost.                                     | Current `rust-cli` observatory adapter plus peak RSS strategy.                                   |
| Legacy JS in process   | Already works in Node package tooling.                       | Keeps the two-brain migration alive and cannot prove Rust-core cutover.              | Current `legacy-js-in-process` observatory adapter plus parity evidence.                         |
| N-API/native addon     | Likely best hot path for Node CLI once packaged.             | Packaging, CI, ABI, install, and fallback complexity.                                | Future `node-rust-binding` adapter with call overhead, startup, memory, and fallback evidence.   |
| WASM binding           | Portable across more hosts.                                  | Host ABI, fuel/time/memory governance, and feature compatibility are not proved yet. | Future `wasm-binding` adapter plus capability portability and host-function governance evidence. |

## Current Strategy

1. Keep Rust CLI as the authoritative native compiler path.
2. Keep legacy JS lowering as compatibility fallback during parity migration.
3. Use `pnpm perf:bindings` to collect fixture-backed evidence for paths that
   exist today.
4. Do not choose N-API or WASM as the production Node binding until a real
   adapter measures binding overhead and memory.
5. Treat WASM as the portability path, not automatically the hot path.

## Rollback Behavior

Until a real binding exists, rollback is simple:

- native users continue using `wesley` from `wesley-cli`
- Node package users continue using existing JS paths
- observatory reports keep future binding paths as `not-implemented`

When a real binding lands, the binding must define:

- how the Node host falls back to Rust CLI or legacy JS
- which failures are deterministic compiler errors
- which failures are binding/package/runtime failures
- whether fallback is automatic, opt-in, or disabled in CI

## Non-Claims

- No Node binding package is shipped by this strategy note.
- No WASM package is shipped by this strategy note.
- No default CLI behavior changes.
- No legacy JS lowering retirement is authorized.

## Repo Evidence

- [Rust core binding observatory](./rust-core-binding-observatory.md)
- [EVIDENCE_rust-core-binding-and-memory-baselines.md](./EVIDENCE_rust-core-binding-and-memory-baselines.md)
- [Rust core and WASM capability ABI](../0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md)
- [`packages/wesley-host-node/`](../../../packages/wesley-host-node/)
- [`packages/wesley-cli/`](../../../packages/wesley-cli/)
- [`packages/wesley-runtime-node/`](../../../packages/wesley-runtime-node/)
