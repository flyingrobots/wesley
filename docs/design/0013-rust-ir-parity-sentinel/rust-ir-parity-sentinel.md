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
- comparison projection name
- legacy JS projected semantic bytes
- Rust projected semantic bytes
- legacy JS projected semantic hash
- Rust projected semantic hash
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

### Projection

The sentinel must not compare raw legacy JS table IR bytes directly against
raw Rust L1 bytes. Those shapes are intentionally different today: the legacy
JS adapter emits table-centered IR, while Rust L1 emits consolidated GraphQL
type definitions.

The first implementation uses a named `js-table-vs-rust-table.v0` projection.
Both lowerers must project into that shared comparison shape before bytes or
hashes are compared.

The projection includes:

- object types admitted as tables by `@wes_table` or its supported aliases
- effective table names
- field names and GraphQL type references
- canonical core Wesley directives and directive arguments
- table index, tenant, primary-key, default, and foreign-key facts derivable
  from the projected directives

The projection excludes:

- non-table scalar, enum, union, interface, and input-object-only semantics
- Rust-only extension-family coverage that has no legacy JS table-IR
  equivalent yet
- generated relationship records unless the projection derives the same fact
  from both lowerers

Each fixture admitted to the sentinel corpus must name the projection it uses.
Fixtures with no coherent legacy/Rust common projection remain Rust L1 corpus
fixtures until a separate crosswalk is designed.

### Normalization

The normalizer removes envelope-only data and keeps semantic data intact.

- Remove top-level `metadata`.
- Sort object keys with Wesley canonical JSON ordering before hashing.
- Preserve array order.
- Sort projection-created table arrays by deterministic code-point name order.
- Preserve directive argument values exactly after each lowerer has produced
  semantic IR.
- Require lowerers to emit canonical directive names for core Wesley aliases.
- Do not rewrite legacy alias spellings in the comparator. Alias
  normalization belongs in the lowerer, where schema semantics are known.

### Hash Behavior

The sentinel compares normalized projected semantic bytes and their SHA-256
digests.

It also verifies that the Rust `schema hash` command agrees with the digest of
the normalized Rust L1 semantic bytes. If those disagree, the Rust CLI/hash
path is inconsistent even before JS parity is considered.

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

## Implemented Slice

The first command slice implements the `js-table-vs-rust-table.v0` projection
and exposes it as:

```bash
pnpm parity:ir
```

The v0 corpus is explicit and table-compatible:

- `test/fixtures/ir-parity/small-schema.graphql`
- `test/fixtures/ir-parity/medium-schema.graphql`
- `test/fixtures/ir-parity/directive-heavy-schema.graphql`
- `test/fixtures/ir-parity/legacy-alias-schema.graphql`

The command lowers each fixture through the legacy JS adapter and the Rust CLI,
projects both outputs into the shared table shape, compares canonical projected
bytes and hashes, verifies `wesley schema hash` against the current Rust L1
semantic bytes after top-level `metadata` removal, checks tracked Rust L1 hashes
for `.graphql` fixtures when sidecars are present, and reports the first
mismatch path when projection parity fails.
JSON output records the canonical projected `legacyBytes` and `rustBytes`
alongside their hashes so reviewers can archive or inspect the exact compared
bytes.

`schema-extensions-schema.graphql` and `large-schema.graphql` remain outside
the default v0 sentinel corpus. The former still carries non-table Rust L1
coverage that needs a separate projection before it is fair parity evidence;
the latter is scale coverage rather than the first compatibility sentinel.

## Next Projection

The next projection is named in
[Type-family parity projection](./SOURCE_type-family-parity-projection.md).

It defines `js-sdl-type-family-vs-rust-l1-type-family.v0` for structural
GraphQL type-family facts that the legacy JS table adapter drops: scalars,
interfaces, unions, enums, input objects, object/interface implements, and
extension-folded fields or members.

`schema-extensions-schema.graphql` may enter the default sentinel corpus only
after that projection exists and passes. Running the fixture through
`js-table-vs-rust-table.v0` is useful table evidence, but it is not non-table
type-family parity evidence.

The supporting
[core-rs IR contract and fixtures note](./SOURCE_wesley-core-rs-ir-contract-and-fixtures.md)
records the release-scoped fixture classes, canonical byte rules, diagnostic
contract, and repo evidence. The preceding design slice also expanded the Rust
L1 corpus and closed one blocker the sentinel would otherwise expose
immediately: Rust L1 lowering now canonicalizes the core Wesley directive
aliases before writing semantic IR, rejects duplicate canonical core directives,
and preserves repeated custom directives as ordered values.

## Playback Questions

1. Is Rust fixture regeneration still separate from JS/Rust parity proof?
2. Does the design define comparator inputs, lowerers, normalization, hash
   behavior, and failure output?
3. Does the design forbid raw legacy table IR versus raw Rust L1 comparison
   and name a projection before comparing bytes?
4. Does the fixture corpus now cover directive-heavy SDL, schema extensions,
   legacy aliases, and at least one invalid-SDL case?
5. Does Rust L1 preserve canonical directive names for supported aliases?
6. Does `pnpm parity:ir` compare the v0 table-compatible corpus without
   changing the Rust golden-regeneration command?

## Non-Goals

- Do not retire legacy Node lowering in this packet.
- Do not treat product-specific Echo, jedit, Continuum, or database semantics
  as generic Wesley compiler work.
- Do not make the comparator hide semantic differences by rewriting IR after
  lowering.
- Do not turn invalid fixtures into inputs for `pnpm fixtures:ir`; invalid SDL
  belongs in explicit negative tests.
