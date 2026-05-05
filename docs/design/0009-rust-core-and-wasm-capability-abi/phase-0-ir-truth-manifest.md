# Phase 0: IR Truth Manifest

This document records the canonical JS implementation details and the fixture corpus required for the Wesley Rust Core (core-rs) parity migration.

## Canonical JS Functions

The following functions in the existing JS codebase are the "Truth Anchors" for compiler behavior:

| Area | Package | File | Function |
| :--- | :--- | :--- | :--- |
| **Parsing & Lowering** | `@wesley/runtime-node` | `src/GraphQLAdapter.mjs` | `GraphQLSchemaParser.parse` |
| **IR Construction** | `@wesley/runtime-node` | `src/GraphQLAdapter.mjs` | `buildIRFromAST` |
| **Canonicalization** | `@wesley/core` | `src/domain/canonicalize.mjs` | `canonicalize` |
| **Hashing** | `@wesley/core` | `src/domain/registryHash.mjs` | `registryHash` |
| **JSON Serialization** | `@wesley/core` | `src/domain/registryHash.mjs` | `canonicalizeJSON` |

## Canonical JSON Byte Rules

To achieve byte-level parity between Rust and JS, the following serialization rules are MANDATORY:

1.  **Key Ordering:** Object keys must be sorted lexicographically by Unicode code point at every level.
2.  **Compactness:** No whitespace between keys, values, or structural characters (`:`, `,`, `{`, `}`, `[`, `]`).
3.  **UTF-8:** Output must be valid UTF-8.
4.  **No Escaping:** Non-essential escaping (e.g., escaping forward slashes `/`) should be avoided to match `JSON.stringify` default behavior.
5.  **Numeric Stability:** Integers should be serialized without decimal points. Floating point numbers should use standard notation.
6.  **Metadata Stripping:** The `metadata` field in the IR is non-deterministic (contains timestamps) and MUST be stripped before computing the parity hash.

## Fixture Corpus

The fixture corpus is stored in `test/fixtures/ir-parity` and consists of `SDL -> IR -> Hash` triplets.

### Stable Parity Hashes (Metadata Stripped)

| Fixture | Hash (SHA-256) |
| :--- | :--- |
| `small-schema.graphql` | `36b451e20c50699f4f924077449221c62f86373b380e6cf224a0492a49829295` |
| `medium-schema.graphql` | `50700ecbd4a9dc4c0725fb0fd26f3df54859715cb543c889cf6c2650be418c28` |
| `large-schema.graphql` | `cd6b771e3a22dafbc05fe3bd7c15c214cc05adef660d494142ef3d6142831285` |

### Categories

1.  **Small:** Basic table with scalar fields and `@wes_pk`. (**COMPLETE**)
2.  **Medium:** Multiple tables, `@wes_fk` relationships, and `@wes_index`. (**COMPLETE**)
3.  **Large:** 100+ types to test performance and memory scaling. (**COMPLETE**)
4.  **Directive-Heavy:** Extensive use of `@wes_rls`, `@wes_tenant`, and `@wes_default`. (PENDING)
5.  **Invalid:** SDL cases that MUST trigger specific `WesleyParseError` codes. (PENDING)
6.  **Schema-Extensions:** Testing `foldExtensions` logic (type extensions). (PENDING)
7.  **Legacy-Aliases:** Using `@table`, `@pk`, etc., to ensure alias normalization works. (PENDING)

## Baseline Performance (JS)

*Captured on: May 5, 2026*
*Environment: Darwin (macOS)*

NOTE: These are rough measurements to be formalized in `EVIDENCE_rust-core-performance-baseline.md`.

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

### Verify Rust Parity
```bash
cd crates/wesley-core && cargo test
```
