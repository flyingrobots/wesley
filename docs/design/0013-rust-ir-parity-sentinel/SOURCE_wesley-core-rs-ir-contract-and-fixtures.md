---
title: Wesley core-rs IR contract and fixtures
legend: SOURCE
packet: 0013-rust-ir-parity-sentinel
status: active
release: v0.0.6
---

# Wesley core-rs IR contract and fixtures

## Why now

The Rust core design is only useful if Rust can reproduce today's compiler
truth. This note pulls the old ASAP backlog card into the active
`0013-rust-ir-parity-sentinel` packet so fixture classes, canonical bytes,
diagnostics, and performance evidence are release-scoped instead of floating in
the queue.

## Hill

A maintainer can run one fixture command and compare current JS lowering against
the Rust lowering target using canonical JSON bytes and clear mismatch
diagnostics, without treating product or database semantics as Wesley core.

## Contract Surface

The fixture contract is owned by generic Wesley compiler truth:

- Rust L1 fixtures live under `test/fixtures/ir-parity/`.
- Invalid SDL fixtures live under `test/fixtures/ir-parity-invalid/`.
- Rust golden regeneration is `pnpm fixtures:ir`.
- JS/Rust parity evidence is `pnpm parity:ir`.
- The current parity projections are `js-table-vs-rust-table.v0` and
  `js-sdl-type-family-vs-rust-l1-type-family.v0`.
- The Rust command surface is `cargo run --quiet -p wesley-cli -- schema ...`.
- The legacy JS anchors are the parse, lower, canonicalize, registry-hash, and
  canonical JSON functions named in
  [Phase 0: IR Truth Manifest](../0009-rust-core-and-wasm-capability-abi/phase-0-ir-truth-manifest.md).

## Fixture Classes

The v0.0.6 corpus must keep these classes explicit:

- **Small table SDL**: a narrow compatibility fixture for fast smoke feedback.
- **Medium table SDL**: broader table, directive, and relation coverage.
- **Large SDL**: scale coverage for regeneration and later performance
  baselines, not first-pass parity proof.
- **Directive-heavy SDL**: directive argument and canonical alias truth.
- **Legacy alias SDL**: compatibility input for supported core aliases.
- **Schema-extension SDL**: Rust L1 coverage admitted to the default sentinel
  corpus under the type-family parity projection.
- **Invalid SDL**: negative diagnostics with stable codes and spans where the
  lowerer can provide them.

The schema-extension admission projection is
[Type-family parity projection](./SOURCE_type-family-parity-projection.md).

## Canonical Bytes

- Canonical JSON is UTF-8, newline-free, sorted-object-key JSON.
- Projection-created arrays sort only when the projection contract says they
  are unordered facts; authored or semantic array order is preserved.
- Top-level Rust L1 `metadata` is removed before parity-sensitive hashing.
- Directive names must be canonicalized by lowerers, not rewritten by the
  comparator.
- Repeated custom directives remain ordered values unless the lowerer rejects
  them as invalid under a named rule.
- Tracked `*.l1.hash` sidecars are Rust golden evidence, not JS/Rust parity
  evidence.

## Diagnostics

Invalid SDL coverage should record:

- a stable error code from `WesleyError::diagnostic()`
- the fixture path
- a stable message shape that names the violated rule
- line and column spans where the parser or lowerer can preserve them
- an explicit note when a span is unavailable or intentionally unstable

The diagnostic contract is not allowed to hide invalid inputs by normalizing
them into fixture outputs.

Current v0.0.6 behavior:

- parse errors use `WESLEY_PARSE_ERROR` and preserve line/column spans derived
  from Apollo's parser byte index
- semantic lowering errors use `WESLEY_LOWERING_ERROR`
- semantic lowering errors do not yet expose source spans, so duplicate
  canonical directive coverage asserts `line: null` and `column: null`

## Done looks like

- current JS parse/lower/hash functions are listed in the truth manifest
- canonical IR JSON byte rules are written down here and in the sentinel packet
- fixture corpus covers small, medium, large, directive-heavy, invalid,
  legacy-alias, and schema-extension SDL cases
- expected diagnostics include stable codes and spans where available
- baseline Rust lowering time and memory are captured for the fixture corpus
- parity failure output shows the first semantic mismatch, not just a raw diff
- packet `0009`, packet `0013`, and follow-on backlog items link to this note

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/design/0009-rust-core-and-wasm-capability-abi/phase-0-ir-truth-manifest.md`
- `docs/design/0013-rust-ir-parity-sentinel/rust-ir-parity-sentinel.md`
- `docs/RustCore.md`
- `crates/wesley-core/src/`
- `crates/wesley-core/tests/`
- `crates/wesley-cli/tests/`
- `schemas/`
- `scripts/generate-ir-fixtures.mjs`
- `scripts/check-ir-parity.mjs`
- `test/fixtures/ir-parity/`
- `test/fixtures/ir-parity-invalid/`
