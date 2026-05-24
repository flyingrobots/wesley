# Capability portability floor

- Lane: `up-next`
- Legend: `RUNTIME`

## Why now

TypeScript modules remain the easiest authoring path. Without an explicit
portability floor, important features may stay trapped in Node-only modules and
never prove the WASM or Rust-host story.

## Hill

New cross-host capability families prove a WASM fixture or explicitly declare
themselves Node-only.

## Done looks like

- capability metadata includes execution mode such as `typescript-node`,
  `wasm`, `rust-native`, or `wasm-or-native`
- docs mark TypeScript modules as Node-hosted unless compiled to WASM
- module-load and capability execution reports show execution mode
- cross-host capability families require at least one WASM fixture before being
  called portable
- Node-only capabilities remain allowed but cannot be mistaken for portable
  module truth

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/design/0017-rust-native-front-door-and-node-retirement/HOST_COMPATIBILITY_BOUNDARY.md`
- `crates/wesley-core/src/domain/capability.rs`
- `crates/wesley-core/tests/module_capability_registry.rs`
- `docs/method/backlog/cool-ideas/DX_inspect-module-capabilities-command.md`
- `docs/method/backlog/cool-ideas/DX_module-authoring-and-loading-guide.md`

## Current Slice Status

Execution mode and portability floor metadata now live in Rust. Hermetic
fixture checks prove that portable capability outputs must agree across
Rust-native, WASM, and external-process hosts for the same input digest.
Browser, Bun, Deno, and Node host packages are explicitly compatibility lanes,
not proof of portable compiler truth.
