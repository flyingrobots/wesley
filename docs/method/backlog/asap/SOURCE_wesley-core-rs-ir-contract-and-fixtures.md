# Wesley core-rs IR contract and fixtures

- Lane: `asap`
- Legend: `SOURCE`

## Why now

The Rust core design is only useful if Rust can reproduce today's compiler
truth. The next move is Phase 0: freeze the canonical IR contract and fixture
corpus before any rewrite work starts.

## Hill

A maintainer can run one fixture command and compare current JS lowering against
the future Rust lowering target using canonical JSON bytes and clear mismatch
diagnostics.

## Done looks like

- current JS parse/lower/hash functions are listed
- canonical IR JSON byte rules are written down
- fixture corpus covers small, medium, large, directive-heavy, invalid, and
  schema-extension SDL cases
- expected diagnostics include stable codes and spans where available
- baseline JS lowering time and memory are captured for the fixture corpus
- parity failure output shows the first semantic mismatch, not just a raw diff
- the fixture corpus is linked from design packet `0009`

## Repo Evidence

- `docs/design/0009-rust-core-and-wasm-capability-abi/rust-core-and-wasm-capability-abi.md`
- `docs/RustCore.md`
- `packages/wesley-core/src/`
- `packages/wesley-core/test/`
- `schemas/`
