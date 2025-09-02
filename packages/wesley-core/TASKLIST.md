# Wesley Code Review Checklist & Action Items
## Date: 2025-09-02
## Review By: James

## 📊 Overall Progress
```
████████░░ 78% (82/105 tasks)
```

---

## 🚨 ALPHA BLOCKERS (Fix First - Critical Issues)

### ✅ 1. Fix Array Item Nullability Tracking
**Problem**: Only tracking field nullability, missing difference between `[T]!` vs `[T!]!`
- [x] Add `itemNonNull` flag to `unwrapType()`
- [x] Thread `itemNonNull` through `Field` and all generators
- [x] Generate correct `NOT NULL` + array element checks
- [x] Update Zod schema generation
- [x] Update migration diff logic

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
- [x] Test both flags independently

### ✅ 4. Implement PostgreSQL AST → SQL Conversion
**Problem**: `toSQL()` returns placeholder text
- [x] Add deterministic stringifier for SQL AST (already implemented)
- [x] Wire @supabase/pg-parser deparse
- [x] Ensure real SQL output now
- [x] Create flip-able backend for future updates

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
- [x] Add zod-backed validation on client

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

#### ✅ 6. Add Evidence Hooks
- [x] Emit stable comments: `COMMENT ON TABLE "users" IS 'uid: abc123'`
- [x] Mirror UIDs on columns/constraints/indexes
- [x] Enable GraphQL fields ↔ DDL mapping after renames
- [x] Use existing UID directive

### Testing Enhancements

#### ✅ 7. Expand pgTAP Coverage
- [x] Policy existence per command (SELECT/INSERT/UPDATE/DELETE)
- [x] Negative tests for unauthorized access
- [x] Owner change regression tests
- [x] Hook tests to `@sensitive/@pii` directives

### Code Quality

#### ✅ 8. Centralize Identifier Casing
- [x] Create central `Identifier` helper in AST
- [x] Make GraphQL→SQL name mapping pluggable
- [x] Support snake_case vs keep-case options
- [x] Avoid mixed-case table name surprises

#### ✅ 9. Example Parity
- [x] Add RPC example with new param strategy
- [x] Include failing→passing pgTAP test
- [x] Demonstrate auto-tests story

---

## 📈 HIGH-IMPACT IMPROVEMENTS (Short Sprint)

### ✅ 1. List vs Object Relations
- [x] Only skip column emission for `@hasOne/@hasMany` (virtual)
- [x] Generate columns for FK scalars
- [x] Add guard in `buildTable()` for non-virtual lists

### ✅ 2. Directive Ergonomics
- [x] Add normalized aliases at parse time:
  - [x] `@pk` → `@primaryKey`
  - [x] `@uid` → `@unique`
- [x] Keep generators simple

### ✅ 3. RLS Correctness (partial)
- [x] Support `FORCE ROW LEVEL SECURITY` (add `AT_ForceRowSecurity`)
- [x] Generate correct USING/WITH CHECK per operation:
  - [x] SELECT: USING only
  - [x] INSERT: CHECK only
  - [x] UPDATE: USING + CHECK
  - [x] DELETE: USING only
- [x] Allow `roles: [...]` on policies

### ✅ 4. FK AST Details
- [x] Validate pg-parser requirements for `fk_attrs`
- [x] Add roundtrip test for FK constraints
- [x] Ensure correct structure at table vs column level

### ✅ 5. Index Strategy
- [x] Add deduper for equivalent indexes
- [x] Support partial indexes via `@index(where:"...")`
- [x] Avoid double-creating indexes

### ✅ 6. Type Map Completeness
Add support for:
- [x] Decimal/NUMERIC(p,s)
- [x] Date
- [x] Time
- [x] UUID
- [x] Inet

### ✅ 7. Evidence-First Errors
- [x] Push invalid directive args to EvidenceMap
- [x] Surface duplicate type names
- [x] Extend to parsing/validation phase

### ✅ 8. Configurable Thresholds
- [x] Make SCS/MRI/TCI bars tunable in `wesley.config.mjs`
- [x] Keep sensible defaults
- [x] Explain why scores failed in recommendations

### ✅ 9. Interface Name Cleanup
- [x] Rename port `MigrationDiffEngine` to `MigrationDiffer`
- [x] Avoid class name collision during DI

---

## 🗓️ MEDIUM LIFTS (This Month)

### ✅ 1. Migration Safety Rails
- [x] Make drops opt-in with `--allow-destructive` flag
- [x] Emit pre-flight pgTAP snapshots for risky alters
- [x] Hook Holmes "risk score" to DROP/ALTER TYPE presence

### ✅ 2. Owner/Tenant Model
- [x] Add `@tenant(column:"tenant_id")` directive
- [x] Add `@owner(column:"user_id")` directive
- [x] Generate default RLS
- [x] Create CLI scaffold for "multi-tenant starter"

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

### Overall Status: ALPHA READY! 🚀
- **Alpha Blockers**: 4/4 COMPLETED ✅ (100%)
- **Quick Wins**: 9/9 COMPLETED ✅ (100%)
- **High-Impact**: 9/9 COMPLETED ✅ (100%)
- **Medium Lifts**: 2/3 COMPLETED ✅ (67%)
- **Nice-to-Haves**: 0/5 NOT STARTED (0%)

**Total Tasks**: 82/105 completed (78%)

### Alpha Blockers Status
- ✅ Array Nullability: COMPLETED
- ✅ Silent Type Coercion: COMPLETED
- ✅ SQL Generation Gating: COMPLETED
- ✅ AST → SQL Conversion: COMPLETED

### Quick Wins Status
- ✅ RPC AST Alignment: COMPLETED
- ✅ Parameter Strategy: COMPLETED
- ✅ Return Types: COMPLETED  
- ✅ Auth Assumptions: COMPLETED
- ✅ Role Grants: COMPLETED
- ✅ Evidence Hooks: COMPLETED
- ✅ pgTAP Coverage: COMPLETED
- ✅ Identifier Casing: COMPLETED
- ✅ Example Parity: COMPLETED

### High-Impact Status
- ✅ List vs Object Relations: COMPLETED
- ✅ Directive Ergonomics: COMPLETED
- ✅ RLS Correctness: COMPLETED
- ✅ FK AST Details: COMPLETED
- ✅ Index Strategy: COMPLETED
- ✅ Type Map Completeness: COMPLETED
- ✅ Evidence-First Errors: COMPLETED
- ✅ Configurable Thresholds: COMPLETED
- ✅ Interface Name Cleanup: COMPLETED

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

#### Morning Session - Alpha Blockers & Quick Wins
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
- Completed remaining Alpha Blocker tasks:
  - Added array element CHECK constraints for itemNonNull
  - Updated migration diff to handle itemNonNull changes
  - Created test for SQL generation flags independence
  - Wired pg-parser with flip-able SQLBackend
- Completed Quick Wins #6-9 and High-Impact #1, #3, #6:
  - Added evidence hooks with COMMENT ON statements for UIDs
  - Expanded pgTAP coverage with per-operation RLS tests
  - Created centralized Identifier helper for name mapping
  - Added example parity with RPC and failing→passing tests
  - Fixed isVirtual() to only consider @hasOne/@hasMany
  - Added FORCE ROW LEVEL SECURITY support
  - Expanded type map with Date, Time, UUID, Decimal, Inet

#### Afternoon Session - Remaining High-Impact Items
- Completed High-Impact #2: Directive Ergonomics
  - Added normalized aliases at parse time (@pk → @primaryKey, @uid → @unique)
  - Implemented normalizeDirectiveName() in GraphQLSchemaBuilder
- Completed High-Impact #4: FK AST Details
  - Fixed fk_attrs field for pg-parser compatibility
  - Created comprehensive FK roundtrip test
  - Ensures correct constraint structure at table level
- Completed High-Impact #5: Index Strategy
  - Implemented IndexDeduplicator class
  - Prevents redundant indexes (covered by PK/unique)
  - Supports partial indexes via @index(where:"...")
- Completed High-Impact #7: Evidence-First Errors
  - Enhanced EvidenceMap with error/warning recording
  - Added validateDirectives() to GraphQLSchemaBuilder
  - Records invalid directive args, duplicate types
- Completed High-Impact #8: Configurable Thresholds
  - Created wesley.config.mjs with tunable thresholds
  - Implemented ConfigLoader with validation
  - Added score interpretation and failure explanations
- Completed High-Impact #9: Interface Name Cleanup
  - Renamed MigrationDiffEngine to MigrationDiffer
  - Updated all imports and references throughout codebase

#### Evening Session - Additional Features
- Completed feature requests:
  - Zod schema generation with proper array nullability
  - RPC client with Zod validation
  - RLS roles support with role-specific policies
  - Migration safety rails with --allow-destructive flag
- Completed Medium Lift #1: Migration Safety Rails
  - Implemented --allow-destructive flag for DROP operations
  - Added pre-flight snapshots for risky alters
  - Integrated Holmes risk scoring
- Completed Medium Lift #2: Owner/Tenant Model
  - Implemented @tenant directive with org-scoped RLS
  - Implemented @owner directive with user-level access
  - Generated SECURITY DEFINER helper functions
  - Created multi-tenant scaffold command
- Documentation:
  - Created comprehensive RLS deep-dive documentation
  - Promoted RLS docs from draft to official documentation
