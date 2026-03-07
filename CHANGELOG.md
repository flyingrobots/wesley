# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Fixed

#### PR Self-Review (qir/phase-c)
- **Double JSON output**: Commands that write their own JSON (cert-verify, cert-create, plan, rehearse, up) no longer trigger the framework's duplicate JSON wrapper, fixing `jq` pipeline breakage and cert-e2e test failures
- **SHIPME.md marker ordering**: `extractJsonBlock()` now throws a descriptive error instead of returning null when certificate markers are present but out of order
- **SQL comment injection**: `emitMigrations()` quotes table names in SQL comments using the same `q()` function used for all other identifiers
- **Param index lookup**: `lowerToSQL` uses nullish coalescing (`??`) instead of `||` for parameter index lookups, preventing index `0` from being swallowed
- **Missing imports**: Fixed `CompilerError` import in inprocess-compiler, `ev1` typo in compiler-inprocess, removed unreachable code in GraphQLAdapter

### Changed

#### PR Self-Review (qir/phase-c)
- **Cursor encoding**: Use `charCodeAt()` instead of `codePointAt()` for Latin1 binary string decoding (atob output is always 0-255)
- **Lock-level readability**: Break dense `add_column` lock ternary into named boolean (`canAvoidRewrite`) with multi-line conditional; also fixes `step.default` truthy check (`0`/`''` are valid defaults)
- **ESLint flat config**: Migrate from legacy `.eslintrc.json` to `eslint.config.js` for ESLint 9 compatibility; install missing `eslint-plugin-promise`; fix all 612 pre-existing lint errors across the codebase
- **Pre-commit hook**: Add lint enforcement guard to `.githooks/pre-commit` (skippable via `WESLEY_SKIP_LINT_HOOK=1`)

### Added

#### Alpha Playground — Browser-Based "Try Wesley"
- **A:** `/try` route, TryNow page, workspace state, file tree UI, Tiptap-based schema editor with GraphQL highlighting
- **B:** `compileSchemaInBrowser()` API in `@wesley/host-browser` — regex-based parser, in-memory pipeline, SQL migration generation
- **C:** PGLite integration — `DbSession` with `applyMigrations`/`reset`/`query` (100-row limit), `FakeDbSession` for tests, `DatabasePanel` with table view and schema inspector
- **D1.1a:** Centralized error panel for compile, migration, query, and DB init errors
- **D1.1b:** "Reset Playground" with confirmation modal (resets schemas, DB, compile state)
- **D2.1b:** `docs/guides/browser-playground.md` architecture guide
- **D2.2:** CI test step added to `wesley-website.yml` workflow; deploy gated to push-to-main only
- 10 TryNow component tests (incl. individual error dismissal), 5 PGLite integration tests, 4 FakeDbSession regression tests
- Stable error IDs (monotonic counter) for race-free individual error dismissal
- Per-error dismiss for compile errors (no longer resets `lastSuccess`)
- Guard against false "success" when no `migrations.sql` in compiled output
- DDL detection regex uses word boundaries to avoid false triggers
- `PlaygroundNavbar` handleSelect fallback to no-op prevents TypeError
- Fixed `PlaygroundNavbar` crash when tutorial props are absent
- `wesley-website` bumped to v0.1.0
- ROADMAP-ALPHA.md marked 343/343 complete (100%)

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

### Changed
- `generator-echo` now emits `echo-ir/v2` (was `echo-ir/v1`)
- `schema_sha256` in IR uses canonical AST hash (was raw SDL hash)
- **CR-13/14/20/21:** `docs/guides/qir-ops.md` — remove stale "Discovery Modes (planned)" section, add `version` field to registry example, update shipped features to present tense, prune shipped roadmap bullets
- **CR-32:** `docs/spec/ir-family-spec.md` — replace `\n` with `<br/>` in Mermaid node labels so line breaks render correctly
- **CR-17:** `docs/spec/ir-family.md` — add `## ` heading markers to Cross-references, Versioning, Validation, and Envelope sections
- **CR-18:** `docs/spec/qir.md` — insert blank lines after all `##` headings for consistent markdown formatting
- **CR-19:** `docs/spec/qir.md` — add `distinctOn?` field to QueryPlan Top Level section
- **CR-28:** Add cross-reference blockquotes linking `ir-family.md` and `ir-family-spec.md`
- **CR-29:** `docs/README.md` — add IR Family Overview, IR Family Specification, and QIR Specification links under Core Concepts

### Fixed

#### QIR Phase C — Self-Code Review (PR #392)

- **C1:** `Predicate.isNull()`/`isNotNull()` now emit `{ kind: 'Compare', op: 'isNull' }` matching `lowerToSQL` expectations (was runtime crash)
- **C2:** Validate `ParamRef.typeHint` against safe-type regex to prevent SQL injection
- **C3:** Validate `Literal.type` against safe-type regex to prevent SQL injection
- **C4:** Validate ORDER BY `nulls` to `'first'`|`'last'` only (was injectable)
- **C5:** `cert-sign` canonicalizes with `{ ...json, signatures: [] }` to match `cert-verify`, fixing multi-signature verification
- **M1:** `qir` subcommand `.action()` handlers merge parent program opts (`--verbose`, `--quiet`, `--json`)
- **M2:** `validateRealm` in rehearse error path wrapped in try/catch to prevent masking original error
- **M3:** Migration SQL emission validates `s.type`, `s.using`, `s.default` against safe regexes
- **M4:** `LIMIT`/`OFFSET` validated as finite non-negative numbers (was emitting `NaN`)
- **M5:** `Cursor.mjs` exported from barrel `index.mjs`
- **M6:** `Cursor.mjs` uses `btoa`/`atob` instead of `Buffer` for browser compatibility
- **M7:** `ir-family-spec.md` references correct `plan-report.schema.json`
- **M8:** `ParamCollector` throws on unrecognized predicate kinds (defense-in-depth)
- **m1:** `generate.mjs` uses local `logger` instead of `this.ctx.logger` for ops registry validation
- **m2:** `cert-sign.mjs` and `cert-verify.mjs` use `fs.read()` to match host adapter contract
- **m3:** `generate.mjs` uses `this.ctx.env` and `this.ctx.shell` instead of `process.env`/`globalThis`
- **m4:** Extract shared migration helpers to `_migration-plan.mjs` (eliminates duplication)
- **m5:** `emit.mjs` delegates to shared `sanitizeIdentBase` from `identifiers.mjs`
- **m6:** `decodeCursor` strips `__proto__`/`constructor` keys after `JSON.parse`
- **m7–m9:** Documentation uses present tense for shipped schemas; correct bats test paths
- **m10–m11:** Remove dead `DistinctOn`, `Cast`, `CaseWhen` branches from `ParamCollector`
- **n1:** Remove pointless `catch (e) { throw e }` in `cert-verify.mjs`
- **n2:** Bats tests use robust `setup()` with `ROOT_DIR`/`CLI` pattern and `WESLEY_REPO_ROOT`
- **n3:** `renderJsonAgg` passes `opts` to `renderOrderBy`
- **n4:** Moot — the private RESERVED set in `emit.mjs` was removed when `sanitizeIdentBase` was consolidated (see m5)
- **n5:** Remove trivial `escIdent` wrapper; use `renderIdent` directly
- **n6:** `qir-envelope-schema.bats` removes redundant `export` (keeps `env` prefix)
- **n7:** `plan-report.schema.json` removes redundant `additionalProperties: true`
- **CR-22:** `plan-report.schema.json` — add `additionalProperties: false` to Phase items, Mapping items, and Radar object (Step/StepWithLock intentionally omitted due to `allOf` + draft-07 interaction)
- **CR-23:** `shipme.schema.json` — normalize `$ref` from absolute URL to relative path (`realm.schema.json#`)
- **CR-30:** Strip extra trailing newlines from JSON schema files (`qir`, `ir-envelope`, `ir`, `ops-manifest`, `ops-registry`, `realm`); add missing trailing newline to `evidence-map`
- **CR-35:** `qir.schema.json` — simplify `Literal.value` from verbose `oneOf` (6 JSON types) to equivalent `{}`
- **CR-16:** `assertCleanGit` prefers async `shell.exec()` over awaiting synchronous `execSync`
- **CR-34:** `lockFor` in `_migration-plan.mjs` — add clarifying comment explaining PG 11+ ADD COLUMN lock behavior

#### ESLint Fixes — Promise, Async, and Misc Rules

- Fix `promise/param-names` in `BatchOptimizer.mjs` and `TasksSlapsBridge.mjs` — rename unused resolve parameter from `_` to `_resolve`
- Fix `promise/always-return` in `ErrorRecovery.mjs` and `DocumentationGenerator.mjs` — add `return undefined` in `.then()` callbacks
- Fix `no-async-promise-executor` in `AdvisoryLockManager.mjs` — replace async executor with `Promise.resolve().then()` chain
- Fix `no-constant-binary-expression` in `StandardSanitizer.mjs` — remove redundant constant `\`SET ${nextTok}\`` on left side of `&&`
- Fix `no-return-await` in `sql-executor.test.mjs` — remove redundant `await` from `return await`
- Fix `no-control-regex` in `createNodeRuntime.mjs` — add `eslint-disable-next-line` comment for intentional null byte detection

#### QIR Phase C — Self-Review Round 3

- **SR-M1:** `lowerToSQL` LIMIT/OFFSET now requires integer values (`Number.isInteger`) — fractional values like `5.5` are rejected instead of producing invalid SQL
- **SR-M2:** `renderLiteral` rejects `NaN` and `Infinity` number values — previously emitted as bare `NaN`/`Infinity` SQL tokens
- **SR-M3:** DISTINCT ON prefix logic rewritten — removes matching entries from orderBy first, then prepends in distinctOn order (preserves user direction/nulls); prevents duplicate ORDER BY entries when user orderBy has the same expressions in a different order
- **SR-M4:** `encodeCursor`/`decodeCursor` use TextEncoder/TextDecoder pipeline for UTF-8-safe base64 — previously crashed on multi-byte Unicode (emoji, CJK) via Latin1-only `btoa`
- **SR-M5:** `emitMigrations` emits `DEFAULT` for any column with a default value and `NOT NULL` for non-nullable columns — previously only emitted `DEFAULT` when `nullable === false`, silently dropping defaults on nullable columns
- **SR-M6:** Migration `DEFAULT` validation switched from denylist regex to strict allowlist (`SAFE_DEFAULT_RE`) — accepts numeric literals, booleans, bare function calls (`now()`), and single-quoted strings only
- **SR-M7:** `loadMoriartyHistory` receives env via parameter — removed direct `process.env` access for `WESLEY_BASE_REF`, `GITHUB_BASE_REF`, `WESLEY_DEFAULT_BRANCH`, `GITHUB_DEFAULT_BRANCH`
- **SR-M8:** `loadMoriartyHistory` receives logger via parameter — replaced four `console.warn` calls with injected `logger.warn`
- **SR-M9:** `plan.mjs` `assertCleanGit` accepts `shell` parameter from `this.ctx.shell` and uses async `shell.exec()` — removed `globalThis` access and synchronous `execSync`
- **SR-M10:** `schemaValidator.mjs` `loadSchemaFile` prefers `ctx.cwd?.()` over bare `process.cwd()` fallback; added `await` on import.meta.url fallback path; added directory math comment
- **SR-M11:** Document mixed JSON Schema drafts (draft 2020-12 vs draft-07) in `docs/spec/ir-family-spec.md`
- **SR-M12:** `plan-report.schema.json` adds `additionalProperties: false` to `plan`, `explain`, and root objects; adds `description` to `Step` definition explaining why `additionalProperties` is intentionally omitted (draft-07 `allOf` constraint)
- **SR-M13:** `realm-schema.bats` test renamed from "validates against realm.schema.json" to "emits plan-report shape" — dry-run output is plan-report, not realm; added `mapping` and `radar` key assertions
- **SR-m2:** `renderExpr` duck-typing fallbacks marked as backward-compat shims; logged to `.claude/bad_code.md`
- **SR-m3:** `identifiers.mjs` RESERVED set updated to PostgreSQL 16 — added `alter`, `any`, `cast`, `drop`, `grant`, `index`, `revoke`, `set`, `trigger`, `window`, `with`
- **SR-m9:** `cert-sign.mjs` uses `TextEncoder` for UTF-8 data signing instead of `Buffer.from()`
- **SR-m13:** `generate.mjs` repo root resolution prefers `ctx.cwd?.()` over bare `process.cwd()` fallback
- **SR-m14:** `generate.mjs` registry read uses `String()` instead of `.toString('utf8')` for host-adapter compatibility
- **SR-m15:** `generate.mjs` ops registry and entry `schema` fields use `normalizedSchema` (lowercased) to match emitted SQL
- **SR-n1:** `decodeCursor` uses `JSON.parse` reviver to filter `__proto__`, `constructor`, and `prototype` keys during parsing
- **SR-n5:** Default join alias uses full table name (`j_${table}`) instead of first character to prevent collisions
- **SR-n6:** `renderSearchPath` JSDoc documents lowercase-folding behavior
- **SR-n10:** Remove duplicate `-v, --verbose` option from `generate` subcommand (already on root program)
- **SR-n12:** `WesleyCommand.mjs` `process.env.WESLEY_LOG_FORMAT` mutation documented as known DI violation
- **SR-n15:** `qir.schema.json` root self-reference `QueryPlan: { "$ref": "#" }` logged to BACKLOG for future tooling compatibility
- **SR-n17:** `ops-explain.bats` `--i-know-what-im-doing` flag documented with inline comment
- **SR-n18:** `cert-e2e.bats` jq assertions simplified from fragile `if has(...) then ... else empty end` to direct `.validSignatures == 2` / `.ok == true`
- **SR-n19:** `qir-schema.bats` header comment explains why bats-assert plugins are not loaded (inline Node.js test)

#### QIR Phase C — Self-Review Round 2

- **SR-m1:** Document `findIndexByNameOnly` fallback in `lowerToSQL.mjs` — explains when the name-only param lookup legitimately triggers and its silent-binding risk
- **SR-m4:** `ParamCollector` now visits `distinctOn` expressions — previously skipped, causing uncollected params when `distinctOn` referenced a `ParamRef`
- **SR-m5:** `emit.mjs` imports `RESERVED` from `identifiers.mjs` instead of maintaining a separate (diverged) local copy
- **SR-m6:** `OpPlanBuilder.parseRef` array branch explicitly checks for empty-string, null, and undefined table elements instead of relying on falsy coercion
- **SR-n2:** `emitFunction` wrapping alias `q` is now quoted via `sqlQuoteIdent` — consistent with strict identifier policy
- **SR-n3:** Remove dead `forceCast`/`!/::/.test(typeHint)` guard in `renderParam` — `SAFE_TYPE_RE` already prevents `::` in type hints
- **SR-n4:** `PredicateCompiler.mjs` re-exported from QIR barrel `index.mjs`

#### Pre-review fixes
- **QIR:** `lowerToSQL` recursive calls (Subquery, Lateral, ScalarSubquery, Exists) now pass full `opts` — preserves `pkResolver` and `identPolicy` in nested queries; also threads `opts` through `renderOrderBy`
- **QIR:** `lowerToSQL` join-type handling is now explicit (LEFT, INNER) and throws on unsupported types instead of silently defaulting to JOIN
- **QIR:** `lowerToSQL` DISTINCT ON prefix uses position-based matching — preserves existing direction/nulls, supports multi-column distinctOn
- **Cert:** `cert-sign` now validates key type is ed25519 before signing, preventing silent algorithm mismatch
- **Cert:** `cert-verify` no longer masks infrastructure errors (import/parse) as `VALIDATION_FAILED`
- **Ops:** `resolveManifestEntries` exclude matching uses normalized absolute-path prefix comparison (handles subtree excludes and Windows paths)
- **Ops:** `compileOpsIfRequested` reuses parsed manifest for `allowEmpty` check instead of re-reading file (fixes TOCTOU)
- **Ops:** Manifest auto-discovery no longer overrides explicit `--ops` flag
- **Schema:** `realm.schema.json` now requires `error` field when `verdict` is `FAIL`
- **Schema:** `shipme.schema.json` SHA field constrained to hex hash pattern (40 or 64 chars); signature identity fields (`signer`, `keyId`, `signature`) require non-empty strings
- **Schema:** `ops-manifest.schema.json` `schema` property rejects empty strings
- **CI:** `ops-explain.bats` and `qir-schema.bats` use fallback repo root when `WESLEY_REPO_ROOT` is unset
- **Preflight:** CLI binary existence check — removed broken `node_modules/.bin/wesley` shell-shim fallback; fails fast when primary entry point is missing
- **Preflight:** `git diff`/`git ls-files` failure now detected and reported instead of silently skipping validations
- **Preflight:** Registry path matching is now path-separator-agnostic (Windows-safe)
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

#### Self-Review Round 7 — Error Handling, Hardening, and Hygiene

- **SR-m7:** `verifySig` in `cert-verify.mjs` now distinguishes crypto mismatches (returns `false`) from infrastructure errors (re-throws) instead of swallowing all errors via bare `catch {}`
- **SR-m8:** `extractJsonBlock` in `_cert-utils.mjs` asserts marker ordering (`begin < fence < fenceEnd < end`) after position lookup, returning `null` on misordered markers
- **SR-m10:** `qir-validate.mjs` parent `qir` command now shows help when invoked without a subcommand instead of throwing
- **SR-m11:** `qir-validate.mjs` subcommand `.action()` handlers use dynamic root-walk (`while (root.parent) root = root.parent`) instead of hardcoded `command.parent?.parent?.opts?.()`
- **SR-m12:** Health probe SQL in `rehearse.mjs` escapes double quotes in table names (`replace(/"/g, '""')`) to prevent SQL injection via `t.name`
- **SR-m18:** Snapshot.json read failures in `plan.mjs` and `rehearse.mjs` now distinguish `ENOENT` (silent) from parse/infrastructure errors (logged via `logger.warn`)
- **SR-n7:** `canonicalize` in `_cert-utils.mjs` uses explicit comparator `(a, b) => a < b ? -1 : a > b ? 1 : 0` instead of locale-dependent `.sort()`
- **SR-n8:** `hashArtifacts` in `cert-create.mjs` logs debug message on file hash failure instead of swallowing errors via bare `catch {}`
- **SR-n9:** `cert-create.mjs` uses static `import { createHash } from 'node:crypto'` instead of dynamic `await import('node:crypto')` inside `hashArtifacts`

#### Self-Review Round 8 — Schema, Docs, and Hygiene

- **SR-n14:** `realm.schema.json` `if` condition now includes `"required": ["verdict"]` so the conditional `then` clause only fires when `verdict` is actually present
- **SR-n16:** `shipme.schema.json` `alg` field gains a description noting supported values (`"ed25519"` or null)
- **SR-n11:** Index dedup signature in `_migration-plan.mjs` now includes the `using` method (defaults to `btree`), preventing false dedup of indexes on the same columns with different access methods
- **SR-m16:** `docs/spec/ir-family.md` now documents Plan IR, REALM IR, Ops Manifest, and Ops Registry alongside Schema IR and QIR
- **SR-n20:** `docs/build-artifacts.md` changes `out/ops/` description from "Experimental" to "Generated" to match current enabled status
- **SR-m17:** `docs/guides/qir-ops.md` "See also" reference reformatted as a proper markdown link (target file exists)
- **SR-n22:** Strip extra trailing blank lines from fixture JSON files (`sample-flat.qir.json`, `sample-envelope.json`, `ops.manifest.json`)
- **SR-n23:** Strip extra trailing blank lines from spec docs (`qir.md`, `ir-family.md`)
- **SR-m19:** `qir-envelope-schema.bats` now asserts output content (not just exit code) after `envelope-validate`
- **SR-m20:** Verified: `holmes-setup/action.yml` omits explicit pnpm version because `pnpm/action-setup@v4` reads `packageManager` from `package.json` — no change needed

#### CodeRabbit Round-6 (PR #392)

- **CR-R6-1 (Critical):** `renderSearchPath` in `emit.mjs` now preserves PostgreSQL special variables (`$user`, `pg_temp`) verbatim instead of mangling them through `sanitizeIdentBase`
- **CR-R6-2 (Critical):** `collectParams(plan)` in `emitFunction` no longer called twice — result is now passed to `lowerToSQL` as `paramEnv`
- **CR-R6-3 (P2):** `emitOpArtifacts` normalizes `targetSchema` via `sanitizeIdentBase` before `CREATE SCHEMA IF NOT EXISTS`, ensuring schema name matches function emission
- **CR-R6-4 (Major):** Extract shared `schemaValidator.mjs` helper — centralises Ajv instantiation, format registration, and dual-path schema resolution (WESLEY_REPO_ROOT → import.meta.url fallback) across cert-verify, generate, plan, qir-validate, and rehearse commands
- **CR-R6-5 (Major):** `plan.mjs` catch block no longer mislabels infrastructure errors (import/parse) as `VALIDATION_FAILED`
- **CR-R6-6 (Major):** `rehearse.mjs` dry-run now validates and emits the same shape (full plan-report with mapping/radar stubs)
- **CR-R6-7 (Major):** `qir-validate.mjs` four nearly identical branches consolidated into `_validate()` dispatcher
- **CR-R6-8 (Major):** Join ambiguity diagnostic in `OpPlanBuilder` now catches all unqualified string refs, not just `'id'`
- **CR-R6-9 (Minor):** `decodeCursor` now returns `{}` for non-object payloads (arrays, primitives)
- **CR-R6-10 (Minor):** `plan.mjs` non-JSON path now returns `{ phases, steps }` matching JSON return shape
- **CR-R6-11 (Minor):** `qir-ops.md` markdown lint fix — add blank line after fenced code block
- **CR-R6-12 (Trivial):** `emitView`/`emitFunction` comments clarify intentional `identPolicy` default difference vs `lowerToSQL`
- **CR-R6-13 (Trivial):** `pkResolver` in `generate.mjs` gains JSDoc documenting single-table/left-deep limitation
- **CR-R6-14 (Trivial):** `ops-registry.schema.json` `params` array gains description noting uniqueness enforced at generation time
- **CR-R6-15 (Trivial):** Bats tests `plan-report-schema.bats` and `realm-schema.bats` now assert output content, not just exit status
- **CR-R6-16 (Trivial):** Test coverage: cursor null/undefined/non-object edge cases, qualified join refs positive path, builder-based pkResolver test, LIKE/CONTAINS param guard tests

## [0.1.0] - 2025-09-01
- Initial public repository layout

[Unreleased]: https://github.com/flyingrobots/wesley/compare/v0.1.0...HEAD
