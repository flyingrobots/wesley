# Node Rust core binding strategy

- Lane: `up-next`
- Legend: `RUNTIME`

## Why now

The design allows Node to call Rust through N-API or WASM. The likely production
answer is N-API for the CLI hot path, with WASM as the portable fallback, but
that needs a measured binding strategy rather than an assumption.

## Hill

The Node host can call the Rust kernel through a chosen primary binding and a
documented fallback without changing CLI behavior.

## Done looks like

- compare N-API and WASM binding packaging, startup cost, call overhead, CI
  complexity, and fallback behavior
- choose the first production binding for `pnpm wesley`
- decide whether browser/edge hosts use the same package or a separate WASM
  package
- add a side-by-side switch for JS and Rust lowering during parity migration
- document rollback behavior if Rust lowering fails in the Node host

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `packages/wesley-host-node/`
- `packages/wesley-cli/`
- `packages/wesley-runtime-node/`
