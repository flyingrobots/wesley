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
Rust IR fixture corpus before any default cutover.

This slice does not claim JS/Rust speedup, Node binding overhead, WASM overhead,
peak RSS, or external consumer runtime performance. Those need separate
harnesses.

## Implemented Slice

`pnpm perf:ir` runs:

```bash
node scripts/measure-ir-performance.mjs
```

The v0 report records Rust CLI `schema lower` wall-clock samples over the
explicit valid Rust IR fixture corpus:

- `test/fixtures/ir-parity/small-schema.graphql`
- `test/fixtures/ir-parity/medium-schema.graphql`
- `test/fixtures/ir-parity/large-schema.graphql`
- `test/fixtures/ir-parity/directive-heavy-schema.graphql`
- `test/fixtures/ir-parity/legacy-alias-schema.graphql`
- `test/fixtures/ir-parity/schema-extensions-schema.graphql`
- `test/fixtures/ir-parity/nested-list-schema.graphql`

The report includes:

- report tool version
- current Git head
- lowerer command
- warmup and measured iteration counts
- fixture path
- SDL byte size
- Rust L1 output byte size
- Rust L1 semantic hash with top-level `metadata` removed
- type count
- duration samples, minimum, median, mean, and maximum milliseconds
- optional in-process legacy JS lowering samples when
  `--include-legacy-js` is passed
- explicit `memory.status: "not-captured"`

The command is evidence, not a threshold. It exits nonzero only when a fixture
cannot be lowered or the report cannot be assembled.

Useful invocations:

```bash
pnpm perf:ir -- --json
pnpm perf:ir -- --include-legacy-js --json
pnpm perf:ir -- --markdown --output out/rust-ir-performance-baseline.md
pnpm perf:ir -- --fixture test/fixtures/ir-parity/large-schema.graphql --iterations 5
```

## Deferred Evidence

These remain intentionally outside v0:

- current JS lowering memory on the same corpus
- Rust peak RSS
- Node binding overhead
- WASM binding overhead
- external consumer in-process measurements
- pass/fail cutover thresholds

The follow-on queue item is
`docs/method/backlog/up-next/EVIDENCE_rust-core-binding-and-memory-baselines.md`.

## Playback Questions

1. Does Wesley have one command that measures Rust CLI lowering over the
   explicit valid IR fixture corpus?
2. Does the report include stable fixture identity, output identity, sample
   counts, and summary timings without implying a speed threshold?
3. Does the report explicitly say memory is not captured in v0?
4. Can optional JS comparison evidence be captured without presenting it as
   Node binding, WASM, memory, or cutover evidence?
5. Can tests exercise the report contract through a fake lowerer without
   relying on real timing values?

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/design/0013-rust-ir-parity-sentinel/SOURCE_wesley-core-rs-ir-contract-and-fixtures.md`
- `docs/design/0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md`
- `scripts/measure-ir-performance.mjs`
- `test/ir-performance-baseline.bats`
- `test/fixtures/ir-parity/`
