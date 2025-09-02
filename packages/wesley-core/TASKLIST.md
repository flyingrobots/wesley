# Wesley Code Review Checklist & Action Items
## Date: 2025-09-02
## Review By: James

---

## 🚨 ALPHA BLOCKERS (Fix First - Critical Issues)

### ✅ 1. Fix Array Item Nullability Tracking
**Problem**: Only tracking field nullability, missing difference between `[T]!` vs `[T!]!`
- [x] Add `itemNonNull` flag to `unwrapType()`
- [x] Thread `itemNonNull` through `Field` and all generators
- [ ] Generate correct `NOT NULL` + array element checks
- [ ] Update Zod schema generation
- [ ] Update migration diff logic

```javascript
// Implementation shape:
return { base, list, nonNull /* field */, itemNonNull };
```

### ✅ 2. Remove Silent Type Coercion
**Problem**: Unknown types silently fallback to `String`, hiding schema bugs
- [x] Replace fallback with validation error
- [x] Add red "evidence" breadcrumb for unknown types
- [x] Throw explicit error instead of defaulting

### ✅ 3. Fix SQL Generation Gating
**Problem**: `enableRLS` incorrectly gates entire DDL generation
- [x] Introduce `generateSQL` flag (default: true)
- [x] Keep `enableRLS` only for RLS policy emission
- [x] Update Orchestrator constructor
- [ ] Test both flags independently

### ✅ 4. Implement PostgreSQL AST → SQL Conversion
**Problem**: `toSQL()` returns placeholder text
- [x] Add deterministic stringifier for SQL AST (already implemented)
- [ ] Wire @supabase/pg-parser deparse
- [x] Ensure real SQL output now
- [ ] Create flip-able backend for future updates

---

## ⚡ QUICK WINS (1-2 Evenings)

### RPC Generator Fixes

#### ✅ 1. Align RPC with SQL AST
- [x] Replace raw string SQL with `CreateFunctionStatement`
- [x] Use AST for parameters, volatility, SECURITY DEFINER
- [x] Ensure consistent quoting/escaping
- [x] Prevent SQL injection vulnerabilities

#### ✅ 2. Fix Parameter Strategy 
**Current Issue**: Mixing composite params with discrete primitives
- [x] **Choose one approach:**
  - [x] Option A: Single `jsonb` input + unpacking (default)
  - [x] Option B: Discrete named parameters (configurable)
  - [ ] Option C: Composite type = table type
- [x] Fix `$1.field` notation inconsistency
- [ ] Add zod-backed validation on client

#### ✅ 3. Correct Return Types
- [x] `RETURNS <table_name>` for create/update operations
- [x] `RETURNS SETOF <table_name>` for queries
- [x] `RETURNS boolean` for delete operations
- [x] Stop accidentally returning text/uuid

#### ✅ 4. Fix Hardcoded Auth Assumptions
**Problem**: Assumes `auth.uid() = user_id` column name
- [x] Pull from `@owner(column: "owner_id")` directives
- [x] Use table policy metadata
- [x] Make ownership column configurable

#### ✅ 5. Role Grant Flexibility
- [x] Allow per-RPC role overrides via directives
- [x] Fully wire `@grant` directive
- [x] Support custom role configurations

### Holmes Integration

#### ⬜ 6. Add Evidence Hooks
- [ ] Emit stable comments: `COMMENT ON TABLE "users" IS 'uid: abc123'`
- [ ] Mirror UIDs on columns/constraints/indexes
- [ ] Enable GraphQL fields ↔ DDL mapping after renames
- [ ] Use existing UID directive

### Testing Enhancements

#### ⬜ 7. Expand pgTAP Coverage
- [ ] Policy existence per command (SELECT/INSERT/UPDATE/DELETE)
- [ ] Negative tests for unauthorized access
- [ ] Owner change regression tests
- [ ] Hook tests to `@sensitive/@pii` directives

### Code Quality

#### ⬜ 8. Centralize Identifier Casing
- [ ] Create central `Identifier` helper in AST
- [ ] Make GraphQL→SQL name mapping pluggable
- [ ] Support snake_case vs keep-case options
- [ ] Avoid mixed-case table name surprises

#### ⬜ 9. Example Parity
- [ ] Add RPC example with new param strategy
- [ ] Include failing→passing pgTAP test
- [ ] Demonstrate auto-tests story

---

## 📈 HIGH-IMPACT IMPROVEMENTS (Short Sprint)

### ⬜ 1. List vs Object Relations
- [ ] Only skip column emission for `@hasOne/@hasMany` (virtual)
- [ ] Generate columns for FK scalars
- [ ] Add guard in `buildTable()` for non-virtual lists

### ⬜ 2. Directive Ergonomics
- [ ] Add normalized aliases at parse time:
  - [ ] `@pk` → `@primaryKey`
  - [ ] `@uid` → `@unique`
- [ ] Keep generators simple

### ⬜ 3. RLS Correctness
- [ ] Support `FORCE ROW LEVEL SECURITY` (add `AT_ForceRowSecurity`)
- [ ] Generate correct USING/WITH CHECK per operation:
  - [ ] SELECT: USING only
  - [ ] INSERT: CHECK only
  - [ ] UPDATE: USING + CHECK
  - [ ] DELETE: USING only
- [ ] Allow `roles: [...]` on policies

### ⬜ 4. FK AST Details
- [ ] Validate pg-parser requirements for `fk_attrs`
- [ ] Add roundtrip test for FK constraints
- [ ] Ensure correct structure at table vs column level

### ⬜ 5. Index Strategy
- [ ] Add deduper for equivalent indexes
- [ ] Support partial indexes via `@index(where:"...")`
- [ ] Avoid double-creating indexes

### ⬜ 6. Type Map Completeness
Add support for:
- [ ] Decimal/NUMERIC(p,s)
- [ ] Date
- [ ] Time
- [ ] UUID
- [ ] Inet

### ⬜ 7. Evidence-First Errors
- [ ] Push invalid directive args to EvidenceMap
- [ ] Surface duplicate type names
- [ ] Extend to parsing/validation phase

### ⬜ 8. Configurable Thresholds
- [ ] Make SCS/MRI/TCI bars tunable in `wesley.config.mjs`
- [ ] Keep sensible defaults
- [ ] Explain why scores failed in recommendations

### ⬜ 9. Interface Name Cleanup
- [ ] Rename port `MigrationDiffEngine` to `MigrationDiffer`
- [ ] Avoid class name collision during DI

---

## 🗓️ MEDIUM LIFTS (This Month)

### ⬜ 1. Migration Safety Rails
- [ ] Make drops opt-in with `--allow-destructive` flag
- [ ] Emit pre-flight pgTAP snapshots for risky alters
- [ ] Hook Holmes "risk score" to DROP/ALTER TYPE presence

### ⬜ 2. Owner/Tenant Model
- [ ] Add `@tenant(column:"tenant_id")` directive
- [ ] Add `@owner(column:"user_id")` directive
- [ ] Generate default RLS
- [ ] Create CLI scaffold for "multi-tenant starter"

### ⬜ 3. Policy Presets
Support presets:
- [ ] `@rls(preset:"owner")`
- [ ] `@rls(preset:"tenant")`
- [ ] `@rls(preset:"public-read")`
- [ ] Expand to policies + tests

---

## ✨ NICE-TO-HAVES (Polish)

### ⬜ 1. Operation Harvesting
- [ ] Expose RPC registry artifact `{name, args, returnType, directives}`
- [ ] Enable studio/UX integration
- [ ] Support Watson checks

### ⬜ 2. Defaults Parser Enhancement
- [ ] Support qualified names like `public.foo()`
- [ ] Handle `uuid_generate_v4()`
- [ ] Support variadics

### ⬜ 3. Policy Composition
- [ ] Allow multiple `@rls` directives
- [ ] Compose with OR/AND operators
- [ ] Avoid single grotesque expression strings

### ⬜ 4. Better Unknown Handling
- [ ] In `extractValue`, prefer null + evidence warning
- [ ] Stop inventing empty strings

### ⬜ 5. Orchestrator Bundle Enhancement
- [ ] Include stable schema hash (sorted JSON SHA256)
- [ ] Enable Holmes to key histories on schema state

---

## 🔧 IMPLEMENTATION FIXES

### ⬜ RPC Function Generator
- [ ] Pull table/column names from domain Schema
- [ ] Use `Field.isVirtual()` and related methods
- [ ] Stop inferring from `createX` naming

### ⬜ Test Generation Depth
- [ ] Use `getWeight()` to gate test complexity
- [ ] High-weight fields: uniqueness + nullability + default + RLS tests
- [ ] Low-weight fields: just structure tests

---

## 📊 Progress Tracking

### Alpha Blockers Status
- ✅ Array Nullability: COMPLETED (partial - needs generators)
- ✅ Silent Type Coercion: COMPLETED
- ✅ SQL Generation Gating: COMPLETED
- ✅ AST → SQL Conversion: COMPLETED (toSQL already works)

### Quick Wins Status
- ✅ RPC AST Alignment: COMPLETED
- ✅ Parameter Strategy: COMPLETED
- ✅ Return Types: COMPLETED  
- ✅ Auth Assumptions: COMPLETED
- ✅ Role Grants: COMPLETED
- 🔴 Evidence Hooks: NOT STARTED
- 🔴 pgTAP Coverage: NOT STARTED
- 🔴 Identifier Casing: NOT STARTED
- 🔴 Example Parity: NOT STARTED

---

## 🎯 Success Metrics

- **Alpha Ready**: All alpha blockers fixed
- **Beta Ready**: Quick wins + high-impact improvements complete
- **Production Ready**: Medium lifts complete, pgTAP coverage > 80%
- **v1.0**: All items complete, full documentation, examples for all patterns

---

## Notes

**James's Assessment**: "This is already dangerously close to 'ship an alpha and make people mad at their current toolchain' territory."

**Key Takeaway**: Focus on RPC alignment with AST, fix param/return semantics, make ownership/roles directive-driven → Supabase story goes from "cool" to "sensible default"

---

## Commit Log

### 2025-09-02
- Fixed Alpha Blocker #1: Added itemNonNull tracking for array nullability
- Fixed Alpha Blocker #2: Removed silent type coercion, now throws errors
- Fixed Alpha Blocker #3: Separated generateSQL flag from enableRLS
- Fixed Alpha Blocker #4: Verified toSQL() methods already work
- Fixed Quick Win RPC #1-5: Complete RPC generator rewrite with AST
  - Replaced raw SQL strings with CreateFunctionStatement AST
  - Implemented consistent jsonb parameter strategy (configurable)
  - Fixed return types (table/SETOF table/boolean)
  - Made auth column detection directive-driven (@owner)
  - Added role grant flexibility via @grant directive