# E1 — Boundary Grammar & Schema Hash Pinning: Task Specs

> Wesley becomes an importable grammar with a canonical AST. Schema hashes get pinned in Echo's receipts/events so old logs can never be silently reinterpreted under new semantics.

---

## E1.1 — Canonical AST Representation

**User Story**

As the Echo determinism engine, I need Wesley to produce a canonical (deterministic, stable) serialization of parsed GraphQL SDL so that two compilations of the same schema always produce byte-identical AST output, enabling content-addressable hashing.

**Requirements**

> Key words: MUST, MUST NOT, SHOULD, SHOULD NOT per [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119). This section is **normative** — it is the trust root for all downstream hashing.

- Define a canonical AST format that is:
  - **Deterministic:** field order, whitespace, and comment stripping produce identical output for semantically identical schemas
  - **Serializable:** can be serialized to bytes (JSON or a binary format) for hashing
  - **Stable:** adding a new Wesley feature MUST NOT change the canonical form of existing schemas (additive-only evolution)

**Canonicalization Rules (Normative)**

1. **Stripping:** Implementations MUST strip all comments, formatting whitespace, and source location metadata from the canonical form.
2. **Type ordering:** Top-level type definitions MUST be sorted lexicographically by name (Unicode code-point order, case-sensitive).
3. **Field ordering:** Fields within each type MUST be sorted lexicographically by field name.
4. **Directive ordering:** Directives on a node MUST be sorted lexicographically by directive name. When the same directive appears multiple times (if schema allows), instances MUST be sorted by their serialized argument string.
5. **Argument ordering:** Arguments within a directive application MUST be sorted lexicographically by argument name.
6. **`extend type` folding:** All `extend type` definitions MUST be merged into their base type definition before canonicalization. The merge MUST be performed before field sorting. If the base type does not exist, the implementation MUST emit a parse error.
7. **String normalization:** All string values (type names, field names, directive string arguments, description strings) MUST be trimmed of leading/trailing whitespace and normalized to Unicode NFC form. This applies to **schema identity** only (see MUST-4 note on runtime encoding below).
8. **Absent optional fields:** Optional fields that are absent from the SDL MUST NOT appear in the canonical form. A field explicitly set to its default value MUST appear (it is semantically present).
9. **Enum value ordering:** Enum values MUST be sorted lexicographically by name.
10. **Interface `implements` ordering:** The `implements` list on a type MUST be sorted lexicographically by interface name.
11. **Union member ordering:** Union member types MUST be sorted lexicographically by type name.

> **MUST-4 boundary note:** NFC normalization applies to canonical AST only (schema identity). Runtime value encoding (E2a) MUST NOT normalize string payloads — it encodes exact provided UTF-8 bytes. Schema identity normalization and payload semantics are separate concerns.

- The canonical form is an internal representation; it does not need to be valid SDL (it's a hash input, not a human artifact)

**Acceptance Criteria**

- [ ] `canonicalize(sdl: string): Uint8Array` is exported from `@wesley/core`
- [ ] Two SDL strings that differ only in whitespace/comments/field order produce identical canonical bytes
- [ ] Two SDL strings with different type names produce different canonical bytes
- [ ] Adding a field to a type changes the canonical bytes
- [ ] The canonical form is documented (format spec for future reimplementation in Rust if needed)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Canonical serialization of parsed AST | Canonical serialization of generated output |
| Comment/whitespace stripping | Preserving comments for documentation generators |
| Deterministic ordering | Minification of SDL for human consumption |
| NFC Unicode normalization | Supporting non-GraphQL schema languages |

**Expected Complexity**

~300–500 LoC (AST walker + sorter + serializer + normalization)

**Est. Human Working Hours:** 8–12h

**Test Plan**

- **Golden path:** Parse `type Query { b: String, a: Int }`, canonicalize, assert bytes match expected. Parse same schema with fields reversed and extra whitespace, assert identical bytes.
- **Failure modes:** Invalid SDL → parse error before canonicalization (no partial output). SDL with syntax Wesley doesn't support → clear error.
- **Edges:** Empty schema (no types). Schema with only directives. Schema with circular references (interface implements interface). Schema with Unicode type names. Schema with duplicate type names (should error at parse time). Schema with `extend type`.
- **Fuzz/stress:** Generate 500 random valid GraphQL schemas (using `graphql-js` schema builder), canonicalize each twice, assert byte-equality on every pair. Measure canonicalization time for a 10,000-type schema (target: <1s).

**Definition of Done**

- [ ] `canonicalize()` exported from `@wesley/core`
- [ ] Canonical format documented in `docs/specs/canonical-ast.md` using RFC-2119 normative language
- [ ] Property test: `canonicalize(sdl) === canonicalize(reformat(sdl))` for 100+ schemas
- [ ] Performance: <100ms for a 1,000-type schema on Node 18+
- [ ] Conformance fixtures checked into `test/conformance/canonical-ast/` (input SDL + expected canonical bytes, at least 10 fixtures covering ordering, folding, normalization, and edge cases)
- [ ] No regressions in existing tests

**Blocking:** E1.2, E1.4
**Blocked by:** E0.1

---

## E1.2 — Schema Hash Computation (`schema_hash`)

**User Story**

As the Echo receipt system, I need a stable `schema_hash` value that uniquely identifies a schema version so I can pin it in commit receipts and refuse to replay events against the wrong schema.

**Requirements**

- `schema_hash = SHA-256(canonical_ast_bytes)` where `canonical_ast_bytes` comes from E1.1
- Wesley currently uses SHA-256; BLAKE3 migration is deferred and will be a coordinated cross-repo change
- The hash is hex-encoded (lowercase, 64 chars) in all JSON/IR output
- `schema_hash` must appear in:
  - `echo-ir/v2` JSON output (top-level `schema_hash` field — already exists as `schema_sha256` in v1, but computed differently)
  - Generator metadata/manifest files
  - CLI output (`wesley compile --verbose`)
- Changing any type, field, directive, or operation in the SDL must change the `schema_hash`
- Reordering fields or adding whitespace must NOT change the `schema_hash` (because canonicalization handles this)

**Acceptance Criteria**

- [ ] `schemaHash(sdl: string): string` is exported from `@wesley/core` and returns a 64-char lowercase hex SHA-256
- [ ] The hash is included in `generator-echo` output as `schema_sha256` (v1 compat) and `schema_hash` (v2)
- [ ] Two semantically identical schemas produce the same hash
- [ ] Any semantic change (add/remove/rename type, field, arg, directive) produces a different hash
- [ ] The hash is reproducible across Node versions (18, 20, 22) and platforms (Linux, macOS)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| SHA-256 hash computation | BLAKE3 hash computation (deferred) |
| Hex encoding | Base64 or other encodings |
| Integration with generator-echo output | Integration with Echo's Rust receipt system (Echo-side work) |
| Cross-platform reproducibility | Browser-based hashing (covered by host-browser separately) |

**Expected Complexity**

~80–120 LoC (hash function + integration into generators + CLI flag)

**Est. Human Working Hours:** 3–5h

**Test Plan**

- **Golden path:** Hash a known schema, assert hex output matches a checked-in expected value. Modify the schema, assert hash changes.
- **Failure modes:** Empty SDL → error (can't hash nothing). Non-UTF8 input → error before hashing.
- **Edges:** Schema with only `scalar` definitions. Schema where the only difference is a directive argument value. Schema with `extend type` (must be folded into base type before hashing).
- **Fuzz/stress:** Hash 1,000 random schemas, assert all hashes are 64-char hex, assert no collisions (probabilistically guaranteed by SHA-256 but validates formatting).

**Definition of Done**

- [ ] `schemaHash()` exported and documented
- [ ] Golden hash vectors checked in (at least 5 schemas with known expected hashes)
- [ ] Hash conformance fixtures checked into `test/conformance/schema-hash/` (input SDL + expected 64-char hex hash)
- [ ] Hash appears in `generator-echo` output
- [ ] Performance: <150ms for a 1,000-type schema (includes canonicalization) on Node 18+
- [ ] Cross-platform CI passes (Linux + macOS at minimum)

**Blocking:** E1.3, E1.4
**Blocked by:** E1.1

---

## E1.3 — Registry Hash Computation (`registry_hash`)

**User Story**

As the Echo type registry, I need a `registry_hash` that uniquely identifies the full generated registry blob so that two nodes can verify they share identical type registries before exchanging data.

**Requirements**

- `registry_hash = SHA-256(registry_blob_bytes)` where `registry_blob_bytes` is the canonical serialization of the complete registry output
- The registry blob includes: all type definitions, all operation definitions, all enum definitions, field metadata, codec identifiers
- This is distinct from `schema_hash` — `schema_hash` identifies the input SDL, `registry_hash` identifies the generated output. Same schema with different generator versions could produce different registry hashes
- The hash is hex-encoded (lowercase, 64 chars)
- Must appear in `generator-echo` output as a top-level `registry_hash` field

**Acceptance Criteria**

- [ ] `registryHash(registryBlob: Uint8Array): string` is available within the generator pipeline
- [ ] The hash appears in `echo-ir/v2` output
- [ ] Changing a generator's output logic (e.g., field ordering) changes the `registry_hash` even if `schema_hash` stays the same
- [ ] The registry blob serialization is deterministic (no Map iteration order issues, no timestamps)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Hash of the generated registry blob | Hash of individual types within the registry |
| Integration with generator-echo | Registry blob storage in CAS (Echo-side) |
| Deterministic blob serialization | Registry versioning/migration |

**Expected Complexity**

~100–150 LoC (blob serializer + hash + integration)

**Est. Human Working Hours:** 3–5h

**Test Plan**

- **Golden path:** Generate registry for a known schema, hash it, assert match against checked-in expected value.
- **Failure modes:** Generator produces non-deterministic output → test catches it (hash differs between runs).
- **Edges:** Schema with zero ops (query-only schema). Schema with 500+ types (large registry).
- **Fuzz/stress:** Generate registry 100 times for the same schema, assert all 100 hashes are identical.

**Definition of Done**

- [ ] `registry_hash` appears in generator-echo output
- [ ] Determinism test: 10 consecutive generations produce identical hashes
- [ ] At least 3 golden hash vectors checked in
- [ ] Documented in IR spec

**Blocking:** E1.4
**Blocked by:** E0.1, E1.2

---

## E1.4 — Schema Hash Chain (SDL → IR → Bundle)

**User Story**

As an Echo auditor, I need to trace a chain of hashes from the original SDL through the IR to the final bundle, so I can verify that no step in the pipeline silently altered the schema semantics.

**Requirements**

- Every generator output bundle includes a `hash_chain` object:

  ```json
  {
    "hash_chain": {
      "sdl_hash": "<SHA-256 of raw SDL input bytes>",
      "schema_hash": "<SHA-256 of canonical AST bytes>",
      "ir_hash": "<SHA-256 of the IR JSON bytes>",
      "registry_hash": "<SHA-256 of registry blob>",
      "bundle_hash": "<SHA-256 of the complete output bundle>"
    }
  }
  ```

- `sdl_hash` is the raw input hash (before canonicalization) — useful for detecting whitespace-only changes
- Each hash in the chain is independently verifiable: given the artifact at that stage, recomputing its hash must match
- The chain is metadata only — it does not affect the generated code

**Hash Input Byte Specifications (normative)**

Each stage's hash input MUST be precisely defined. No undefined bytes. Ever.

| Stage | Hash input | Serialization rules |
| --- | --- | --- |
| `sdl_hash` | Raw SDL file bytes as read from disk | Exact bytes, including BOM if present. No normalization. UTF-8 encoding assumed but not validated at this stage. No trailing newline added or stripped. |
| `schema_hash` | Canonical AST bytes from E1.1 `canonicalize()` | Output of `canonicalize()` as-is. The canonical AST spec (E1.1) fully defines these bytes. |
| `ir_hash` | IR JSON output bytes | **Canonical JSON:** keys MUST be sorted lexicographically (recursive, all levels). No trailing newline. No BOM. UTF-8 encoding. No insignificant whitespace (compact serialization: no spaces after `:` or `,`, no newlines). Numbers MUST use shortest representation (no trailing zeros, no leading zeros except `0.x`). `null` literals, not absent keys, for absent optional values. |
| `registry_hash` | Registry blob bytes | Same canonical JSON rules as `ir_hash`. The registry blob is serialized with sorted keys, compact form, UTF-8, no trailing newline. |
| `bundle_hash` | Complete output bundle | `SHA-256(sorted_concat)` where `sorted_concat` = lexicographically sorted list of `(relative_path + "\0" + file_bytes)` for every file in the bundle, concatenated. Path separator MUST be `/` (forward slash). This makes the bundle hash independent of filesystem write order. |

**Acceptance Criteria**

- [ ] `hash_chain` appears in generator-echo output
- [ ] Each hash in the chain can be independently verified by re-hashing the corresponding artifact
- [ ] A whitespace-only SDL change alters `sdl_hash` but not `schema_hash`
- [ ] A semantic SDL change alters all hashes in the chain
- [ ] Hash input byte format for each stage is documented and tested (no undefined bytes)
- [ ] IR and registry hashes use canonical JSON (sorted keys, compact, no trailing newline)
- [ ] Bundle hash uses sorted path+content concatenation (filesystem-order-independent)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Hash chain in generator output | Merkle tree of individual types |
| Independent verifiability | Blockchain-style chaining across compilations |
| Metadata (does not affect codegen) | Signing the hash chain (see: deferred commit signing spec) |

**Expected Complexity**

~100–150 LoC (hash computation at each stage + chain assembly + output integration)

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Compile a known schema, extract `hash_chain`, verify each hash by re-hashing the corresponding artifact bytes.
- **Failure modes:** Pipeline skips a stage (e.g., no IR produced) → chain includes `null` for that stage with a warning.
- **Edges:** Schema with only enums (minimal IR). Schema that produces no ops (empty ops catalog).
- **Fuzz/stress:** N/A (deterministic hashing, covered by E1.2/E1.3 fuzz tests).

**Definition of Done**

- [ ] `hash_chain` present in generator output
- [ ] Verification script/test that re-hashes each stage and asserts match
- [ ] Documented in IR spec

**Blocking:** E1.5 (echo-ir/v2), E2a.3 (layout_hash builds on this chain)
**Blocked by:** E1.1, E1.2, E1.3

---

## E1.5 — echo-ir/v2 Format

**User Story**

As the `echo-wesley-gen` Rust crate, I need an updated IR format (`echo-ir/v2`) that carries hash fields, layout metadata, and join annotations natively, so I can generate richer Rust code without post-processing hacks.

**Requirements**

- Bump `ir_version` from `"echo-ir/v1"` to `"echo-ir/v2"`
- New top-level fields:
  - `schema_hash: string` (64-char hex)
  - `registry_hash: string` (64-char hex)
  - `hash_chain: object` (from E1.4)
- New per-type fields:
  - `type_id: string` — stable type identity (breaking changes → new ID)
  - `layout_hash: string | null` — codec layout hash (null if no encoder generated yet)
- New per-field fields:
  - `join: { strategy: string } | null` — from `@wes_join` directive (E3)
- Backward compatibility: `echo-wesley-gen` should accept both `echo-ir/v1` (current) and `echo-ir/v2`, with v1 fields mapped to v2 defaults (null hashes, no joins)
- The v2 format is documented in a `docs/specs/echo-ir-v2.md` spec file

**Acceptance Criteria**

- [ ] `generator-echo` emits `ir_version: "echo-ir/v2"` with all new fields populated
- [ ] `echo-wesley-gen` (Echo repo, Rust) can parse v2 without crashing (requires coordinated Echo-side update)
- [ ] v1 IR files are still parseable by `echo-wesley-gen` (backward compat)
- [ ] New fields that are not yet populated (e.g., `layout_hash` before E2a lands) are `null`, not missing

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| v2 format definition | v1 deprecation (v1 remains supported) |
| New hash/join fields | New encoding-related fields (deferred to E2) |
| Backward compatibility in consumers | Automatic migration tooling (v1 → v2 converter) |
| Spec document | JSON Schema / Zod schema for validation (nice-to-have, not required) |

**Expected Complexity**

~200–300 LoC (format changes in generator-echo + spec document ~200 lines of Markdown)

**Est. Human Working Hours:** 5–8h

**Test Plan**

- **Golden path:** Compile a schema, assert output has `ir_version: "echo-ir/v2"` and all new fields present. Feed v2 JSON to `echo-wesley-gen` (Rust), assert it parses and generates valid Rust code.
- **Failure modes:** v2 IR with missing required field → `echo-wesley-gen` rejects with descriptive error. v2 IR with unknown fields → ignored (forward compat).
- **Edges:** v1 IR fed to a v2-aware consumer → works with null defaults. Schema with no types (only scalars) → all hash fields present but registry is minimal.
- **Fuzz/stress:** Generate v2 IR for 50 schemas from the test suite, parse each with `echo-wesley-gen`, assert zero failures.

**Definition of Done**

- [ ] `echo-ir/v2` spec document written and checked in
- [ ] `generator-echo` emits v2 by default
- [ ] `echo-wesley-gen` accepts v1 and v2 (requires coordinated Echo PR)
- [ ] Golden IR fixtures checked in (at least 3 schemas with expected v2 output)
- [ ] No regressions in existing tests

**Blocking:** E2a.1 (encoders need type_id/layout_hash fields), E3.2 (join codegen needs join field)
**Blocked by:** E1.2, E1.3, E1.4

---

## E1.6 — SchemaDelta Vocabulary

**User Story**

As an Echo operator, I need a machine-readable vocabulary for describing what changed between two schema versions, so I can assess migration risk and generate upgrade plans.

**Requirements**

- Define a `SchemaDelta` type that describes changes between two canonical ASTs:
  - `added_types: TypeDelta[]`
  - `removed_types: TypeDelta[]`
  - `modified_types: TypeModification[]` (fields added/removed/changed, directives changed)
  - `added_ops: OpDelta[]`
  - `removed_ops: OpDelta[]`
  - `modified_ops: OpModification[]` (args added/removed/changed, return type changed)
- Each delta entry includes:
  - `name` — type or op name
  - `breaking: boolean` — whether the change is backward-incompatible
  - `description: string` — human-readable summary
- A `computeDelta(oldSDL, newSDL): SchemaDelta` function exported from `@wesley/core`
- Breaking change detection rules:
  - Removing a type or field → breaking
  - Removing an op or arg → breaking
  - Changing a field type → breaking
  - Adding a required (non-nullable) field → breaking
  - Adding an optional field → non-breaking
  - Adding a new type or op → non-breaking

**Acceptance Criteria**

- [ ] `computeDelta()` returns a `SchemaDelta` for any two valid SDL strings
- [ ] Adding a field is detected as `modified_types` with `breaking: false` (if optional)
- [ ] Removing a type is detected as `removed_types` with `breaking: true`
- [ ] The delta is serializable to JSON for machine consumption
- [ ] The delta includes `description` strings suitable for changelogs

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Structural diff (types, fields, ops, args) | Semantic diff (directive behavior changes) |
| Breaking change classification | Migration script generation |
| JSON-serializable output | Database migration planning |
| Human-readable descriptions | Interactive diff UI |

**Expected Complexity**

~400–600 LoC (AST differ + breaking change classifier + delta types + descriptions)

**Est. Human Working Hours:** 8–12h

**Test Plan**

- **Golden path:** Diff a v1 schema against a v2 schema with one added field and one removed type. Assert `added` and `removed` entries are correct with correct `breaking` flags.
- **Failure modes:** Diffing invalid SDL → parse error. Diffing identical schemas → empty delta (not an error).
- **Edges:** Type renamed (shows as remove + add, not rename). Field type changed from `String` to `Int` (breaking). Enum value added (non-breaking) vs removed (breaking). Op argument made optional → non-breaking. Op argument made required → breaking.
- **Fuzz/stress:** Generate 200 random schema pairs (base + mutation), compute delta for each, assert all deltas are valid JSON and all `breaking` flags are correct for known mutation types.

**Definition of Done**

- [ ] `computeDelta()` exported from `@wesley/core`
- [ ] `SchemaDelta` type documented with examples
- [ ] Breaking change rules documented
- [ ] At least 15 test cases covering all delta categories
- [ ] JSON output is stable and documented
- [ ] Performance: <200ms for diffing two 500-type schemas on Node 18+

**Blocking:** E1.7
**Blocked by:** E1.1

---

## E1.7 — `wesley diff` CLI Command

**User Story**

As a developer, I can run `wesley diff old.graphql new.graphql` to see what changed between two schema versions in both human-readable and machine-readable formats, so I can review schema migrations before deploying.

**Requirements**

- New CLI subcommand: `wesley diff <old-schema> <new-schema>`
- Flags:
  - `--format text` (default): human-readable colored output with breaking changes highlighted
  - `--format json`: machine-readable `SchemaDelta` JSON (from E1.6)
  - `--format summary`: single-line CI-friendly output (e.g., `3 breaking, 2 safe, 1 type removed`)
  - `--breaking-only`: filter to show only breaking changes
  - `--exit-code`: exit with code 1 if any breaking changes detected (for CI gates)
- Human-readable output format:

  ```text
  BREAKING  Removed type: UserProfile
  BREAKING  Removed field: Query.getUser
  safe      Added field: Query.listUsers (optional)
  safe      Added type: UserListItem
  ```

- Machine-readable output: the `SchemaDelta` JSON from E1.6

**Acceptance Criteria**

- [ ] `wesley diff a.graphql b.graphql` produces readable output
- [ ] `--format json` produces valid `SchemaDelta` JSON
- [ ] `--format summary` produces a single-line CI-friendly summary
- [ ] `--breaking-only` filters non-breaking changes
- [ ] `--exit-code` returns 1 on breaking changes, 0 otherwise
- [ ] Command is documented in `wesley --help`

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| CLI subcommand | Diffing against a live database |
| Text and JSON output formats | Git integration (`wesley diff HEAD~1`) |
| Breaking change filter and exit code | Interactive approval workflow |
| `--help` documentation | Generating migration scripts |

**Expected Complexity**

~150–250 LoC (CLI wiring + text formatter + flag handling)

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Run `wesley diff` with two known schemas, assert text output matches expected. Run with `--format json`, parse output as JSON, assert valid `SchemaDelta`.
- **Failure modes:** Missing file → clear error. Invalid SDL in one file → parse error with filename.
- **Edges:** Both files identical → "No changes" message, exit code 0. One file empty → all types show as added/removed.
- **Fuzz/stress:** N/A (CLI wrapper over E1.6).

**Definition of Done**

- [ ] `wesley diff` subcommand works
- [ ] Text, JSON, and summary output formats implemented
- [ ] `--breaking-only` and `--exit-code` flags work
- [ ] CLI help text documented
- [ ] Integration test with real schema files passes
- [ ] Performance: <500ms end-to-end for two 500-type schemas on Node 18+

**Blocking:** nothing
**Blocked by:** E1.6
