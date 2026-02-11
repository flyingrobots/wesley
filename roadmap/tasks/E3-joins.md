# E3 — `@wes_join` Directive (Lattice / CRDT Joins): Task Specs

> Lattice join strategies declared per-field in the schema, so Echo's merge semantics are schema-driven rather than hard-coded.

---

## E3.1 — `@wes_join` Directive Parsing and Validation

**User Story**

As a schema author, I can annotate fields with `@wes_join(strategy: "union")` to declare how concurrent writes to that field should be merged, and Wesley validates that the strategy is compatible with the field type.

**Requirements**

- New directive definition in `@wesley/core`:
  ```graphql
  directive @wes_join(strategy: String!) on FIELD_DEFINITION
  ```
- Supported strategies:
  - `"union"` — valid on `[T]` (list/set) fields; merge = set union
  - `"max"` — valid on `Int`, `Float` fields; merge = take maximum
  - `"lww"` — valid on any field type; merge = last-writer-wins (requires timestamp metadata)
- Validation rules:
  - `"union"` on a non-list field → error: `@wes_join(strategy: "union") requires a list field`
  - `"max"` on a non-numeric field → error: `@wes_join(strategy: "max") requires Int or Float`
  - Unknown strategy → error: `Unknown @wes_join strategy "foo". Valid: union, max, lww`
  - Multiple `@wes_join` on the same field → error: `Only one @wes_join per field`
- The directive is purely declarative; it does not generate code on its own (that's E3.2)

**Acceptance Criteria**

- [ ] `@wes_join` is recognized by Wesley's parser
- [ ] Valid usages parse without errors
- [ ] Invalid usages produce clear, actionable error messages
- [ ] The directive appears in the canonical AST (and therefore affects `schema_hash`)
- [ ] Existing schemas without `@wes_join` continue to work unchanged

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Directive definition and parsing | Code generation from the directive (E3.2) |
| Validation of strategy/field type compatibility | Custom user-defined strategies |
| Error messages | Runtime join execution |
| Canonical AST representation | Join conflict resolution policies |

**Expected Complexity**

~150–250 LoC (directive definition + validation rules + error messages)

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** `tags: [String] @wes_join(strategy: "union")` parses successfully. `score: Int @wes_join(strategy: "max")` parses successfully. `name: String @wes_join(strategy: "lww")` parses successfully.
- **Failure modes:** `name: String @wes_join(strategy: "union")` → error (non-list). `tags: [String] @wes_join(strategy: "max")` → error (non-numeric). `name: String @wes_join(strategy: "unknown")` → error (bad strategy).
- **Edges:** `@wes_join` on an optional list field (`tags: [String]` which is nullable) → valid. `@wes_join` on a nested object field with `"lww"` → valid. `@wes_join` on an enum field with `"max"` → error (enums are not numeric).
- **Fuzz/stress:** Apply `@wes_join` with random strategy strings to random field types across 100 schemas, assert no unhandled exceptions (only validation errors).

**Definition of Done**

- [ ] Directive registered in `@wesley/core`
- [ ] Validation rules implemented with clear error messages
- [ ] At least 12 test cases (4 valid + 8 invalid)
- [ ] Directive appears in canonical AST
- [ ] No regressions in existing schemas

**Blocking:** E3.2
**Blocked by:** E0.1

---

## E3.2 — Join Code Generation

**User Story**

As the Echo lattice merge system, I need Wesley to generate `JoinFn` trait implementations and IR metadata for each `@wes_join`-annotated field, so that Echo can perform schema-driven merges without hard-coded join logic.

**Requirements**

- For each type with `@wes_join`-annotated fields, generate:
  - Rust: `impl JoinFn for {Type}` with a `join(&self, other: &Self) -> Self` method that applies the declared strategy per-field
  - Fields without `@wes_join` use `"lww"` by default (or are flagged as non-mergeable)
- IR output (`echo-ir/v2`): each field's `join` metadata is populated:
  ```json
  { "name": "tags", "type": "[String]", "join": { "strategy": "union" } }
  ```
- Strategy implementations:
  - `union`: `result.field = self.field.union(other.field)` (set union, deduplicated)
  - `max`: `result.field = std::cmp::max(self.field, other.field)`
  - `lww`: last-writer-wins with deterministic tie-break (requires `JoinContext`)
- `lww` strategy needs a `JoinContext` with timestamp and writer_id; the generated code accepts this as a parameter
- **LWW Tie-Break Chain (normative):** When two values compete under `lww`, the winner MUST be selected by the following deterministic chain, evaluated in order:
  1. **Timestamp:** Higher timestamp wins
  2. **Writer ID:** If timestamps are equal, higher `writer_id` (lexicographic byte comparison) wins
  3. **Value hash:** If writer IDs are also equal, higher `SHA-256(encode_raw_le(value))` (lexicographic hex comparison) wins
  4. This chain is total — a tie at every level is only possible if both sides are byte-identical, in which case either value is correct (they are the same)
  - `JoinContext` MUST carry at minimum: `timestamp: u64` and `writer_id: [u8]`
  - This tie-break chain MUST be documented in `docs/specs/join-semantics.md` and tested with golden vectors

**Acceptance Criteria**

- [ ] Rust `JoinFn` implementation generated for types with `@wes_join` fields
- [ ] IR output includes `join` metadata for annotated fields
- [ ] `union` join on `[String]` produces deduplicated set union
- [ ] `max` join on `Int` produces the maximum value
- [ ] `lww` join uses provided timestamps to select the winner
- [ ] `lww` tie-break chain (timestamp → writer_id → value hash) is implemented and tested
- [ ] `JoinContext` carries `timestamp` and `writer_id`
- [ ] Generated join code compiles and passes tests in Echo

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Rust codegen for 3 strategies | TypeScript join codegen (future) |
| IR metadata emission | Custom user-defined strategy codegen |
| `JoinContext` for LWW timestamps | Distributed clock synchronization |
| Unit tests for generated joins | Integration with Echo's scheduler (Echo-side) |

**Expected Complexity**

~400–600 LoC (codegen for 3 strategies + IR metadata + JoinContext type)

**Est. Human Working Hours:** 10–16h

**Test Plan**

- **Golden path:** Schema with `type State { tags: [String] @wes_join(strategy: "union"), score: Int @wes_join(strategy: "max"), name: String @wes_join(strategy: "lww") }`. Generate code. Test: `join({tags: ["a","b"], score: 5, name: "old"}, {tags: ["b","c"], score: 3, name: "new"})` → `{tags: ["a","b","c"], score: 5, name: "new"}` (assuming "new" has later timestamp).
- **Failure modes:** Type with `@wes_join` but no corresponding `JoinFn` trait in scope → compile error (caught by Rust compiler). LWW join with equal timestamps → deterministic tie-break via writer_id, then value hash (per normative tie-break chain).
- **Edges:** Empty list union (`[] ∪ ["a"]` → `["a"]`). Max of two equal values. LWW with identical timestamps and identical values. Type where all fields have the same strategy. Type with 0 `@wes_join` fields (no `JoinFn` generated).
- **Fuzz/stress:** Generate 1,000 random `State` pairs, join them, assert ACI properties:
  - **Associative:** `join(join(a, b), c) == join(a, join(b, c))`
  - **Commutative:** `join(a, b) == join(b, a)` (except LWW which is timestamp-ordered)
  - **Idempotent:** `join(a, a) == a`

**Definition of Done**

- [ ] Rust `JoinFn` codegen works for all 3 strategies
- [ ] IR metadata includes `join` for all annotated fields
- [ ] ACI property tests pass for `union` and `max`
- [ ] LWW tie-break chain (timestamp → writer_id → value hash) is deterministic, documented in `docs/specs/join-semantics.md`, and has golden vector tests
- [ ] At least 15 test cases
- [ ] Generated code compiles in Echo (coordinated PR)
- [ ] Performance: runtime `join()` for a single 20-field struct completes in <500ns (Rust)

**Blocking:** nothing
**Blocked by:** E3.1, E1.5

---

## E3.3 — Join Semantics Documentation

**User Story**

As a schema author or Echo contributor, I need clear documentation of what each `@wes_join` strategy means mathematically, what properties it guarantees, and how to choose the right strategy for my use case.

**Requirements**

- A `docs/guides/join-strategies.md` document covering:
  - Mathematical definition of each strategy (union, max, lww)
  - ACI properties: which strategies satisfy Associativity, Commutativity, Idempotency
  - When to use each strategy (decision guide with examples)
  - What happens on conflict (how ties are broken)
  - How `lww` interacts with timestamps (what clock, what resolution)
  - Limitations and anti-patterns (e.g., "don't use `max` for counters — use a dedicated counter CRDT instead")
- Examples using real-world Echo schema patterns

**Acceptance Criteria**

- [ ] Document covers all 3 strategies with mathematical definitions
- [ ] ACI property table is included
- [ ] At least 3 real-world examples with schemas and expected merge results
- [ ] Decision guide helps a new user choose the right strategy
- [ ] Linked from the root docs index

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Strategy documentation | CRDT theory textbook |
| ACI properties | Formal proofs |
| Decision guide | Interactive strategy selector |
| Real-world examples | Performance benchmarks |

**Expected Complexity**

~400–600 lines of Markdown

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Manual review; examples are correct.
- **Failure modes:** N/A.
- **Edges:** N/A.
- **Fuzz/stress:** N/A.

**Definition of Done**

- [ ] `docs/guides/join-strategies.md` exists and is linked from docs index
- [ ] All 3 strategies documented with examples
- [ ] ACI property table present
- [ ] Reviewed by at least one person

**Blocking:** nothing
**Blocked by:** E3.1 (needs to know the final strategy list)
