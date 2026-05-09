# Rust core performance baseline

- Lane: `up-next`
- Legend: `EVIDENCE`

## Why now

Rust core is primarily an architecture and embedding move, but performance will
shape the Node cutover and Echo in-process story. The design should not make
performance claims without fixture-backed measurements.

## Hill

Wesley has baseline JS lowering measurements and target Rust/WASM measurements
for small, medium, and large schemas before any default cutover.

## Done looks like

- baseline current JS lowering wall-clock and memory are captured for the
  canonical fixture corpus
- Rust lowering measurements use the same corpus and output parity checks
- Node N-API and WASM binding overhead are measured separately from lowering
- Echo in-process measurement is captured when the Echo harness exists
- results are emitted as evidence artifacts or markdown tables
- cutover criteria include correctness parity and no normal-CLI regression

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/method/backlog/asap/SOURCE_wesley-core-rs-ir-contract-and-fixtures.md`
- `packages/wesley-core/test/`
