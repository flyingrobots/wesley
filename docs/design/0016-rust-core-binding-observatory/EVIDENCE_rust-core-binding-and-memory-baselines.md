---
title: Rust core binding and memory baselines
legend: EVIDENCE
packet: 0016-rust-core-binding-observatory
status: archived
---

# Rust core binding and memory baselines

## Why now

This packet recorded Rust CLI lowering wall-clock evidence over the canonical
IR fixture corpus before the legacy JavaScript compiler surface was deleted.
The Node binding comparison scripts were retired with that surface.

## Hill

Wesley compares CLI lowering, JS lowering, future Node binding, future WASM
binding, and memory costs as separate measurements instead of collapsing them
into one runtime number.

## Implemented Slice

The retired `pnpm perf:bindings` script emitted a binding observatory report:

```bash
pnpm perf:bindings -- --json
pnpm perf:bindings -- --markdown --output out/rust-core-binding-observatory.md
```

The report captures:

- Rust CLI lowering wall-clock samples, output bytes, type counts, and Rust L1
  semantic hashes.
- Legacy JS in-process lowering wall-clock samples.
- Legacy JS in-process heap-delta samples.
- Rust CLI peak RSS as an explicit `not-captured` evidence slot.
- Node-to-Rust binding as an explicit `not-implemented` evidence slot.
- WASM binding as an explicit `not-implemented` evidence slot.
- Cutover criteria as explicit `not-evaluated` release posture.

The fixture corpus remains useful as historical evidence, but the active
product gate is now `cargo xtask preflight`.

## Deferred Evidence

These remain intentionally outside this slice:

- real Node-to-Rust binding package implementation
- N-API versus alternate native-addon selection
- real WASM lowering package implementation
- Rust CLI peak RSS capture through a platform-specific child-process memory
  harness
- browser, edge, or external product workload evidence
- pass/fail cutover thresholds

## Playback Questions

1. Does `pnpm perf:bindings -- --json` list `rust-cli`,
   `legacy-js-in-process`, `node-rust-binding`, and `wasm-binding` adapter
   statuses?
2. Does the legacy JS adapter capture heap deltas while stating the caveat that
   Node heap deltas are process-local samples?
3. Does the Rust CLI adapter keep peak RSS as `not-captured` rather than
   guessing?
4. Do unimplemented binding paths appear as explicit report entries?
5. Does the report keep cutover status `not-evaluated`?

## Repo Evidence

- Historical script: `scripts/measure-ir-performance.mjs` was deleted during
  legacy Node retirement.
- Historical test: `test/ir-performance-baseline.bats` was deleted during
  legacy Node retirement.
- [Rust core performance baseline](../0013-rust-ir-parity-sentinel/EVIDENCE_rust-core-performance-baseline.md)
