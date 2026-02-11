<!-- SPDX-License-Identifier: LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->
# Echo Roadmap (Wesley-side work)

> What needs to happen **in this repo** to support [Echo](https://github.com/flyingrobots/echo).
>
> This is the Wesley-side companion to Echo's `docs/ROADMAP.md`. If you're working in Wesley and touching anything Echo-related, start here.

---

## Context

Echo is a deterministic simulation engine (Rust, compiles to WASM). Wesley is its schema compiler — it turns GraphQL SDL into JSON IR, Rust types, TypeScript types, CBOR codecs, and more via generator plugins.

Three Wesley packages already serve Echo:

| Package | What it does | Status |
| --- | --- | --- |
| `@wesley/generator-echo` | SDL → `echo-ir/v1` JSON IR + ops catalog + host helpers | v0.1.0 (working) |
| `@wesley/generator-ttd` | SDL → Rust/TS types, CBOR codecs, registries, manifests | v0.1.0 (working) |
| `@wesley/generator-vue` | SDL → Vue composables, dispatchers, reactivity wrappers | v0.1.0 (scaffold) |

Echo also has a Rust-side consumer (`echo-wesley-gen` crate) that reads the JSON IR these generators produce.

---

## Milestones

### E0 — Plugin Pipeline Stabilization

> **Prerequisite for everything below.** Make sure Wesley's plugin architecture is solid enough that Echo generators can evolve independently.

- [x] Stable generator plugin interface (`GeneratorPlugin` contract in `@wesley/core`)
- [ ] Plugin discovery and registration via `wesley.config.mjs`
- [ ] Generator-level test harness: feed SDL in, assert output artifacts
- [ ] Document plugin lifecycle (parse → plan → generate → emit) for generator authors

**Echo issue:** N/A (Wesley infra)
**Depends on:** nothing
**Blocks:** E1, E2, E3

---

### E1 — Boundary Grammar & Schema Hash Pinning (W1)

> Wesley becomes an importable grammar with a canonical AST. Schema hashes get pinned in Echo's receipts/events so old logs can never be silently reinterpreted under new semantics.

- [ ] Canonical AST representation (deterministic serialization of the parsed SDL)
- [ ] `schema_hash` computation: `SHA-256(canonical_ast_bytes)` → stable identity for a schema version
  - Wesley currently uses SHA-256; BLAKE3 migration is deferred
- [ ] `registry_hash` computation: hash of the full generated registry blob
- [ ] Schema hash chain: `SDL → IR → bundle` — each stage's hash recorded in output metadata
- [ ] IR version bump (`echo-ir/v2`) to carry hash fields natively
- [ ] `SchemaDelta` vocabulary: describe what changed between two schema versions (additions, removals, type changes)
- [ ] Wesley patch dry-run: `wesley diff old.graphql new.graphql` → human-readable + machine-readable delta

**Echo issues:** [#174](https://github.com/flyingrobots/echo/issues/174), [#193](https://github.com/flyingrobots/echo/issues/193), [#194](https://github.com/flyingrobots/echo/issues/194)
**Depends on:** E0
**Blocks:** E2

---

### E2 — SPEC-0008 Generator Plugins (Canonical Encoding + GuardedView + Golden Vectors)

> The heart of deterministic storage. Wesley must generate canonical byte encoders so that `BLAKE3(encode(value))` produces identical hashes on every platform.

#### E2a — Canonical Byte Encoders (`raw_le`)

- [ ] `raw_le` encoding plugin: field-by-field encoding with deterministic field order and explicit endianness
- [ ] Collision-free `Option` encoding (distinguish `Some(0)` from `None` — no sentinel values)
- [ ] No reliance on host memory layout (no `transmute`, no `repr(Rust)`)
- [ ] Generate encoders for **Rust** target
- [ ] Generate encoders for **TypeScript/WASM** target
- [ ] `layout_hash` computation: hash of the exact codec layout (any encoding change → new hash)

#### E2b — Schema-Defined Core Types

Wesley schemas must define canonical encodings for Echo's core storage types:

- [ ] `WorldlineTickPatchV*` (patch blobs)
- [ ] `SnapshotManifest` (segment directory)
- [ ] `ClaimRecord` (privacy-safe ledger carrier)
- [ ] `PrivateAtomRefV1` (privacy reference format)
- [ ] `OpaqueRefV1` (opaque pointer blob)

#### E2c — GuardedView Generation

- [ ] Generate rule-specific view surfaces that expose only declared reads/writes
- [ ] Build-time footprint enforcement: a rule cannot access fields it didn't declare
- [ ] Views are artifacts (generated code), not a runtime service

#### E2d — Golden Vectors

- [ ] Golden vector test suite: prove `Rust encode(value) == TypeScript encode(value)` byte-for-byte
- [ ] Option encoding vectors (`Some(0)` vs `None` vs `Some(None)` for nested options)
- [ ] Round-trip determinism verification
- [ ] Cross-platform CI matrix (Linux/macOS/Windows, musl/glibc)
- [ ] Vector format: checked-in `.json` files with hex-encoded expected bytes

**Echo issues:** SPEC-0008 (multi-issue)
**Depends on:** E1 (needs stable `schema_hash` and `layout_hash`)
**Blocks:** E4

---

### E3 — `@wes_join` Directive (Lattice / CRDT Joins)

> Lattice join strategies declared per-field in the schema, so Echo's merge semantics are schema-driven rather than hard-coded.

- [ ] `@wes_join(strategy: "union")` directive on set-typed fields
- [ ] `@wes_join(strategy: "max")` directive on scalar fields (cap/max lattice)
- [ ] `@wes_join(strategy: "lww")` directive for last-writer-wins fields
- [ ] Directive validation: reject `@wes_join` on incompatible field types
- [ ] Generate `JoinFn` trait implementations in Rust output
- [ ] Generate join metadata in JSON IR so `echo-wesley-gen` can produce the Rust `Lattice` impls
- [ ] Document join semantics and ACI (Associative, Commutative, Idempotent) property requirements

**Echo milestone:** M2.1 – Lattice Joins
**Depends on:** E0
**Blocks:** nothing (can proceed in parallel with E1/E2)

---

### E4 — Privacy Type Schemas (Wave 5)

> Schema-defined privacy types that participate in hashing and CAS storage.

- [ ] `ClaimRecord` canonicalization (privacy-safe ledger carrier)
- [ ] `PrivateAtomRefV1` canonical encoding (privacy reference blobs)
- [ ] `OpaqueRefV1` canonical encoding (opaque pointer blobs)
- [ ] Privacy-aware golden vectors

**Depends on:** E2 (needs canonical encoders)
**Blocks:** nothing currently

---

## Deferred

These items are acknowledged but not scheduled:

| Item | Why deferred |
| --- | --- |
| SHA-256 → BLAKE3 migration | Wesley uses SHA-256 today; Echo's SPEC-0008 specifies BLAKE3. Migration is a breaking change to hash chains and will be coordinated across both repos when E1 lands. |
| `echo-ttd-gen` Rust crate | Mentioned in Echo's history but not in current workspace. May be folded into `echo-wesley-gen` or created when TTD protocol stabilizes. |
| Supabase/PG target for Echo schemas | Wesley already generates PG migrations for its own schemas; Echo may eventually want PG-backed storage, but this is speculative. |

---

## Cross-Repo Dependency Map

```
Wesley (this repo)                          Echo (~/git/echo)
─────────────────                          ──────────────────
@wesley/generator-echo                     crates/echo-wesley-gen
  └─ emits echo-ir/v1 JSON  ──────────►     └─ reads JSON IR
  └─ emits schema_hash      ──────────►     └─ pins in receipts

@wesley/generator-ttd                      crates/echo-ttd (future)
  └─ emits Rust types       ──────────►     └─ compiled into echo

@wesley/generator-vue                      packages/ (website demo)
  └─ emits Vue composables  ──────────►     └─ used by TTD demo UI

@wesley/core                               (consumed indirectly)
  └─ plugin pipeline
  └─ canonical AST
  └─ @wes_join validation
```

---

## How to Use This Document

- **Working on a Wesley generator?** Check which Echo milestone it maps to.
- **Planning an IR format change?** Coordinate with `echo-wesley-gen` in the Echo repo — it's the primary consumer.
- **Adding a directive?** Make sure it's validated in `@wesley/core` and documented in the JSON IR spec.
- **Cutting a release?** Echo pins specific Wesley versions; breaking changes need a coordinated bump.

This roadmap complements Wesley's own `ROADMAP-ALPHA.md` (browser playground) and Echo's `docs/ROADMAP.md` (engine milestones).

---

## Document Index

| Document | Contents |
| --- | --- |
| [Execution Plan](./execution-plan.md) | Dependency graph, critical path, parallelization, phased schedule, summary table |
| [Review Amendments](./review-amendments.md) | Cross-cutting policy decisions (SHOULD/COULD changes, risks) |
| [Task Specs: E0](./tasks/E0-plugin-pipeline.md) | E0.1–E0.5 — Plugin pipeline stabilization |
| [Task Specs: E1](./tasks/E1-boundary-grammar.md) | E1.1–E1.7 — Boundary grammar & schema hash pinning |
| [Task Specs: E2](./tasks/E2-encoding.md) | E2a.1–E2d.1 — Canonical encoding, views, golden vectors |
| [Task Specs: E3](./tasks/E3-joins.md) | E3.1–E3.3 — @wes_join directive & lattice joins |
| [Task Specs: E4](./tasks/E4-privacy.md) | E4.1 — Privacy type canonical encodings |
| [Gantt Chart](./gantt.html) | Interactive D3 visualization of task schedule |
