---
title: Rust core performance baseline
legend: EVIDENCE
packet: 0013-rust-ir-parity-sentinel
status: active
release: v0.0.6
---

# Rust core performance baseline

## Why now

Rust core is primarily an architecture and embedding move, but performance will
shape the Node cutover and future in-process embedding story. The design should
not make performance claims without fixture-backed measurements.

## Hill

Wesley has a repeatable Rust CLI lowering wall-clock baseline over the explicit
Rust IR scale fixture corpus.

This slice does not claim JS/Rust speedup, Node binding overhead, WASM
overhead, peak RSS, or external consumer runtime performance. Those need
separate harnesses.

## Implemented Slice

The active Rust-native command is:

```bash
cargo xtask bench-ir
```

It builds the native `wesley` binary, generates advisory scale fixtures in a
temporary directory, lowers each fixture through `wesley schema lower --json`,
and reports wall-clock samples plus structural size counters.

The generated scale corpus currently covers:

- wide object and query field surfaces
- deep nested input references
- directive-heavy object, field, and argument surfaces
- operation-heavy Query and Mutation surfaces
- pathological-but-valid extension folding

The report includes:

- report API version
- current Git head
- lowerer command
- warmup and measured iteration counts
- fixture name
- SDL byte size
- L1 JSON output byte size
- type count
- field count
- directive count
- operation count
- duration samples, minimum, median, mean, and maximum milliseconds
- explicit `memory.peakRss: "not-captured"`

The command is evidence, not a threshold. It exits nonzero only when a fixture
cannot be lowered or the report cannot be assembled.

Useful invocations:

```bash
cargo xtask bench-ir
cargo --quiet xtask bench-ir --json
cargo xtask bench-ir --iterations 5 --warmups 1
cargo xtask bench-ir --output out/rust-ir-performance-baseline.json
```

The JSON report is most useful through `--output` when it needs to become
release evidence. Operators should store generated reports as release artifacts
or evidence attachments, not as recurring committed churn.

## Historical Surface

The v0.0.6 performance command was `pnpm perf:ir`, backed by
`scripts/measure-ir-performance.mjs` and `test/ir-performance-baseline.bats`.
Those files were deleted during the legacy Node retirement. Mentions of that
surface in historical release notes are archival, not current operator
guidance.

## Deferred Evidence

These remain intentionally outside v0:

- current JS lowering memory on the same corpus
- Rust peak RSS
- Node binding overhead
- WASM binding overhead
- external consumer in-process measurements
- pass/fail cutover thresholds beyond catastrophic command failure

The follow-on queue item is
`docs/design/0016-rust-core-binding-observatory/EVIDENCE_rust-core-binding-and-memory-baselines.md`.

## Playback Questions

1. Does Wesley have one command that measures Rust CLI lowering over the
   explicit scale fixture corpus?
2. Does the report include stable fixture identity, output identity, sample
   counts, and summary timings without implying a speed threshold?
3. Does the report include type, field, directive, and operation counts?
4. Does the report explicitly say peak RSS is not captured instead of guessing?
5. Do tests exercise the options, fixture corpus, metric counting, and summary
   math without relying on real timing values?

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/design/0013-rust-ir-parity-sentinel/SOURCE_wesley-core-rs-ir-contract-and-fixtures.md`
- `docs/design/0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md`
- `xtask/src/main.rs`
