# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

#### E0 — Plugin Pipeline Stabilization
- **E0.1:** `GeneratorPlugin` contract with `apiVersion`, error isolation (WPLY001–004), `--best-effort` mode, per-plugin status summary, `PluginRunner` orchestrator with frozen context
- **E0.1:** `ArtifactWriter` with overwrite detection, conflict reporting, atomic writes via temp staging, dry-run support
- **E0.2:** Plugin discovery and registration via `wesley.config.mjs` `generators` array (`package`, `config`, `enabled` fields)
- **E0.2:** `ConfigValidator` with `experimental` flag support (`irV2`, `rawLe`, `join`) and unknown-flag warnings
- **E0.3:** `testGenerator(plugin, sdl, config?)` test harness with `testGeneratorPlan()` and `expectArtifact()` assertion helpers
- **E0.4:** Generator plugin authoring guide (`docs/guides/generator-plugins.md`)
- **E0.5:** `wesley doctor` CLI command — checks Node version, config, plugins, crypto, experimental flags; `--format json`

#### E1 — Boundary Grammar & Schema Hash Pinning
- **E1.1:** `canonicalize(sdl)` — deterministic AST serialization with lexicographic sorting, `extend type` folding, NFC normalization
- **E1.2:** `schemaHash(sdl)` — SHA-256 of canonical AST bytes, 64-char lowercase hex
- **E1.3:** `registryHash(obj)` and `canonicalizeJSON(obj)` — deterministic registry blob hashing
- **E1.4:** `computeHashChain()` — full provenance: `sdl_hash → schema_hash → ir_hash → registry_hash → bundle_hash`
- **E1.5:** `echo-ir/v2` format — `schema_hash`, `registry_hash`, `hash_chain`, per-type `type_id`/`layout_hash`, per-field `join`
- **E1.6:** `computeDelta(oldSDL, newSDL)` — machine-readable schema diff with breaking change detection
- **E1.7:** `wesley diff` CLI — `--format text|json|summary`, `--breaking-only`, `--exit-code`

#### E2a — Canonical Encodings
- **E2a.1:** `emitRawLeCodec` — generates `raw_le_codec.generated.rs` with per-type `encode_raw_le`/`decode_raw_le`, `DecodeError` enum, alphabetical field order, LE numerics, NaN canonicalization (`0x7FC00000`), `Option<T>` prefix tags, length-prefixed strings
- **E2a.2:** `emitRawLeTsCodec` — generates `raw_le_codec.generated.ts` with browser-safe `DataView`/`Uint8Array` encode/decode, byte-identical to Rust, TypeScript interfaces for all types
- **E2a.3:** `computeLayoutHash(type, typeIndex)` — stable per-type layout descriptor → SHA-256, integrated into `echo-ir/v2` as `layout_hash` per type

#### E2b — Core Type Schemas
- **E2b.1:** Echo core storage types in Wesley SDL (`schemas/echo-core-types.graphql`): `WorldlineTickPatchV1`, `SnapshotManifest`, `ClaimRecord`, `PrivateAtomRefV1`, `OpaqueRefV1`, `FieldPatch`

#### E2c — Guarded Views
- **E2c.1:** `emitGuardedViews` — generates `guarded_views.generated.rs` with per-rule `ReadView`/`WriteView` structs from `@wes_view` directive, `from_full` and `apply_write` methods

#### E2d — Cross-Platform Determinism
- **E2d.1:** Golden vector test suite — 44 checked-in JSON vectors across 12 fixture files (Boolean, Int, Float, String, ID, List, Option, Enum, nested objects, multi-field, optional list, privacy types) with reference encoder harness

#### E3 — @wes_join Directive
- **E3.1:** `@wes_join(strategy: "union"|"max"|"lww")` directive parsing and validation
- **E3.2:** Rust `JoinFn` trait codegen — `emitJoinImpls()` generates `impl JoinFn` with per-field lattice calls, `has_join` per-type IR metadata
- **E3.3:** Join directive documentation (`docs/guides/wes-join-directive.md`)

#### E4 — Privacy Types
- **E4.1:** Privacy type canonical encoding verification — 28 tests for `ClaimRecord`, `PrivateAtomRefV1`, `OpaqueRefV1` round-trip encoding, Rust codegen field order, optional field handling

#### Previous (pre-Echo roadmap)
- Generators: `@wesley/generator-vue` minimal TS type emission (enums + interfaces)
- Generators: hardened `@wesley/generator-echo` with explicit SDL validation and package README
- Generators: ops helpers tests (`ops.generated.ts`) for ops-catalog wiring
- Core (QIR): `lowerToSQL` for SELECT/JOIN/LATERAL/ORDER BY/LIMIT/OFFSET
- Core (QIR): `emitView` and `emitFunction` (RETURNS SETOF jsonb)
- Tests: unit + snapshot tests for lowering and emission
- Docs: `docs/guides/qir-ops.md`; PR template and CODEOWNERS
- CI: Ubuntu-only CLI matrix; stabilized architecture-boundaries workflow

### Fixed
- **E2a.2:** TS codec NaN canonicalization used big-endian instead of little-endian — now matches Rust `to_le_bytes`
- **E2a.2:** TS codec nested object decode closure did not advance offset — caused corrupt state in lists/options
- **E0.1:** `ArtifactWriter` path traversal vulnerability — artifact keys with `..` or absolute paths are now rejected
- **E2d.1:** Golden vector reference encoder used `localeCompare` (non-deterministic across platforms) — now uses byte-order comparison
- **E1.7:** `wesley diff --breaking-only --format json` now emits only filtered `{ changes }` (no unfiltered delta arrays)
- **E2a.2:** Replace all `localeCompare` with byte-order comparison across codegen (emitRawLeCodec, emitRawLeTsCodec, emitGuardedViews, index.mjs)
- **E2a.2:** TS codec nested encode now uses in-place `_encode` helpers — eliminates intermediate `Uint8Array` allocation per nested object
- **E2d.1:** Golden vector `resolveNanSentinels` now recurses into arrays and array fields
- **E2d.1:** Golden vector `unwrapType` now throws on missing node name instead of returning `'Unknown'`
- **E2d.1:** Golden vector test runner now guards against missing `typeName` in fixture files

### Changed
- `generator-echo` now emits `echo-ir/v2` (was `echo-ir/v1`)
- `schema_sha256` in IR uses canonical AST hash (was raw SDL hash)

## [0.1.0] - 2025-09-01
- Initial public repository layout
