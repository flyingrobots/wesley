# WASM capability versioning and state

- Lane: `up-next`
- Legend: `RUNTIME`

## Why now

The capability ABI needs compatibility and state semantics before it becomes a
real plugin boundary. Hosts must know whether a kernel can run a capability, and
capabilities must not hide mutable state behind portable compiler truth.

## Hill

The first WASM capability ABI defines semver compatibility, rejection
diagnostics, and a stateless default model with explicit future resource
handles.

## Done looks like

- kernel semver and capability ABI semver are documented separately
- capabilities declare ABI version range and optional minimum kernel feature
  set
- hosts reject unsupported combinations with typed diagnostics before execution
- the first portable ABI profile is stateless
- any future state enters through explicit resources such as registry snapshots,
  cache handles, or session handles
- fixture proves hidden state cannot alter pure capability output

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `crates/wesley-core/src/domain/capability.rs`
- `crates/wesley-core/tests/module_capability_registry.rs`
- `docs/method/backlog/up-next/RUNTIME_wasm-host-function-governance.md`
- `docs/method/backlog/bad-code/EVIDENCE_module-load-report-release-artifact.md`

## Current Slice Status

Rust-native metadata, registry fixtures, ABI version range diagnostics,
stateless resource-handle rejection, and hermetic cross-host fixture checks now
exist. Remaining work is the full runtime ABI: actual WASM execution,
resource-handle implementation, kernel feature negotiation, and release
artifact reporting.
