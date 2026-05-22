# Phase 0: IR Truth Manifest

This document records the legacy JS implementation anchors and the current Rust
L1 fixture corpus required for the Wesley Rust Core parity migration.

## Canonical JS Functions

The following functions in the existing JS codebase are the "Truth Anchors" for
compiler behavior:

| Area | Package | File | Function |
| :--- | :--- | :--- | :--- |
| **Parsing & Lowering** | `@wesley/runtime-node` | `src/GraphQLAdapter.mjs` | `GraphQLSchemaParser.parse` |
| **IR Construction** | `@wesley/runtime-node` | `src/GraphQLAdapter.mjs` | `buildIRFromAST` |
| **Canonicalization** | `@wesley/core` | `src/domain/canonicalize.mjs` | `canonicalize` |
| **Hashing** | `@wesley/core` | `src/domain/registryHash.mjs` | `registryHash` |
| **JSON Serialization** | `@wesley/core` | `src/domain/registryHash.mjs` | `canonicalizeJSON` |

## Canonical JSON Byte Rules

To achieve byte-level parity between Rust and JS, the following serialization
rules are MANDATORY:

1. **Key Ordering:** Object keys must be sorted lexicographically by Unicode
   code point at every level.
2. **Compactness:** No whitespace between keys, values, or structural
   characters (`:`, `,`, `{`, `}`, `[`, `]`).
3. **UTF-8:** Output must be valid UTF-8.
4. **No Escaping:** Non-essential escaping (e.g., escaping forward slashes `/`)
   should be avoided to match `JSON.stringify` default behavior.
5. **Numeric Stability:** Integers should be serialized without decimal points.
   Floating point numbers should use standard notation.
6. **Metadata Exclusion:** The `metadata` field is an envelope, not semantic
   IR. It MUST be stripped before computing the parity hash. The JS adapter now
   emits a stable `generatedAt` value for compatibility so repeated parses of
   identical SDL do not change IR bytes solely because wall-clock time advanced.

## Fixture Corpus

The fixture corpus is stored in `test/fixtures/ir-parity` and consists of
`SDL -> L1 IR -> Hash` triplets:

- `*.graphql` stores the SDL input.
- `*.l1.json` stores the Rust-native L1 IR emitted by `wesley schema lower`.
- `*.l1.hash` stores the Rust-native L1 hash emitted by `wesley schema hash`.

Invalid SDL fixtures live in `test/fixtures/ir-parity-invalid`. They are not
processed by `pnpm fixtures:ir`; they are consumed by explicit negative Rust
tests.

### Stable L1 Hashes

| Fixture | Hash (SHA-256) |
| :--- | :--- |
| `small-schema.graphql` | `b484bf6741686314aea381b51d5d26805b08fa27517225bbe4b736d9f39c606f` |
| `medium-schema.graphql` | `853d939364506680535ae865438d897efc9fee2dc8e5b21d1118cae3cfe5664b` |
| `large-schema.graphql` | `dfd5a42ab6a03570294764e4e9bdd791b5dd42fc02db5feb9543849a67d14726` |
| `directive-heavy-schema.graphql` | `e2e831e55a3b439322c49057e6ad2c6e28e6446e0b6f79fa1cae2a8b102053e3` |
| `schema-extensions-schema.graphql` | `72d4d2db0d705fb59117a4c9f2e55ade187e435829253bb862aabd6dee5c9f99` |
| `legacy-alias-schema.graphql` | `95b4c726cfccf7874ba2e5d01a216cb1f31c0abce0ea060885899a5d79281aa6` |

### Categories

1. **Small:** Basic table with scalar fields and `@wes_pk`. (**COMPLETE**)
2. **Medium:** Multiple tables, `@wes_fk` relationships, and `@wes_index`.
   (**COMPLETE**)
3. **Large:** 100+ types to test performance and memory scaling. (**COMPLETE**)
4. **Directive-Heavy:** Extensive use of `@wes_rls`, `@wes_tenant`, and
   `@wes_default`, including directive arguments with arrays and object
   values. (**COMPLETE**)
5. **Invalid:** SDL cases that MUST trigger specific `WesleyParseError` codes.
   (**STARTED**; current Rust coverage rejects duplicate canonical directives,
   while stable diagnostic codes and spans remain future work.)
6. **Schema-Extensions:** Testing JS and Rust extension folding for scalar,
   object, interface, union, enum, and input object types. (**COMPLETE**)
7. **Legacy-Aliases:** Using `@table`, `@pk`, `@primaryKey`, `@tenant`, and
   related core aliases to ensure Rust L1 emits canonical `@wes_*` directive
   names. (**COMPLETE for the current core compiler alias set**)

## Baseline Performance (JS)

*Captured on: May 5, 2026*
*Environment: Darwin (macOS)*

NOTE: These are rough measurements to be formalized in
`EVIDENCE_rust-core-performance-baseline.md`.

| Fixture | Lowering Time (ms) | Memory Peak (MB) |
| :--- | :--- | :--- |
| `small-schema.graphql` | ~2ms | < 1MB |
| `medium-schema.graphql` | ~15ms | ~2MB |
| `large-schema.graphql` | ~250ms | ~15MB |

## Commands

### Generate Fixtures

```bash
pnpm fixtures:ir
```

This command shells through the native Wesley CLI and overwrites only the
tracked `*.l1.json` and `*.l1.hash` outputs. It exits nonzero if any fixture
fails to lower or hash.

### Verify Rust Parity

```bash
cd crates/wesley-core && cargo test
```
