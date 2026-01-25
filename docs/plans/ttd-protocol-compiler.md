<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Extracted from Echo TTD Master Plan for standalone Wesley implementation -->

# TTD Protocol Compiler Plan

**Status:** In Progress (Phase 1a/1b complete, Phase 1c partial)
**Created:** 2026-01-25
**Origin:** Extracted from `flyingrobots/echo` TTD Master Plan
**Scope:** Extend Wesley to compile deterministic protocol schemas for the Echo Time Travel Debugger

---

## Executive Summary

This plan extends Wesley with a new **TTD Protocol Compiler** capability. The goal is to generate typed protocols, registries, enforcement tables, and verification infrastructure from annotated GraphQL SDL—enabling Echo's Time Travel Debugger to prove determinism through content-addressed, hashable protocol definitions.

### Key Doctrine

> "schema_hash is the universe identity"

- Every protocol version is content-addressed and hashable
- Determinism is the product—every byte is canonical
- Codegen is deterministic: same manifest → same output bytes

---

## Part 1: New Directive Vocabulary

Wesley's existing `@wes_*` directives handle database DDL. The TTD Protocol Compiler adds a parallel set of directives for **deterministic protocol compilation**.

### 1.1 Determinism / Canonicalization Directives

```graphql
# ─── Determinism / Canonicalization ───────────────────────────────
directive @canonicalCbor(version: U32 = 1) on OBJECT | FIELD_DEFINITION
directive @noFloat on OBJECT | FIELD_DEFINITION
directive @fixed(kind: String!, scale: I32) on FIELD_DEFINITION
directive @sorted(by: [String!]!) on FIELD_DEFINITION
directive @noUnorderedMap on OBJECT | FIELD_DEFINITION
directive @keyBytes on FIELD_DEFINITION
```

| Directive | Purpose |
|-----------|---------|
| `@canonicalCbor` | Type uses canonical CBOR encoding (deterministic byte order) |
| `@noFloat` | Forbids IEEE floats (use `@fixed` decimals instead) |
| `@fixed(kind, scale)` | Fixed-point decimal with specified precision |
| `@sorted(by)` | Array field must be sorted by specified keys |
| `@noUnorderedMap` | Forbids HashMap-style types (use sorted arrays) |
| `@keyBytes` | Field is raw bytes used as lookup key |

### 1.2 Channel Registry Directives

```graphql
# ─── Channel Registry ─────────────────────────────────────────────
enum ChannelPolicy {
    LOG
    STRICT_SINGLE
    REDUCE
}
enum ReducerKind {
    LAST
    FIRST
    CONCAT
    SUM
    MAX
    MIN
    CANONICAL_MERGE
}

directive @channel(
    id: ChannelId!
    version: U16!
    policy: ChannelPolicy!
    reducer: ReducerKind
    doc: String
) on OBJECT

directive @emitKey(type: String!) on OBJECT
directive @entryType(name: String!) on OBJECT
```

| Directive | Purpose |
|-----------|---------|
| `@channel` | Marks type as a channel payload with policy and optional reducer |
| `@emitKey` | Specifies the key type for keyed channels |
| `@entryType` | Names the entry type for collection channels |

### 1.3 Op Registry Directives

```graphql
# ─── Op Registry ──────────────────────────────────────────────────
enum OpKind {
    COMMAND
    QUERY
    EVENT
}

directive @op(
    opcode: String!
    version: U16!
    kind: OpKind!
    response: String
    doc: String
) on OBJECT

directive @opError(code: String!, severity: String = "ERROR") on OBJECT
```

| Directive | Purpose |
|-----------|---------|
| `@op` | Marks type as an operation with opcode, version, and kind |
| `@opError` | Marks type as an error response with error code |

### 1.4 Rule Contract Directives

```graphql
# ─── Rule Contracts ───────────────────────────────────────────────
directive @rule(id: RuleId!, version: U16!) on OBJECT
directive @triggerOp(opcode: String!, phase: String) on OBJECT
directive @triggerEvent(eventKind: String!) on OBJECT
directive @footprintRead(kind: String!, argType: String) on OBJECT
directive @footprintWrite(kind: String!, argType: String) on OBJECT

enum EmitCount {
    EXACTLY_ONE
    AT_LEAST_ONE
    ZERO_OR_MORE
}
directive @mustEmit(channel: ChannelId!, count: EmitCount!) on OBJECT
directive @mayEmitOnly(channels: [ChannelId!]!) on OBJECT
directive @ruleDeterminism(kind: String!, detail: String) on OBJECT
directive @noSideEffects(kinds: [String!]!) on OBJECT
```

| Directive | Purpose |
|-----------|---------|
| `@rule` | Marks type as a rule contract definition |
| `@triggerOp` | Rule fires when this op executes (phase: pre/post) |
| `@triggerEvent` | Rule fires on this event kind |
| `@footprintRead` | Rule declares read access to this scope kind |
| `@footprintWrite` | Rule declares write access to this scope kind |
| `@mustEmit` | Rule MUST emit to this channel (with cardinality) |
| `@mayEmitOnly` | Rule may ONLY emit to these channels |
| `@ruleDeterminism` | Documents determinism guarantees |
| `@noSideEffects` | Declares forbidden side effects |

### 1.5 Global Invariant Directives

```graphql
# ─── Global Invariants ────────────────────────────────────────────
enum InvariantSeverity {
    INFO
    WARN
    ERROR
    FATAL
}

directive @invariant(
    id: String!
    severity: InvariantSeverity!
    kind: String! # "TICK" | "EVENTUAL" | "SAFETY"
    expr: String!
    doc: String
) on SCHEMA
```

| Directive | Purpose |
|-----------|---------|
| `@invariant` | Schema-level invariant with expression and enforcement level |

---

## Part 2: Example Schema Usage

```graphql
schema
  @invariant(id: "TICK_EMITS_STATE", severity: FATAL, kind: "TICK",
    expr: 'tick.mustEmit("ttd.state", EXACTLY_ONE)')
  @invariant(id: "SEEK_PRODUCES_HEAD", severity: ERROR, kind: "EVENTUAL",
    expr: 'op.produces("TTD_SEEK", "ttd.head", EXACTLY_ONE, within 3)')
{
  query: Query
}

# Channel payload type
type TtdStatePayload
  @channel(id: "ttd.state", version: 1, policy: STRICT_SINGLE, reducer: LAST)
  @canonicalCbor
  @noUnorderedMap
{
  header: StateHeader!
  atoms: [AtomRecord!]! @sorted(by: ["atomId"])
}

# Op request type
type CmdSeek
  @op(opcode: "TTD_SEEK", version: 1, kind: COMMAND, response: "Ack")
  @canonicalCbor
{
  cursorId: Bytes! @keyBytes
  tick: Tick!
}

# Rule contract (metadata only — no runtime code)
type RuleContract_MovePlayer
  @rule(id: "rule.move_player", version: 1)
  @triggerOp(opcode: "APP_INPUT", phase: "post")
  @footprintRead(kind: "AtomId", argType: "AtomId")
  @footprintWrite(kind: "AtomId", argType: "AtomId")
  @mustEmit(channel: "ttd.state", count: EXACTLY_ONE)
  @mayEmitOnly(channels: ["ttd.state", "ttd.provenance", "ttd.tick"])
  @noSideEffects(kinds: ["time", "random", "io"])
{
  _manifestOnly: String  # Sentinel field — type exists only for metadata
}
```

---

## Part 3: Compiler Outputs

### 3.1 Type/Codegen Outputs (what devs use)

| Output | Location | Contents |
|--------|----------|----------|
| Rust types | `<out>/rust/types.rs` | Structs/enums for ops/channels |
| CBOR codecs | `<out>/rust/cbor.rs` | Canonical encode/decode |
| Rust registries | `<out>/rust/registry.rs` | Op/channel lookup tables |
| Hash helpers | `<out>/rust/hash.rs` | Digest functions |
| TS types | `<out>/ts/types.ts` | TypeScript types |
| Zod validators | `<out>/ts/zod.ts` | Runtime validation |
| TS registries | `<out>/ts/registry.ts` | Op/channel tables |

### 3.2 Manifest/Enforcement Outputs (what keeps you honest)

| Output | Location | Contents |
|--------|----------|----------|
| Schema manifest | `<out>/manifest/schema.json` | schema_hash, version, channels, ops, rules |
| Channel registry | `<out>/manifest/channels.json` | IDs, policies, reducers |
| Op registry | `<out>/manifest/ops.json` | Opcodes, versions, types |
| Rule contracts | `<out>/manifest/rules.json` | Triggers, footprints, emissions |
| Invariants | `<out>/manifest/invariants.json` | Compiled invariant programs |
| Footprint specs | `<out>/manifest/footprints.json` | Declared read/write sets |
| Emission contracts | `<out>/manifest/emissions.json` | mustEmit/mayEmitOnly tables |

### 3.3 Docs & Golden Tests

| Output | Location | Contents |
|--------|----------|----------|
| Channel docs | `<out>/docs/channels.md` | Auto-generated |
| Op docs | `<out>/docs/ops.md` | Auto-generated |
| Golden tests | `<out>/fixtures/*.cbor` | Canonical test vectors |

---

## Part 4: Implementation Phases

Wesley TTD Protocol Compiler is split into three maturity layers to prevent scope creep.

### Phase 1a: Foundation (~1 week)

**Scope:** Parser + AST + manifests only. No codegen. No bytecode.

**Deliverables:**

- [x] Directive vocabulary parser (all directives from Part 1)
- [x] AST model for channels, ops, rules, invariants
- [x] Schema hashing (canonical field ordering)
- [x] Channel/op/rule model extraction
- [x] JSON manifest output: `schema.json`, `manifest.json`, `contracts.json`

**Key files (implemented):**

```text
packages/wesley-core/src/ttd/
├── directives.mjs     # Directive definitions and validation ✓
├── ast.mjs            # TTD-specific AST nodes ✓
├── extractor.mjs      # Extract channels/ops/rules from parsed schema ✓
├── hasher.mjs         # Canonical schema hashing ✓
├── manifest.mjs       # JSON manifest generation ✓
├── validation.mjs     # Validation rules ✓
└── index.mjs          # Public API ✓
```

**Output format:**

```json
// schema.json
{
  "schema_hash": "sha256:...",
  "version": 1,
  "channels": [...],
  "ops": [...],
  "rules": [...]
}

// manifest.json
{
  "channel_registry": {...},
  "op_registry": {...},
  "rule_contracts": {...}
}

// contracts.json
{
  "emission_contracts": [...],
  "footprint_specs": [...]
}
```

### Phase 1b: Codegen (~1 week)

**Scope:** Consumes manifests → generates types and registries.

**Deliverables:**

- [x] Rust types generation (structs/enums for ops/channels) — in Echo repo
- [x] Rust CBOR codecs (canonical encode/decode via `minicbor`) — in Echo repo
- [x] Rust registries (lookup tables) — in Echo repo
- [x] TypeScript types generation
- [x] TypeScript Zod validators
- [x] TypeScript registries

**Key files:**

```text
packages/wesley-core/src/ttd/codegen/
├── ts-types.mjs       # TS type generation ✓
├── ts-zod.mjs         # Zod validator generation ✓
├── ts-registry.mjs    # TS registry generation ✓
├── orchestrator.mjs   # Codegen orchestration ✓
└── index.mjs          # Public API ✓

packages/wesley-generator-ttd/src/
├── rust/              # Rust codegen (TODO)
│   ├── types.mjs      # Rust struct/enum generation
│   ├── cbor.mjs       # CBOR codec generation
│   └── registry.mjs   # Registry table generation
└── typescript/        # (moved to wesley-core)
```

**Invariant:** Codegen is deterministic — same manifest → same output bytes.

### Phase 1c: Law Compiler (~1 week)

**Scope:** Invariant expression compiler + enforcement bytecode.

**Deliverables:**

- [x] Invariant expression parser (EBNF grammar for `expr` field)
- [ ] Obligation spec compilation
- [x] Enforcement bytecode generation (compiler in golden.mjs)
- [x] VM runtime execution (vm.mjs with execute/verify/verifyAll)
- [ ] Verification program output
- [x] Golden test framework

**Key files:**

```text
packages/wesley-core/src/ttd/invariants/
├── lexer.mjs          # Expression lexer ✓
├── parser.mjs         # Expression parser ✓
├── ast.mjs            # Invariant AST ✓
├── golden.mjs         # Bytecode compiler + golden tests ✓
├── vm.mjs             # Verification VM runtime ✓
└── index.mjs          # Public API ✓
```

**Expression grammar (simplified):**

```ebnf
expr       = predicate | quantified ;
predicate  = subject "." method "(" args ")" ;
quantified = "forall" ident "in" collection ":" expr ;
subject    = "tick" | "op" | "channel" | "rule" ;
method     = "mustEmit" | "produces" | "emitsTo" | ... ;
args       = arg ("," arg)* ;
arg        = STRING | NUMBER | IDENT | "within" NUMBER ;
```

---

## Part 5: Integration with Existing Wesley

### 5.1 Parallel Directive Namespaces

TTD directives coexist with existing `@wes_*` directives:

| Namespace | Purpose | Example |
|-----------|---------|---------|
| `@wes_*` | Database DDL | `@wes_table`, `@wes_pk` |
| `@channel`, `@op`, etc. | TTD Protocol | `@channel(id: "ttd.state", ...)` |

The compiler detects which mode to use based on directive presence:
- If `@wes_table` present → existing DDL pipeline
- If `@channel` or `@op` present → TTD protocol pipeline
- Both can coexist in the same schema (different types)

### 5.2 CLI Integration

```bash
# Existing DDL compilation
wesley compile schema.graphql --out generated/

# New TTD protocol compilation
wesley compile-ttd ttd-schema.graphql --out generated/ttd/

# Or via flag
wesley compile schema.graphql --mode ttd --out generated/
```

### 5.3 Programmatic API

```typescript
import { compileTtdProtocol } from 'wesley-generator-ttd';

const result = await compileTtdProtocol({
  schema: schemaContent,
  outDir: 'generated/ttd',
  targets: ['rust', 'typescript', 'manifest'],
});

console.log(result.schemaHash); // "sha256:..."
```

---

## Part 6: Validation Rules

### 6.1 Determinism Validation

- `@canonicalCbor` types must not contain `Float` fields (unless `@noFloat` is absent)
- `@sorted` arrays must have comparable key fields
- `@noUnorderedMap` forbids `Map<K,V>` types

### 6.2 Channel Validation

- Channel IDs must be unique across schema
- `REDUCE` policy requires `reducer` argument
- `@emitKey` requires the key type to exist

### 6.3 Op Validation

- Opcodes must be unique
- `response` type must exist if specified
- Version must be positive integer

### 6.4 Rule Contract Validation

- `@triggerOp` opcode must reference a defined op
- `@mustEmit` channel must exist
- `@mayEmitOnly` channels must all exist
- `@footprintRead`/`@footprintWrite` kinds must be valid

### 6.5 Invariant Validation

- Expression must parse successfully
- Referenced channels/ops/rules must exist
- `within N` requires N > 0

---

## Part 7: Test Strategy

### 7.1 Unit Tests

- Directive parsing for each directive type
- AST construction
- Schema hashing determinism
- Manifest generation

### 7.2 Integration Tests

- End-to-end: SDL → manifests → codegen
- Round-trip: generate code, compile, verify types match

### 7.3 Golden Tests

- Canonical CBOR vectors for each type
- Schema hash stability across versions
- Codegen output stability

### 7.4 Determinism Tests

- Same input → same output bytes (run N times, compare hashes)
- Cross-platform consistency (if applicable)

---

## Part 8: Dependencies

### 8.1 New Dependencies

| Package | Purpose |
|---------|---------|
| (TBD) | CBOR reference implementation for golden tests |

### 8.2 Existing Wesley Dependencies (reused)

- GraphQL parser (already used)
- Code generation utilities (already exist)
- CLI framework (already exists)

---

## Part 9: Success Criteria

1. **Phase 1a Complete:** Running `wesley compile-ttd example.graphql` produces valid JSON manifests
2. **Phase 1b Complete:** Manifests produce compilable Rust and TypeScript code
3. **Phase 1c Complete:** Invariant expressions compile to verifiable bytecode
4. **Determinism Verified:** Same schema always produces identical output bytes
5. **Integration Ready:** Echo can consume Wesley output to build TTD protocol layer

---

## Appendix A: Scalar Type Mapping

| GraphQL Scalar | Rust Type | TypeScript Type | CBOR Major Type |
|----------------|-----------|-----------------|-----------------|
| `ID` | `[u8; 32]` | `Uint8Array` | 2 (bytes) |
| `String` | `String` | `string` | 3 (text) |
| `Int` | `i32` | `number` | 0/1 (int) |
| `U16` | `u16` | `number` | 0 (uint) |
| `U32` | `u32` | `number` | 0 (uint) |
| `I32` | `i32` | `number` | 0/1 (int) |
| `Boolean` | `bool` | `boolean` | 7 (simple) |
| `Bytes` | `Vec<u8>` | `Uint8Array` | 2 (bytes) |
| `Hash` | `[u8; 32]` | `Uint8Array` | 2 (bytes) |
| `Tick` | `u64` | `bigint` | 0 (uint) |

---

## Appendix B: Canonical CBOR Rules

1. **Map key ordering:** Keys sorted lexicographically by encoded bytes
2. **Integer encoding:** Smallest valid encoding (no leading zeros)
3. **No indefinite lengths:** All arrays/maps have definite length prefix
4. **No floats:** Use `@fixed` decimals instead
5. **UTC timestamps:** ISO 8601 string in UTC (no timezone offset)
