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
- `docs/method/backlog/cool-ideas/DX_inspect-module-capabilities-command.md`
- `docs/method/backlog/cool-ideas/DX_module-authoring-and-loading-guide.md`
