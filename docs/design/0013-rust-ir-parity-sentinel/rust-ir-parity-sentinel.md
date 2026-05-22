---
title: Rust IR Parity Sentinel
legend: SOURCE
packet: 0013-rust-ir-parity-sentinel
status: active
release: v0.0.6
---

# Rust IR Parity Sentinel

## Sponsors

- Human: I can change the Rust compiler kernel and know whether I broke legacy
  JS compatibility, changed the canonical Rust L1 truth intentionally, or hit a
  known compatibility break that needs release notes.
- Agent: I can run one purpose-built parity check and get a small evidence
  bundle instead of treating Rust fixture regeneration as implicit JS/Rust
  proof.

## Hill

Wesley has a separate parity sentinel that compares the legacy JS lowerer and
the Rust lowerer over an explicit corpus after agreed non-semantic envelope
fields are normalized away.

`pnpm fixtures:ir` remains the Rust L1 golden-regeneration command. The parity
sentinel is a different check.

## Why This Cycle Exists

v0.0.5 cleaned up product backlog gravity and made Rust L1 fixture
regeneration honest. The next risk is semantic drift while Rust becomes the
primary compiler surface.

The old JS implementation is still the compatibility anchor for several
consumer-shaped schemas. Rust should not diverge silently on directive
spelling, extension folding, type shape, canonical JSON bytes, or registry
hashes.

## Comparator Contract

### Inputs

The sentinel consumes an explicit fixture list, not every `.graphql` file by
accident.

For each fixture it records:

- fixture path
- legacy JS semantic IR bytes
- Rust semantic IR bytes
- legacy JS semantic hash
- Rust semantic hash
- normalizer version
- command versions or commit identifiers when available

The first corpus should draw from `test/fixtures/ir-parity` after excluding
fixtures that intentionally assert Rust-only target-state behavior.

### Lowerers

The Rust side uses:

```bash
cargo run --quiet -p wesley-cli -- schema lower --schema <fixture> --json
cargo run --quiet -p wesley-cli -- schema hash --schema <fixture>
```

The legacy JS side uses the current truth anchors named in
[Phase 0: IR Truth Manifest](../0009-rust-core-and-wasm-capability-abi/phase-0-ir-truth-manifest.md):

- `GraphQLSchemaParser.parse`
- `buildIRFromAST`
- `canonicalize`
- `registryHash`
- `canonicalizeJSON`

### Normalization

The normalizer removes envelope-only data and keeps semantic data intact.

- Remove top-level `metadata`.
- Sort object keys with Wesley canonical JSON ordering before hashing.
- Preserve array order.
- Preserve directive argument values exactly after each lowerer has produced
  semantic IR.
- Require lowerers to emit canonical directive names for core Wesley aliases.
- Do not rewrite legacy alias spellings in the comparator. Alias
  normalization belongs in the lowerer, where schema semantics are known.

### Hash Behavior

The sentinel compares normalized semantic bytes and their SHA-256 digests.

It also verifies that the Rust `schema hash` command agrees with the digest of
the normalized Rust semantic bytes. If those disagree, the Rust CLI/hash path
is inconsistent even before JS parity is considered.

Tracked `*.l1.hash` files remain Rust golden outputs, not JS/Rust parity
evidence.

### Failure Output

Failure output must identify the first semantic mismatch without forcing the
reviewer to inspect a raw wall of JSON.

Each failure should include:

- fixture path
- legacy hash
- Rust hash
- mismatch JSON pointer path
- compact legacy/Rust value previews at that path
- whether the Rust tracked `.l1.hash` still matches the current Rust output
- the next decision: fix Rust, fix JS compatibility, update Rust goldens, or
  record an intentional compatibility break

## Current Slice

This first v0.0.6 slice does not implement the sentinel command yet.

It does pull the backlog card into design, expands the Rust L1 corpus, and
closes one blocker the sentinel would otherwise expose immediately: Rust L1
lowering now canonicalizes the core Wesley directive aliases before writing
semantic IR and rejects duplicate canonical directives.

## Playback Questions

1. Is Rust fixture regeneration still separate from JS/Rust parity proof?
2. Does the design define comparator inputs, lowerers, normalization, hash
   behavior, and failure output?
3. Does the fixture corpus now cover directive-heavy SDL, schema extensions,
   legacy aliases, and at least one invalid-SDL case?
4. Does Rust L1 preserve canonical directive names for supported aliases?
5. Is the next implementation slice narrow enough to add a `pnpm parity:ir`
   check without changing the Rust golden-regeneration command?

## Non-Goals

- Do not retire legacy Node lowering in this packet.
- Do not treat product-specific Echo, jedit, Continuum, or database semantics
  as generic Wesley compiler work.
- Do not make the comparator hide semantic differences by rewriting IR after
  lowering.
- Do not turn invalid fixtures into inputs for `pnpm fixtures:ir`; invalid SDL
  belongs in explicit negative tests.
