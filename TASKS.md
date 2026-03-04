# PR #392 Self-Code Review — Fix Tracker

All items discovered during the self-code review of `qir/phase-c` vs `origin/main`.
Each item has enough context to execute independently if session context is lost.

---

## Critical

- [x] **C1 — `Predicate.isNull()`/`isNotNull()` runtime crash**
  `packages/wesley-core/src/domain/qir/Nodes.mjs:82-83` produces `{ kind: 'IsNull' }` but
  `lowerToSQL.mjs:renderPredicate` only handles `{ kind: 'Compare', op: 'isNull' }`.
  `OpPlanBuilder.mjs:185-186` calls `Predicate.isNull()`, so any op with null-check filters crashes.
  **Fix:** Change `Nodes.mjs` statics to return `{ kind: 'Compare', left: expr, op: 'isNull' }` (and `isNotNull`).
  Add a test exercising the full pipeline: `OpPlanBuilder` → `lowerToSQL` with `isNull` filter.

- [x] **C2 — SQL injection via unvalidated `typeHint` on `ParamRef`**
  `packages/wesley-core/src/domain/qir/lowerToSQL.mjs:240` interpolates `p.typeHint` as `::${typeHint}` with no validation.
  **Fix:** In `renderParam`, validate `typeHint` against `/^[a-zA-Z_][a-zA-Z0-9_ [\]]*$/` before interpolating. Throw on invalid.

- [x] **C3 — SQL injection via unvalidated `type` on `Literal` nodes**
  `packages/wesley-core/src/domain/qir/lowerToSQL.mjs:201-203` interpolates `type` as a raw cast.
  **Fix:** In `renderLiteral`, validate `type` against the same safe-type regex as C2. Throw on invalid.

- [x] **C4 — SQL injection via unvalidated `nulls` in ORDER BY**
  `packages/wesley-core/src/domain/qir/lowerToSQL.mjs:225` interpolates `ob.nulls` after `toUpperCase()` only.
  **Fix:** In `renderOrderBy`, validate `ob.nulls` is exactly `'first'` or `'last'` (case-insensitive). Throw otherwise.

- [x] **C5 — Sign/verify canonicalization mismatch breaks multi-signature certs**
  `packages/wesley-cli/src/commands/cert-sign.mjs:23-24` canonicalizes including existing signatures.
  `cert-verify.mjs:57` zeros them out. Second+ signatures never verify.
  **Fix:** In `cert-sign.mjs`, canonicalize with `{ ...json, signatures: [] }` to match verify. Add a test with two signatures.

## Major

- [x] **M1 — `qir` subcommands silently drop global CLI options**
  `packages/wesley-cli/src/commands/qir-validate.mjs:14,23,33,43` — subcommand `.action()` handlers
  call `this.execute({ ...options, file })` without merging parent program opts.
  `--verbose`, `--quiet`, `--json` are ignored.
  **Fix:** In each `.action()`, merge global opts: `const globalOpts = command.parent?.parent?.opts?.() || {};`
  then `this.execute({ ...globalOpts, ...options, file })`.

- [x] **M2 — `validateRealm` can mask original error in failure path**
  `packages/wesley-cli/src/commands/rehearse.mjs:121-127` — `validateRealm()` called in `catch` block
  before rethrowing `REALM_FAILED`. If `validateRealm` throws, original error is lost.
  **Fix:** Wrap in `try { await validateRealm(...); } catch (ve) { logger.warn(...); }`.

- [x] **M3 — Unvalidated `s.type`, `s.default`, `s.using` in migration SQL emission**
  `packages/wesley-cli/src/commands/plan.mjs:206-215` and `rehearse.mjs:209-219` inject raw strings into SQL.
  `rehearse.mjs` executes this against a real database.
  **Fix:** Validate `s.type` against a PG type allowlist regex; `s.using` against `btree|hash|gin|gist|spgist|brin`;
  `s.default` with at least a no-semicolon guard. Apply in both files (or extract shared — see m4).

- [x] **M4 — `LIMIT NaN` emitted for non-numeric strings**
  `packages/wesley-core/src/domain/qir/lowerToSQL.mjs:69-70` — `Number('abc')` → `LIMIT NaN`.
  **Fix:** After `Number(plan.limit)`, check `Number.isFinite(n) && n >= 0`; throw if invalid. Same for `offset`.

- [x] **M5 — `Cursor.mjs` not exported from barrel file**
  `packages/wesley-core/src/domain/qir/index.mjs` is missing `export * from './Cursor.mjs';`.
  **Fix:** Add the export line.

- [x] **M6 — `Cursor.mjs` uses `Buffer` — violates platform-agnostic constraint**
  `packages/wesley-core/src/domain/qir/Cursor.mjs:3,9` — `Buffer.from().toString('base64url')` is Node-only.
  `@wesley/core` must run in browsers.
  **Fix:** Replace with `btoa`/`atob` (available in Node 16+ and all browsers). Use base64url encoding via
  `btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')`.

- [x] **M7 — Docs reference non-existent `schemas/plan.schema.json`**
  `docs/spec/ir-family-spec.md:16,76` — actual file is `schemas/plan-report.schema.json`.
  **Fix:** Find/replace `plan.schema.json` → `plan-report.schema.json` in that file.

- [x] **M8 — `ParamCollector` silently ignores unrecognized predicate kinds**
  `packages/wesley-core/src/domain/qir/ParamCollector.mjs:76-80` — `default` branch is a silent no-op.
  **Fix:** Throw `Unsupported predicate kind` in the default branch (defense-in-depth). Mooted partially by C1 fix.

## Minor

- [x] **m1 — `this.ctx.logger` vs `logger` in `generate.mjs`**
  Lines 521, 524, 528 use `this.ctx.logger` (root logger) instead of the local `logger` (child with log-level filtering).
  **Fix:** Replace `this.ctx.logger` → `logger` on those 3 lines.

- [x] **m2 — `fs.readFile()` vs `fs.read()` inconsistency**
  `cert-sign.mjs:26` and `cert-verify.mjs:98` use `this.ctx.fs.readFile()` while all other commands use `this.ctx.fs.read()`.
  **Fix:** Change to `this.ctx.fs.read()` for consistency with the host adapter contract.

- [x] **m3 — `process.env` / `globalThis.wesleyCtx` bypass DI context**
  `generate.mjs:183,185,263-267,769,773` — reads `process.env` and `globalThis?.wesleyCtx?.shell` directly.
  **Fix:** Use `this.ctx.env` and `this.ctx.shell` consistently.

- [x] **m4 — Duplicated migration logic between `plan.mjs` and `rehearse.mjs`**
  `plan.mjs:116-232` and `rehearse.mjs:160-235` duplicate `buildAdditivePlan`, `explainPlan`, `lockFor`, `emitMigrations`.
  **Fix:** Extract to a shared module (e.g., `src/commands/_migration-plan.mjs`) and import from both.

- [x] **m5 — Duplicate `sanitizeIdentBase` implementations**
  `emit.mjs:80-89` (private, with 63-char limit) vs `identifiers.mjs:58-63` (public, no limit).
  **Fix:** Remove private copy from `emit.mjs`, import from `identifiers.mjs`, apply length check at call site.

- [x] **m6 — `decodeCursor` swallows errors; no `__proto__` filtering**
  `Cursor.mjs:6-14` — blanket `catch` returns `{}`; `JSON.parse` on untrusted input has no key filtering.
  **Fix:** After `JSON.parse`, delete `__proto__` and `constructor` keys. Narrow catch to expected errors.

- [x] **m7 — `ir-family.md` describes envelope as "Planned (future)"**
  `docs/spec/ir-family.md:24-26` — envelope ships in this PR.
  **Fix:** Update prose to present tense.

- [x] **m8 — `ir-family.md` references wrong bats test path**
  `docs/spec/ir-family.md:22` says `test/qir-schema.bats`, actual is `packages/wesley-cli/test/qir-schema.bats`.
  **Fix:** Correct the path.

- [x] **m9 — `ir-family-spec.md` uses future tense for existing schemas**
  Lines 76, 82, 128 say "will live at" / "will complete" for schemas that already ship.
  **Fix:** Change to present tense.

- [x] **m10 — Dead code: `ParamCollector` handles non-existent `DistinctOn` relation kind**
  `ParamCollector.mjs:44-47` — no `DistinctOn` relation node exists.
  **Fix:** Remove the dead branch.

- [x] **m11 — Dead code: `ParamCollector` handles `Cast`/`CaseWhen` not in schema**
  `ParamCollector.mjs:102-111` — forward-looking code disconnected from current schema.
  **Fix:** Remove or gate behind a comment explaining it's reserved for a future QIR version.

## Nits

- [x] **n1 — Pointless `catch (e) { throw e; }` in `cert-verify.mjs:54-56`**
  **Fix:** Remove the try/catch or add error enrichment.

- [x] **n2 — Bats tests lack `WESLEY_REPO_ROOT` fallback**
  `plan-report-schema.bats` and `realm-schema.bats` use relative paths without the robust pattern from `ops-explain.bats`.
  **Fix:** Add `setup()` with `ROOT_DIR="${WESLEY_REPO_ROOT:-$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)}"`.

- [x] **n3 — Missing `opts` arg in `renderJsonAgg` call to `renderOrderBy`**
  `lowerToSQL.mjs:218` passes 3 args; the body call at line 59 passes 4.
  **Fix:** Add `opts` as 4th argument.

- [x] **n4 — Trailing comma inconsistency in RESERVED set**
  `identifiers.mjs:19` has trailing comma; `emit.mjs`'s set does not.
  **Fix:** Normalize (add or remove to match project style).

- [x] **n5 — `escIdent` trivial passthrough to `renderIdent`**
  `lowerToSQL.mjs:21` — `const escIdent = (s, opts) => renderIdent(s, opts);` adds nothing.
  **Fix:** Replace `escIdent` usage with `renderIdent` directly.

- [x] **n6 — Redundant `export` + `env` prefix in `qir-envelope-schema.bats:5`**
  **Fix:** Use one or the other.

- [x] **n7 — Redundant `"additionalProperties": true` in `plan-report.schema.json:57`**
  This is the JSON Schema default.
  **Fix:** Remove the line.
