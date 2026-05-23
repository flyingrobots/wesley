# Rust core binding and memory baselines

- Lane: `up-next`
- Legend: `EVIDENCE`

## Why now

`pnpm perf:ir` now records Rust CLI lowering wall-clock evidence over the
canonical IR fixture corpus. Cutover decisions still need memory and embedding
overhead evidence before Wesley can make stronger performance claims.

## Hill

Wesley can compare CLI lowering, JS lowering, Node binding, WASM binding, and
peak memory costs as separate measurements instead of collapsing them into one
runtime number.

## Done looks like

- JS lowering wall-clock and memory are measured against the same fixture
  corpus as `pnpm perf:ir`.
- Rust peak RSS is captured with a documented platform strategy.
- Node binding overhead is measured separately from Rust lowering time.
- WASM binding overhead is measured separately from Rust lowering time.
- Reports label host, binding, and memory dimensions explicitly.
- Cutover criteria combine correctness parity, latency, memory, and normal CLI
  regression risk without using external product harnesses as generic Wesley
  proof.

## Repo Evidence

- `docs/design/0013-rust-ir-parity-sentinel/EVIDENCE_rust-core-performance-baseline.md`
- `scripts/measure-ir-performance.mjs`
- `test/fixtures/ir-parity/`
