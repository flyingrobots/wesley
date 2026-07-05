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

The sentinel uses named projections. Both sides must project into the selected
shared comparison shape before bytes or hashes are compared.

The implemented v0 projections are:

- `js-table-vs-rust-table.v0`
- `js-sdl-type-family-vs-rust-l1-type-family.v0`

The table projection includes:

- object types admitted as tables by `@wes_table` or its supported aliases
- effective table names
- field names and GraphQL type references
- canonical core Wesley directives and directive arguments
- table index, tenant, primary-key, default, and foreign-key facts derivable
  from the projected directives

The type-family projection includes structural GraphQL facts that the legacy JS
table adapter drops:

- scalar, object, interface, union, enum, and input object names
- object/interface implemented interfaces
- object/interface/input field names, type references, default values, and
  directives
- union members and enum values
- extension-folded members, values, fields, interfaces, and directives

The projections exclude:

- generated relationship records unless the projection derives the same fact
  from both lowerers
- target-specific product, database, runtime, or generated-code semantics

Each fixture admitted to the sentinel corpus must name the projection it uses.
Fixtures with no coherent legacy/Rust common projection remain Rust L1 corpus
fixtures until a separate crosswalk is designed.

### Normalization

The normalizer removes envelope-only data and keeps semantic data intact.

- Remove top-level `metadata`.
- Sort object keys with Wesley canonical JSON ordering before hashing.
- Preserve authored array order unless a projection contract declares a field
  as an unordered semantic fact set.
- Sort projection-created table and type-family fact arrays by deterministic
  code-point order.
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

The command slices implement `js-table-vs-rust-table.v0` and
`js-sdl-type-family-vs-rust-l1-type-family.v0`, exposed as:

```bash
pnpm parity:ir
```

The v0 corpus is explicit and projection-owned:

- `test/fixtures/ir-parity/small-schema.graphql` under
  `js-table-vs-rust-table.v0`
- `test/fixtures/ir-parity/medium-schema.graphql` under
  `js-table-vs-rust-table.v0`
- `test/fixtures/ir-parity/directive-heavy-schema.graphql` under
  `js-table-vs-rust-table.v0`
- `test/fixtures/ir-parity/legacy-alias-schema.graphql` under
  `js-table-vs-rust-table.v0`
- `test/fixtures/ir-parity/schema-extensions-schema.graphql` under
  `js-sdl-type-family-vs-rust-l1-type-family.v0`
- `test/fixtures/ir-parity/nested-list-schema.graphql` under
  `js-sdl-type-family-vs-rust-l1-type-family.v0`

The command lowers each fixture through its projection-owned JS lowerer and the
Rust CLI, projects both outputs into the selected shared shape, compares
canonical projected bytes and hashes, verifies `wesley schema hash` against the
current Rust L1 semantic bytes after top-level `metadata` removal, checks
tracked Rust L1 hashes for `.graphql` fixtures when sidecars are present, and
reports the first mismatch path when projection parity fails.
JSON output records the canonical projected `legacyBytes` and `rustBytes`
alongside their hashes so reviewers can archive or inspect the exact compared
bytes.

`large-schema.graphql` remains outside the default v0 sentinel corpus as scale
coverage rather than first-pass compatibility evidence.

## Parser Parity Spike

The pulled [parser parity spike](./SOURCE_parser-parity-spike.md) adds:

```bash
pnpm parity:parser
```

This command compares legacy `GraphQLAdapter.parseSDL` acceptance with Rust
`wesley schema lower` acceptance over parser-sensitive fixtures. It records
both-accepted valid SDL, both-rejected syntax errors, and both-rejected
duplicate canonical core directives after alias normalization.

The spike kept `apollo-parser` for v0.0.6 and closed one projection gap by
admitting nested list type references to the type-family projection instead of
adding a third projection.

## Performance Baseline

The pulled
[Rust core performance baseline](./EVIDENCE_rust-core-performance-baseline.md)
slice now uses the Rust-native advisory command:

```bash
cargo xtask bench-ir
```

The current baseline measures Rust CLI `schema lower` wall-clock samples over
generated scale fixtures covering wide schemas, deep input references,
directive-heavy schemas, operation-heavy schemas, and extension folding. It
records fixture identity, SDL byte size, output byte size, type count, field
count, directive count, operation count, sample durations, and summary timings.

The retired `pnpm perf:ir` command and legacy JS comparison mode are archival
v0.0.6 evidence only. The active command is not Node binding overhead, WASM
binding overhead, peak RSS, or a cutover threshold.

## Type-Family Projection

The second projection is defined in
[Type-family parity projection](./SOURCE_type-family-parity-projection.md).

It implements `js-sdl-type-family-vs-rust-l1-type-family.v0` for structural
GraphQL type-family facts that the legacy JS table adapter drops: scalars,
interfaces, unions, enums, input objects, object/interface implements, and
extension-folded fields or members.

`schema-extensions-schema.graphql` and `nested-list-schema.graphql` are
admitted to the default sentinel corpus under this projection. Running the
schema-extension fixture through `js-table-vs-rust-table.v0` remains useful
table evidence, but it is not the evidence that admits the non-table
type-family facts.

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
   nested list references, legacy aliases, and at least one invalid-SDL case?
5. Does Rust L1 preserve canonical directive names for supported aliases?
6. Does `pnpm parity:ir` compare the projection-owned v0 corpus without
   changing the Rust golden-regeneration command?
7. Does `pnpm parity:parser` keep parser acceptance evidence separate from
   semantic projection parity?

## Non-Goals

- Do not retire legacy Node lowering in this packet.
- Do not treat product-specific Echo, jedit, Continuum, or database semantics
  as generic Wesley compiler work.
- Do not make the comparator hide semantic differences by rewriting IR after
  lowering.
- Do not turn invalid fixtures into inputs for `pnpm fixtures:ir`; invalid SDL
  belongs in explicit negative tests.
