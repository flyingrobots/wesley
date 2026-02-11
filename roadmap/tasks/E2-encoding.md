# E2 — SPEC-0008 Generator Plugins: Task Specs

> The heart of deterministic storage. Wesley must generate canonical byte encoders so that `BLAKE3(encode(value))` produces identical hashes on every platform.

---

## E2a.1 — `raw_le` Encoding Plugin (Rust Target)

**User Story**

As the Echo CAS store, I need Wesley to generate Rust `encode()`/`decode()` functions for each schema type using a deterministic `raw_le` byte layout, so that `BLAKE3(encode(value))` is identical on every platform.

**Requirements**

Per SPEC-0008:

- Field-by-field encoding in deterministic field order (alphabetical by field name, matching canonical AST order)
- Explicit little-endian byte order for all numeric types
- Collision-free `Option<T>` encoding:
  - `None` → `0x00` prefix byte
  - `Some(value)` → `0x01` prefix byte + encoded value
  - No sentinel values (e.g., `0` does not mean `None`)
- Type mappings:
  - `Boolean` → 1 byte (`0x00` = false, `0x01` = true)
  - `Int` → 4 bytes (i32, little-endian)
  - `Float` → 4 bytes (f32, little-endian, IEEE 754)
  - `String` → 4-byte length prefix (u32 LE) + UTF-8 bytes
  - `ID` → same as String
  - `[T]` (lists) → 4-byte count (u32 LE) + concatenated element encodings
  - Enums → 4 bytes (u32 LE, variant index in alphabetical order)
  - Nested objects → concatenated field encodings (recursive)
- **NaN canonicalization (normative):** All `Float` NaN values MUST be normalized to the **canonical quiet NaN** bit pattern before encoding:
  - f32: `0x7FC00000` (quiet NaN, positive, zero payload)
  - Both signaling NaNs and quiet NaNs with non-zero payloads MUST be normalized to this canonical form
  - Encoders MUST NOT reject NaN — they MUST canonicalize. This avoids cross-runtime drift from differing NaN propagation rules
  - Decoders MUST accept canonical NaN and reproduce it faithfully
  - Golden vectors MUST include NaN test cases with the exact canonical bit pattern
- **String payload encoding (normative):** Runtime value encoding MUST NOT normalize string payloads. Strings are encoded as exact provided UTF-8 bytes with no NFC/NFD normalization, no trimming, and no whitespace collapsing. Schema identity normalization (E1.1 canonical AST) and payload encoding are separate concerns
- No reliance on `transmute`, `repr(C)`, `repr(Rust)`, or host memory layout
- Generated code must compile with `#[forbid(unsafe_code)]`
- Generated code must be `no_std`-compatible (no allocator for fixed-size types)

**Acceptance Criteria**

- [ ] Wesley generates a `encode_raw_le(&self) -> Vec<u8>` and `decode_raw_le(bytes: &[u8]) -> Result<Self, DecodeError>` for each schema object type
- [ ] Encoding is deterministic: `encode(value) == encode(clone(value))` always
- [ ] `encode(Some(0u32))` and `encode(None::<u32>)` produce different bytes
- [ ] Generated Rust code compiles with `#[forbid(unsafe_code)]`
- [ ] Generated code passes `cargo clippy` with no warnings
- [ ] `decode(encode(value)) == value` for all valid inputs (round-trip)
- [ ] All NaN variants encode to canonical `0x7FC00000` — no NaN rejection
- [ ] String payloads are encoded as raw UTF-8 bytes with no normalization

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| `raw_le` encoding for all Wesley-supported types | CBOR encoding (existing, separate) |
| Rust code generation | C/C++ code generation |
| `#[forbid(unsafe_code)]` | SIMD-optimized encoding |
| Round-trip encode/decode | Streaming/incremental encoding |
| Deterministic field ordering | Schema evolution (old encoder reading new format) |

**Expected Complexity**

~600–900 LoC (encoder generator + decoder generator + type mapping + tests)

**Est. Human Working Hours:** 16–24h

**Test Plan**

- **Golden path:** Define a schema with `type Foo { a: Int, b: String, c: Boolean }`, generate encoders, instantiate `Foo { a: 42, b: "hello", c: true }`, encode, assert bytes match expected hex. Decode the bytes, assert round-trip equality.
- **Failure modes:** Decode truncated bytes → `DecodeError`. Decode bytes with invalid enum variant → `DecodeError`. Decode bytes with string length exceeding remaining buffer → `DecodeError`.
- **Edges:** Empty string field. List with zero elements. Nested optional (`Option<Option<Int>>`). Maximum i32 value. Negative i32. NaN f32 (must be canonicalized to `0x7FC00000`, never rejected). Enum with single variant. Object with single field. Object with 100 fields (large struct).
- **Fuzz/stress:** Property-based testing with `proptest` or `quickcheck`: for 10,000 random `Foo` instances, assert `decode(encode(x)) == x`. Fuzz the decoder with random byte sequences (via `cargo fuzz` or `arbitrary`), assert no panics (only `DecodeError`).

**Definition of Done**

- [ ] Encoder/decoder generated for all object types in a test schema
- [ ] Round-trip property test passes (10,000 iterations)
- [ ] Decoder fuzz test runs for 60 seconds with no panics
- [ ] Golden byte vectors checked in (at least 10 test cases)
- [ ] Generated code compiles with `#[forbid(unsafe_code)]` and `clippy`
- [ ] No regressions in existing generator tests
- [ ] Performance: encoder generation for 100-type schema completes in <2s; runtime `encode_raw_le()` for a single 50-field struct completes in <1µs (Rust)

**Blocking:** E2a.3, E2d.1
**Blocked by:** E0.1, E1.1, E1.5

---

## E2a.2 — `raw_le` Encoding Plugin (TypeScript/WASM Target)

**User Story**

As the Echo browser demo, I need TypeScript encoder/decoder functions that produce byte-identical output to the Rust `raw_le` encoders, so that browser clients and Rust nodes can exchange content-addressed data.

**Requirements**

- Same encoding rules as E2a.1 (identical byte layout, field ordering, Option encoding, endianness)
- Generated TypeScript code uses `DataView` / `Uint8Array` for byte manipulation (no Node.js `Buffer`)
- Functions:
  - `encodeFoo(value: Foo): Uint8Array`
  - `decodeFoo(bytes: Uint8Array): Foo`
- Generated code must run in browsers (no Node.js APIs) and in Deno/Bun
- Float handling: must produce identical IEEE 754 bytes as Rust (JavaScript `Float32Array` uses the same format). NaN MUST be canonicalized to `0x7FC00000` (matching Rust policy from E2a.1) — use `DataView.setFloat32` after bit-testing for NaN and replacing with the canonical pattern
- String payload encoding: same as E2a.1 — encode exact UTF-8 bytes, no normalization

**Acceptance Criteria**

- [ ] Generated TypeScript encoders produce byte-identical output to Rust encoders for the same input values
- [ ] Golden vector tests pass in both Rust and TypeScript (same hex bytes)
- [ ] Generated code runs in a browser (no `Buffer`, no `fs`)
- [ ] Round-trip: `decodeFoo(encodeFoo(value))` deep-equals `value`
- [ ] NaN handling is explicit (canonicalized to a single NaN representation or rejected)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| TypeScript encoder/decoder generation | AssemblyScript or pure WASM target |
| Browser-compatible (DataView/Uint8Array) | Node.js Buffer optimization |
| Cross-platform golden vectors | Performance optimization (SIMD, workers) |
| NaN canonicalization | Streaming encoding |

**Expected Complexity**

~500–700 LoC (encoder generator + decoder generator + type mapping)

**Est. Human Working Hours:** 12–18h

**Test Plan**

- **Golden path:** Same golden vectors as E2a.1; run in TypeScript (Vitest), assert identical hex output.
- **Failure modes:** Decode truncated `Uint8Array` → throws typed error. Invalid enum index → throws.
- **Edges:** Same edges as E2a.1 (empty strings, zero-length lists, nested optionals, max/min ints, NaN). Additionally: very large `Uint8Array` (>1MB) — no OOM.
- **Fuzz/stress:** Generate 1,000 random values in TypeScript, encode, decode, assert round-trip. Cross-validate: generate values in Rust, encode, send hex to TypeScript test, decode, assert equality.

**Definition of Done**

- [ ] TypeScript encoder/decoder generated for all object types
- [ ] All Rust golden vectors pass in TypeScript
- [ ] Round-trip property test passes (1,000 iterations)
- [ ] Generated code has zero TypeScript errors (`tsc --strict`)
- [ ] Runs in browser (tested via Vitest browser mode or Playwright)

**Blocking:** E2d.1
**Blocked by:** E2a.1 (Rust target defines the canonical encoding; TS must match)

---

## E2a.3 — `layout_hash` Computation

**User Story**

As the Echo CAS decoder, I need a `layout_hash` that uniquely identifies the exact byte layout of a type's encoding, so I can refuse to decode a blob if the encoder version doesn't match.

**Requirements**

- `layout_hash = SHA-256(layout_descriptor_bytes)` where the layout descriptor captures:
  - Field names and order
  - Field types and their encoding rules
  - Option encoding strategy
  - Endianness
  - Enum variant ordering
- The layout descriptor is a canonical byte sequence derived from the encoder configuration (not the encoded data itself)
- `layout_hash` changes when:
  - A field is added, removed, or reordered
  - A field type changes
  - The encoding strategy changes (e.g., from `raw_le` to a hypothetical `raw_be`)
- `layout_hash` does NOT change when:
  - Field values change (it describes structure, not content)
  - Comments or whitespace in the schema change (canonicalization handles this)
- Must appear in `echo-ir/v2` per-type output and be usable by Echo's `TypedRef` decode gating

**Acceptance Criteria**

- [ ] `layout_hash` is computed for each type that has a `raw_le` encoder
- [ ] Appears in `echo-ir/v2` output as a per-type field
- [ ] Adding a field to a type changes its `layout_hash`
- [ ] Changing encoding strategy changes `layout_hash`
- [ ] Same schema + same encoder version → same `layout_hash` across platforms

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Hash of layout descriptor | Hash of encoded values (that's `value_hash`, Echo-side) |
| Per-type hash in IR output | Layout versioning/migration |
| SHA-256 | BLAKE3 (deferred) |

**Expected Complexity**

~150–200 LoC (layout descriptor builder + hash + IR integration)

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Compute `layout_hash` for `type Foo { a: Int, b: String }`, assert matches expected hex. Add field `c: Boolean`, assert hash changes.
- **Failure modes:** Type with no fields → valid (empty layout hash). Type with unsupported field type → error during layout construction.
- **Edges:** Two types with same fields but different names → different `layout_hash` (type name is part of the descriptor). Type with only optional fields. Type with nested object fields (recursive layout).
- **Fuzz/stress:** Compute `layout_hash` for 200 random types, assert all are valid 64-char hex, assert deterministic (compute twice, compare).

**Definition of Done**

- [ ] `layout_hash` appears in `echo-ir/v2` for all encoded types
- [ ] Golden layout hash vectors checked in (at least 5 types)
- [ ] Determinism test passes
- [ ] Documented in `echo-ir/v2` spec

**Blocking:** nothing directly
**Blocked by:** E2a.1, E1.5

---

## E2b.1 — Core Storage Type Schemas

**User Story**

As the Echo storage layer, I need Wesley schema definitions for Echo's core storage types (`WorldlineTickPatch`, `SnapshotManifest`, `ClaimRecord`, `PrivateAtomRefV1`, `OpaqueRefV1`) so their canonical encoders are generated by Wesley rather than hand-written in Rust.

**Requirements**

- Create `schemas/echo-core-types.graphql` (or split into multiple files) defining:
  - `WorldlineTickPatchV1`: tick ID, entity patches, timestamp, payload bytes
  - `SnapshotManifest`: segment count, segment hashes (as `[String]` hex), total byte count, schema_hash reference
  - `ClaimRecord`: claim_key, scheme_id, statement_hash, commitment, proof_bytes/proof_hash, private_ref, policy_hash, issuer
  - `PrivateAtomRefV1`: commit, policy_hash, statement_hash, zk_evidence, opaque_ref
  - `OpaqueRefV1`: vault_id, locator, commit, alg_id, policy_hash
- Each type must have `@wes_table` or equivalent directive so Wesley recognizes it as an encodable type
- Field types must map cleanly to both Rust and TypeScript targets
- These schemas become the single source of truth for these types — the hand-written Rust structs in Echo are replaced by generated code

**Acceptance Criteria**

- [ ] All 5 core types are defined in Wesley SDL
- [ ] `generator-echo` produces `echo-ir/v2` JSON that includes these types
- [ ] `raw_le` encoders can be generated for all 5 types (after E2a.1)
- [ ] The generated Rust structs are compatible with Echo's existing `BlobStore` usage
- [ ] Schema is reviewed and approved by the Echo maintainer (coordinated PR)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| SDL definitions for 5 core types | All Echo internal types (only CAS-facing types) |
| Field types and directives | Default values or migrations |
| Compatibility with existing Rust structs | Replacing existing Rust structs (Echo-side work) |

**Expected Complexity**

~100–200 LoC of GraphQL SDL + ~50 LoC test assertions

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Compile the schema with `generator-echo`, assert all 5 types appear in IR output with correct fields and types.
- **Failure modes:** Type with field type not supported by `raw_le` → error at generation time (caught before release).
- **Edges:** `ClaimRecord` has many optional fields (all must encode correctly). `SnapshotManifest` has a list of hashes (variable-length).
- **Fuzz/stress:** N/A (schema definition, not runtime code).

**Definition of Done**

- [ ] Schema files checked in under `schemas/`
- [ ] All 5 types compile without errors
- [ ] IR output includes all types with correct field definitions
- [ ] Review sign-off from Echo maintainer

**Blocking:** E4.1 (privacy types reuse these schemas)
**Blocked by:** E0.1, E1.5

---

## E2c.1 — GuardedView Generator

**User Story**

As an Echo rule author, I need Wesley to generate type-safe "view" structs that only expose the fields my rule declared access to, so that footprint violations are caught at compile time rather than runtime.

**Requirements**

- New directive: `@wes_view(rule: "movement_rule", access: READ)` on fields
- For each rule referenced in `@wes_view` directives, generate:
  - A `{RuleName}ReadView` struct with only the `READ`-annotated fields
  - A `{RuleName}WriteView` struct with only the `WRITE`-annotated fields
  - Conversion methods: `from_full(full: &FullType) -> ReadView` and `apply_write(view: WriteView, target: &mut FullType)`
- Views are generated artifacts (plain Rust structs), not trait objects or runtime wrappers
- If a rule accesses a field not declared in `@wes_view`, it's a compile error (the field doesn't exist on the view struct)

**Acceptance Criteria**

- [ ] `@wes_view` directive is parsed and validated by Wesley
- [ ] View structs are generated in the Rust output
- [ ] Attempting to access a non-declared field on a view struct is a Rust compile error
- [ ] View structs implement `encode_raw_le` / `decode_raw_le` (if E2a.1 is complete)
- [ ] Views compose: if rule A reads fields {x, y} and rule B reads {y, z}, each gets its own view with only its fields

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| `@wes_view` directive and codegen | Runtime footprint enforcement (Echo already has this) |
| Read and Write view structs | Combined read-write views |
| Rust target | TypeScript views (future) |
| Compile-time field restriction | Dynamic field filtering |

**Expected Complexity**

~400–600 LoC (directive parsing + view struct generation + conversion methods)

**Est. Human Working Hours:** 10–16h

**Test Plan**

- **Golden path:** Schema with `type State { x: Int @wes_view(rule: "move", access: READ), y: Int @wes_view(rule: "move", access: WRITE), z: String }`. Generate views. Assert `MoveReadView` has only `x`. Assert `MoveWriteView` has only `y`. Assert `z` is on neither.
- **Failure modes:** `@wes_view` on a type (not a field) → validation error. `@wes_view` with unknown access level → validation error.
- **Edges:** Field with both READ and WRITE access → appears on both views. Field with multiple rules → appears on each rule's view independently. Type with no `@wes_view` fields → no views generated (no error).
- **Fuzz/stress:** Generate views for a schema with 50 types and 10 rules, assert all views compile and have correct field counts.

**Definition of Done**

- [ ] `@wes_view` directive parsed and validated
- [ ] View structs generated for Rust target
- [ ] Compile-time test: accessing undeclared field fails to compile
- [ ] At least 10 test cases covering combinations of READ/WRITE/multi-rule
- [ ] Documented in generator-echo README

**Blocking:** nothing
**Blocked by:** E0.1, E2a.1 (views should support `raw_le` encoding)

---

## E2d.1 — Golden Vector Test Suite

**User Story**

As the Echo determinism guarantee, I need a checked-in set of golden test vectors that prove Rust and TypeScript encoders produce identical bytes for the same input values, so that cross-platform determinism is continuously verified in CI.

**Requirements**

- Golden vectors are `.json` files checked into the Wesley repo under `test/golden-vectors/`
- Each file contains:
  ```json
  {
    "schema": "type Foo { a: Int, b: String }",
    "type": "Foo",
    "vectors": [
      {
        "label": "basic values",
        "value": { "a": 42, "b": "hello" },
        "raw_le_hex": "2a00000005000000 68656c6c6f",
        "_comment": "a=42 as i32 LE, b length=5 as u32 LE, then 'hello' UTF-8 bytes"
      },
      {
        "label": "zero and empty string",
        "value": { "a": 0, "b": "" },
        "raw_le_hex": "0000000000000000",
        "_comment": "a=0 as i32 LE, b length=0 as u32 LE"
      }
    ]
  }
  ```
- CI runs two independent test suites:
  1. **Rust test:** reads the JSON, encodes each value, asserts hex matches
  2. **TypeScript test:** reads the same JSON, encodes each value, asserts hex matches
- If either test fails, CI blocks the PR
- Vectors must cover:
  - All scalar types (Boolean, Int, Float, String, ID)
  - All container types (List, Optional, nested Optional)
  - All enum types
  - Nested objects
  - Edge cases (empty strings, zero-length lists, max/min values, NaN)
- Echo's existing `docs/golden-vectors.md` CBOR vectors serve as inspiration but are a different encoding; `raw_le` vectors are new

**Acceptance Criteria**

- [ ] At least 30 golden vectors across at least 5 schema types
- [ ] Rust test suite reads vectors and asserts byte equality
- [ ] TypeScript test suite reads the same vectors and asserts byte equality
- [ ] CI runs both suites on every PR
- [ ] Adding a new vector is as simple as adding a JSON entry (no code changes needed)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| `raw_le` golden vectors | CBOR golden vectors (existing, separate) |
| Rust + TypeScript test harnesses | C/C++/Python test harnesses |
| CI integration | Visual diff tooling for failures |
| Checked-in JSON fixtures | Generating vectors from a DSL |

**Expected Complexity**

~300–400 LoC (test harnesses in Rust + TypeScript) + ~200 lines of JSON fixtures

**Est. Human Working Hours:** 8–12h

**Test Plan**

- **Golden path:** CI runs both harnesses, all vectors pass.
- **Failure modes:** Intentionally change one Rust encoder byte → Rust test fails, TypeScript still passes → CI catches the divergence.
- **Edges:** Vector with NaN float (must canonicalize). Vector with maximum-length string. Vector with deeply nested object (3+ levels).
- **Fuzz/stress:** Generate 500 random values for each schema type, encode in both Rust and TypeScript, assert hex-equality across all 500 (this is a CI-optional extended test, not part of the fast suite).

**Definition of Done**

- [ ] `test/golden-vectors/` directory with at least 5 vector files
- [ ] Vectors also checked into `test/conformance/raw-le-encoding/` as the canonical encoding conformance suite
- [ ] Rust test harness reads and validates vectors
- [ ] TypeScript test harness reads and validates same vectors
- [ ] CI workflow runs both on every PR
- [ ] At least 30 vectors covering all type categories

**Blocking:** nothing
**Blocked by:** E2a.1, E2a.2
