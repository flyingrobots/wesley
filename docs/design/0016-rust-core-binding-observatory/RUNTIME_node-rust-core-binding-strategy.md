---
title: Node Rust core binding strategy
legend: RUNTIME
packet: 0016-rust-core-binding-observatory
status: archived
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

This packet did not implement that binding. It defined the decision matrix and
created the observatory evidence contract used before the legacy Node compiler
surface was deleted.

## Decision Matrix

| Candidate              | Strength                                                     | Risk                                                                                 | Evidence needed before selection                                                                 |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Rust CLI child process | Already works, simplest rollback, honors current native CLI. | Includes process startup and serialization cost.                                     | Current `rust-cli` observatory adapter plus peak RSS strategy.                                   |
| Legacy JS in process   | Already works in Node package tooling.                       | Keeps the two-brain migration alive and cannot prove Rust-core cutover.              | Current `legacy-js-in-process` observatory adapter plus parity evidence.                         |
| N-API/native addon     | Likely best hot path for Node CLI once packaged.             | Packaging, CI, ABI, install, and fallback complexity.                                | Future `node-rust-binding` adapter with call overhead, startup, memory, and fallback evidence.   |
| WASM binding           | Portable across more hosts.                                  | Host ABI, fuel/time/memory governance, and feature compatibility are not proved yet. | Future `wasm-binding` adapter plus capability portability and host-function governance evidence. |

## Current Strategy

1. Keep Rust CLI as the authoritative native compiler path.
2. Treat the legacy JS lowering fallback as retired.
3. Treat the retired `pnpm perf:bindings` report as historical migration
   evidence.
4. Do not choose N-API or WASM as the production Node binding until a real
   adapter measures binding overhead and memory.
5. Treat WASM as the portability path, not automatically the hot path.

## Rollback Behavior

Until a real binding exists, rollback is simple:

- native users continue using `wesley` from `wesley-cli`
- Node package users moved off the retired compiler surface
- observatory reports kept future binding paths as `not-implemented`

When a real binding lands, the binding must define:

- how a non-Rust host falls back to Rust CLI or another explicit owner
- which failures are deterministic compiler errors
- which failures are binding/package/runtime failures
- whether fallback is automatic, opt-in, or disabled in CI

## Non-Claims

- No Node binding package is shipped by this strategy note.
- No WASM package is shipped by this strategy note.
- No default CLI behavior changes.
- Legacy JS lowering retirement was authorized later by the Node retirement
  campaign, not by this packet alone.

## Repo Evidence

- [Rust core binding observatory](./rust-core-binding-observatory.md)
- [EVIDENCE_rust-core-binding-and-memory-baselines.md](./EVIDENCE_rust-core-binding-and-memory-baselines.md)
- [Rust core and WASM capability ABI](../0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md)
- Historical packages deleted during legacy Node retirement:
  `packages/wesley-host-node/`, `packages/wesley-cli/`, and
  `packages/wesley-runtime-node/`.
