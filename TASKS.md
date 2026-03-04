# PR #392 Self-Code Review — Fix Tracker (Round 6)

Round 5 covered 37 issues (all resolved). Round 6 addresses 26 unresolved
CodeRabbit review threads (2 critical, 9 major, 4 minor, 9 trivial/nit,
plus 2 false-positive P1/P2 from chatgpt-codex-connector).

---

## Critical

- [x] **CR-1 — `s.default` SQL injection guard is insufficient**
  `packages/wesley-cli/src/commands/_migration-plan.mjs:107-108`
  Only rejects semicolons. Clause injection possible without statement termination.
  **Fix:** Use a stricter validation — e.g., reject any value containing `'`, `--`, or `/*`, or require
  the default to match a safe literal pattern (numeric, quoted string literal, function call).

- [x] **CR-2 — `s.table` interpolated raw into SQL comment (newline breakout)**
  `packages/wesley-cli/src/commands/_migration-plan.mjs:105`
  `-- create table ${s.table}` — newline in `s.table` breaks out of the comment.
  **Fix:** Sanitize table name in comment: replace newlines/control chars, or use `tname(s.table)`.

- [x] **CR-3 — `process.env` still used directly in ~8 new code paths**
  `generate.mjs:402,415,462` | `cert-verify.mjs:26` | `rehearse.mjs:244` |
  `plan.mjs:61` | `qir-validate.mjs:69,94,113,132`
  **Fix:** Replace all `process.env.WESLEY_REPO_ROOT || process.cwd()` with a helper or
  use `this.ctx.env?.WESLEY_REPO_ROOT || process.cwd()` consistently. For `qir-validate.mjs`,
  pass env through context.

## Major

- [x] **CR-4 — `extractJsonBlock` duplicated with divergent implementations**
  `cert-sign.mjs:54-67` vs `cert-verify.mjs:79-88`
  **Fix:** Extract to a shared helper (e.g., `_cert-utils.mjs`). Both files import from there.

- [x] **CR-5 — `canonicalize` duplicated between cert-sign and cert-verify**
  `cert-sign.mjs:69-78` vs `cert-verify.mjs:90-93`
  **Fix:** Move to the same shared `_cert-utils.mjs`.

- [x] **CR-6 — AJV instantiation pattern duplicated ~8 times**
  `cert-verify.mjs`, `generate.mjs` (×3), `plan.mjs`, `rehearse.mjs` (×2), `qir-validate.mjs`
  **Fix:** Extract `createAjv()` helper to a shared utility, lazy-importing ajv + ajv-formats.

- [x] **CR-7 — `resolveManifestEntries` calls `fs.readDir` without `?.`**
  `generate.mjs:~604`
  **Fix:** Add `?.` to match `findOpFiles` pattern: `await fs.readDir?.(dir)`.

- [x] **CR-8 — Directory detection crashes on undefined `readDir`**
  `generate.mjs:~613`
  `fs.readDir?.(path).then(...)` — `?.` returns `undefined`, `.then()` on `undefined` throws.
  **Fix:** Guard: `const isDir = fs.readDir ? await fs.readDir(path).then(()=>true).catch(()=>false) : false;`

- [x] **CR-9 — Silent `catch {}` swallows GraphQL parse errors in ops compilation**
  `generate.mjs:~377-380`
  **Fix:** Log a warning: `catch (e) { logger.warn(...) }`.

- [x] **CR-10 — CHANGELOG has duplicate `### Fixed` sections**
  `CHANGELOG.md:9,111`
  **Fix:** Merge both into a single `### Fixed` section.

- [x] **CR-11 — CHANGELOG section ordering violates convention**
  **Fix:** Reorder to: Added → Changed → Fixed.

- [x] **CR-12 — CHANGELOG missing `n4` entry**
  TASKS.md marks n4 completed but CHANGELOG has no entry.
  **Fix:** The plan said "n4 — Moot — no change needed" because emit.mjs's RESERVED was removed
  in Commit 1. Add a note or uncheck in TASKS.md. Simplest: add a CHANGELOG line noting n4 is moot
  due to m5 (the private RESERVED set was removed when sanitizeIdentBase was consolidated).

- [x] **CR-13 — `qir-ops.md` contradicts itself on discovery status**
  `docs/guides/qir-ops.md:93` vs `:214`
  **Fix:** Remove or rewrite the "Discovery Modes (planned)" section. Update stale "Constraints
  and behavior" text (line 24, 27). Remove stale Roadmap bullets (220-221). Remove references to
  non-existent `--ops-allow-empty` and `--ops-glob` flags.

- [x] **CR-14 — `qir-ops.md` registry example fails its own schema**
  `docs/guides/qir-ops.md:134-147`
  **Fix:** Add `"version": "1.0.0"` to the example registry JSON.

- [x] **CR-15 — BACKLOG.md contains stale items completed in this PR**
  `BACKLOG.md:9-10`
  **Fix:** Check off or remove the two completed items.

## Minor

- [x] **CR-16 — `assertCleanGit` awaits synchronous `execSync`**
  `generate.mjs:769`
  **Fix:** Use `shell?.exec?.()` (async) consistently, or remove `await`.

- [x] **CR-17 — `ir-family.md` sections lack heading markers**
  `docs/spec/ir-family.md:12,16,20,24`
  **Fix:** Add `## ` prefix to "Cross‑references", "Versioning", "Validation", "Envelope".

- [x] **CR-18 — `qir.md` missing blank lines after all headings**
  `docs/spec/qir.md:10,17,24,29,34,37,42,46`
  **Fix:** Insert blank line after each `##` heading.

- [x] **CR-19 — `qir.md` omits `distinctOn` from the spec**
  `docs/spec/qir.md:11-15`
  **Fix:** Add `distinctOn` to the "Top Level" section.

- [x] **CR-20 — `qir-ops.md` stale "Constraints and behavior" text**
  `docs/guides/qir-ops.md:24,27`
  **Fix:** Update to reflect that PK resolver and strict validation are shipped.

- [x] **CR-21 — `qir-ops.md` stale Roadmap bullets**
  `docs/guides/qir-ops.md:220-221`
  **Fix:** Remove or mark done. (May overlap with CR-13 fix.)

- [x] **CR-22 — `plan-report.schema.json` missing `additionalProperties: false` on 4 defs**
  `schemas/plan-report.schema.json:15-24,38-45,47-54,58-76`
  **Fix:** This is intentional for Step/StepWithLock due to `allOf` interaction in draft-07.
  Add `additionalProperties: false` to Phase items, mapping items, and radar.
  Leave Step/StepWithLock as-is but add a comment in the schema explaining why.

- [x] **CR-23 — Inconsistent `$ref` style across schemas**
  `shipme.schema.json` (absolute) vs `ir-envelope.schema.json` (relative)
  **Fix:** Normalize to relative `$ref`s in both (matching the pattern used by `ir-envelope`).

- [x] **CR-24 — Inconsistent error construction patterns**
  Mix of `OpsError`, manual `e.code = ...`, `err.meta = ...`
  **Fix:** This is a larger refactor. Logged to `.claude/bad_code.md`.

- [x] **CR-25 — `qir-validate.mjs` executeCore is ~80 lines of copy-paste**
  **Fix:** Logged to `.claude/bad_code.md`. The current code works; refactoring is non-trivial.

- [x] **CR-26 — Ops registry validation logs misleading "skipped" then throws**
  `generate.mjs:~527`
  **Fix:** Already fixed in prior commit — message now says `'Ops registry validated'` (success) or propagates `OpsError` (failure).

- [x] **CR-27 — Manifest validation catch mutates error code blindly**
  `generate.mjs:~416`
  **Fix:** Already fixed in prior commit — guard `if (e instanceof Error && !e.code)` is in place.

- [x] **CR-28 — Two overlapping IR family docs without cross-links**
  **Fix:** Add a cross-reference line at the top of each file pointing to the other.

- [x] **CR-29 — `docs/README.md` does not link to new spec documents**
  **Fix:** Add links to `ir-family-spec.md`, `ir-family.md`, `qir.md` in the docs README.

## Nits

- [x] **CR-30 — Extra trailing newlines in 8 JSON files**
  **Fix:** Strip trailing blank lines from each file.

- [x] **CR-31 — CHANGELOG missing comparison URLs**
  **Fix:** Add `[Unreleased]: https://github.com/flyingrobots/wesley/compare/v0.1.0...HEAD` at bottom.

- [x] **CR-32 — Mermaid `\n` in node labels may not render as linebreaks**
  `docs/spec/ir-family-spec.md:14-19`
  **Fix:** Replace `\n` with `<br/>` in Mermaid node labels.

- [x] **CR-33 — `export default` alongside named `export class` (dead code)**
  `qir-validate.mjs:155`, `rehearse.mjs:237`, `cert-sign.mjs:82`
  **Fix:** Logged to `.claude/bad_code.md` — this is a project-wide convention issue.

- [x] **CR-34 — `lockFor` condition is correct but confusing**
  `_migration-plan.mjs:74`
  **Fix:** Add a clarifying comment explaining the PG 11+ behavior.

- [x] **CR-35 — `qir.schema.json` Literal.value `oneOf` lists all 6 JSON types**
  **Fix:** Replace `oneOf` with `{}` (accept any JSON value).

- [x] **CR-36 — Misleading "validation skipped" in rehearse error path**
  `rehearse.mjs:122`
  **Fix:** Already fixed in prior commit — message now says `'REALM validation failed in error path'`.

- [x] **CR-37 — `ir-family-spec.md` heading still says "(proposed)" in mermaid**
  **Fix:** Already fixed for the section heading but the Plan IR Mermaid node should also reflect
  this is shipped. Check if the Mermaid diagram label needs updating.
  **Result:** Verified — no "(proposed)" text in any Mermaid node labels; no change needed.

---

## Round 6 — CodeRabbit Unresolved Threads

### Critical

- [x] **CR-R6-1 — `renderSearchPath` destroys `$user`/`pg_temp`**
  `emit.mjs:118-125` — `sanitizeIdentBase` mangles PostgreSQL special search_path entries.
  **Fix:** Allowlist `$user` and `pg_temp`; emit verbatim.

### P1 (chatgpt-codex-connector)

- [x] **CR-R6-P1 — Forward strict options into recursive lowerToSQL**
  `lowerToSQL.mjs` — **FALSE POSITIVE.** Current code already passes `opts` (with
  `identPolicy` + `pkResolver`) to all recursive `lowerToSQL` calls. The `identOpts`
  shorthand is only used for identifier rendering within the same call frame.

### P2 (chatgpt-codex-connector)

- [x] **CR-R6-P2 — Normalize schema name before emitting CREATE SCHEMA**
  `generate.mjs:681` — `quoteIdent(targetSchema)` preserves case while `emit.mjs`
  lowercases via `sanitizeIdentBase`. Fix: normalize `targetSchema` before quoting.

### Major

- [x] **CR-R6-3 — Ajv boilerplate copy-pasted across 5+ commands**
  `cert-verify`, `generate`, `plan`, `qir-validate`, `rehearse`.
  **Fix:** Extract `schemaValidator.mjs` shared helper.

- [x] **CR-R6-6 — generate.mjs: Ajv duplicated + misleading error message**
  **Fix:** Replaced with `assertValid()` calls.

- [x] **CR-R6-7 — plan.mjs: overly broad catch masks infrastructure errors**
  **Fix:** Replace try/catch with direct `assertValid()` call.

- [x] **CR-R6-10 — qir-validate.mjs: four identical validation branches**
  **Fix:** Refactored into `_validate()` dispatcher method.

- [x] **CR-R6-14 — OpPlanBuilder: ambiguity diagnostic scoped to 'id' only**
  **Fix:** Now catches all unqualified string refs in join.on.

- [x] **CR-R6-21 — rehearse.mjs: validated shape ≠ emitted shape**
  **Fix:** Now validates and emits the same full plan-report shape.

- [x] **CR-R6-22 — rehearse.mjs: catch-all mislabels non-validation errors**
  **Fix:** Replaced with `assertValid()` — non-validation errors propagate naturally.

- [x] **CR-R6-23 — rehearse.mjs: Ajv boilerplate duplicated**
  **Fix:** Replaced with shared `schemaValidator.mjs`.

- [x] **CR-R6-25 — emit.mjs: collectParams called twice**
  **Fix:** Call once, pass result as `paramEnv` to `lowerToSQL`.

### Minor

- [x] **CR-R6-4 — cert-verify.mjs: ctx.fs analysis chain**
  **Fix:** Addressed via shared helper — dual-path schema resolution with
  `import.meta.url` fallback eliminates the concern.

- [x] **CR-R6-8 — plan.mjs: WESLEY_REPO_ROOT / process.cwd() fragile**
  **Fix:** Addressed via shared helper with `import.meta.url` fallback.

- [x] **CR-R6-9 — plan.mjs: inconsistent return shape**
  **Fix:** Non-JSON path now returns `{ phases, steps }`.

- [x] **CR-R6-13 — Cursor.mjs: decodeCursor returns non-object values**
  **Fix:** Returns `{}` for arrays, primitives, null.

- [x] **CR-R6-20 — qir-ops.md: missing blank line after fenced code block**
  **Fix:** Added blank line per MD031.

### Trivial / Nit

- [x] **CR-R6-5 — pkResolver silently returns null**
  **Fix:** Added JSDoc documenting the limitation.

- [x] **CR-R6-11 — plan-report-schema.bats: exit-status-only validation**
  **Fix:** Added output content assertions.

- [x] **CR-R6-12 — realm-schema.bats: exit-status-only validation**
  **Fix:** Added output content assertions.

- [x] **CR-R6-15 — cursor.test.mjs: thin coverage**
  **Fix:** Added null, undefined, array, primitive, string edge cases.

- [x] **CR-R6-16 — op-join-diagnostics.test.mjs: no positive-path test**
  **Fix:** Added qualified dot-notation and object-form tests.

- [x] **CR-R6-17 — qir-lowering-pkresolver.test.mjs: inconsistent plan construction**
  **Fix:** Added builder-based test alongside plain-object test.

- [x] **CR-R6-18 — qir-op-plan-builder.test.mjs: missing LIKE/CONTAINS tests**
  **Fix:** Added LIKE and CONTAINS negative and positive path tests.

- [x] **CR-R6-19 — ops-registry.schema.json: no param name uniqueness**
  **Fix:** Added description noting JSON Schema limitation; emitter enforces at generation time.

- [x] **CR-R6-24 — emit.mjs: identPolicy default mismatch**
  **Fix:** Added clarifying comment above `emitView`.
