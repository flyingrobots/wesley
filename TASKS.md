# PR #392 Self-Code Review — Fix Tracker (Round 5)

CodeRabbit-style review found 37 issues (3 critical, 12 major, 14 minor, 8 nits).
Each item has enough context to execute independently if session context is lost.

---

## Critical

- [ ] **CR-1 — `s.default` SQL injection guard is insufficient**
  `packages/wesley-cli/src/commands/_migration-plan.mjs:107-108`
  Only rejects semicolons. Clause injection possible without statement termination.
  **Fix:** Use a stricter validation — e.g., reject any value containing `'`, `--`, or `/*`, or require
  the default to match a safe literal pattern (numeric, quoted string literal, function call).

- [ ] **CR-2 — `s.table` interpolated raw into SQL comment (newline breakout)**
  `packages/wesley-cli/src/commands/_migration-plan.mjs:105`
  `-- create table ${s.table}` — newline in `s.table` breaks out of the comment.
  **Fix:** Sanitize table name in comment: replace newlines/control chars, or use `tname(s.table)`.

- [ ] **CR-3 — `process.env` still used directly in ~8 new code paths**
  `generate.mjs:402,415,462` | `cert-verify.mjs:26` | `rehearse.mjs:244` |
  `plan.mjs:61` | `qir-validate.mjs:69,94,113,132`
  **Fix:** Replace all `process.env.WESLEY_REPO_ROOT || process.cwd()` with a helper or
  use `this.ctx.env?.WESLEY_REPO_ROOT || process.cwd()` consistently. For `qir-validate.mjs`,
  pass env through context.

## Major

- [ ] **CR-4 — `extractJsonBlock` duplicated with divergent implementations**
  `cert-sign.mjs:54-67` vs `cert-verify.mjs:79-88`
  **Fix:** Extract to a shared helper (e.g., `_cert-utils.mjs`). Both files import from there.

- [ ] **CR-5 — `canonicalize` duplicated between cert-sign and cert-verify**
  `cert-sign.mjs:69-78` vs `cert-verify.mjs:90-93`
  **Fix:** Move to the same shared `_cert-utils.mjs`.

- [ ] **CR-6 — AJV instantiation pattern duplicated ~8 times**
  `cert-verify.mjs`, `generate.mjs` (×3), `plan.mjs`, `rehearse.mjs` (×2), `qir-validate.mjs`
  **Fix:** Extract `createAjv()` helper to a shared utility, lazy-importing ajv + ajv-formats.

- [ ] **CR-7 — `resolveManifestEntries` calls `fs.readDir` without `?.`**
  `generate.mjs:~604`
  **Fix:** Add `?.` to match `findOpFiles` pattern: `await fs.readDir?.(dir)`.

- [ ] **CR-8 — Directory detection crashes on undefined `readDir`**
  `generate.mjs:~613`
  `fs.readDir?.(path).then(...)` — `?.` returns `undefined`, `.then()` on `undefined` throws.
  **Fix:** Guard: `const isDir = fs.readDir ? await fs.readDir(path).then(()=>true).catch(()=>false) : false;`

- [ ] **CR-9 — Silent `catch {}` swallows GraphQL parse errors in ops compilation**
  `generate.mjs:~377-380`
  **Fix:** Log a warning: `catch (e) { logger.warn(...) }`.

- [ ] **CR-10 — CHANGELOG has duplicate `### Fixed` sections**
  `CHANGELOG.md:9,111`
  **Fix:** Merge both into a single `### Fixed` section.

- [ ] **CR-11 — CHANGELOG section ordering violates convention**
  **Fix:** Reorder to: Added → Changed → Fixed.

- [ ] **CR-12 — CHANGELOG missing `n4` entry**
  TASKS.md marks n4 completed but CHANGELOG has no entry.
  **Fix:** The plan said "n4 — Moot — no change needed" because emit.mjs's RESERVED was removed
  in Commit 1. Add a note or uncheck in TASKS.md. Simplest: add a CHANGELOG line noting n4 is moot
  due to m5 (the private RESERVED set was removed when sanitizeIdentBase was consolidated).

- [ ] **CR-13 — `qir-ops.md` contradicts itself on discovery status**
  `docs/guides/qir-ops.md:93` vs `:214`
  **Fix:** Remove or rewrite the "Discovery Modes (planned)" section. Update stale "Constraints
  and behavior" text (line 24, 27). Remove stale Roadmap bullets (220-221). Remove references to
  non-existent `--ops-allow-empty` and `--ops-glob` flags.

- [ ] **CR-14 — `qir-ops.md` registry example fails its own schema**
  `docs/guides/qir-ops.md:134-147`
  **Fix:** Add `"version": "1.0.0"` to the example registry JSON.

- [ ] **CR-15 — BACKLOG.md contains stale items completed in this PR**
  `BACKLOG.md:9-10`
  **Fix:** Check off or remove the two completed items.

## Minor

- [ ] **CR-16 — `assertCleanGit` awaits synchronous `execSync`**
  `generate.mjs:769`
  **Fix:** Use `shell?.exec?.()` (async) consistently, or remove `await`.

- [ ] **CR-17 — `ir-family.md` sections lack heading markers**
  `docs/spec/ir-family.md:12,16,20,24`
  **Fix:** Add `## ` prefix to "Cross‑references", "Versioning", "Validation", "Envelope".

- [ ] **CR-18 — `qir.md` missing blank lines after all headings**
  `docs/spec/qir.md:10,17,24,29,34,37,42,46`
  **Fix:** Insert blank line after each `##` heading.

- [ ] **CR-19 — `qir.md` omits `distinctOn` from the spec**
  `docs/spec/qir.md:11-15`
  **Fix:** Add `distinctOn` to the "Top Level" section.

- [ ] **CR-20 — `qir-ops.md` stale "Constraints and behavior" text**
  `docs/guides/qir-ops.md:24,27`
  **Fix:** Update to reflect that PK resolver and strict validation are shipped.

- [ ] **CR-21 — `qir-ops.md` stale Roadmap bullets**
  `docs/guides/qir-ops.md:220-221`
  **Fix:** Remove or mark done. (May overlap with CR-13 fix.)

- [ ] **CR-22 — `plan-report.schema.json` missing `additionalProperties: false` on 4 defs**
  `schemas/plan-report.schema.json:15-24,38-45,47-54,58-76`
  **Fix:** This is intentional for Step/StepWithLock due to `allOf` interaction in draft-07.
  Add `additionalProperties: false` to Phase items, mapping items, and radar.
  Leave Step/StepWithLock as-is but add a comment in the schema explaining why.

- [ ] **CR-23 — Inconsistent `$ref` style across schemas**
  `shipme.schema.json` (absolute) vs `ir-envelope.schema.json` (relative)
  **Fix:** Normalize to relative `$ref`s in both (matching the pattern used by `ir-envelope`).

- [ ] **CR-24 — Inconsistent error construction patterns**
  Mix of `OpsError`, manual `e.code = ...`, `err.meta = ...`
  **Fix:** This is a larger refactor. Log it to `.claude/bad_code.md` rather than fixing inline.

- [ ] **CR-25 — `qir-validate.mjs` executeCore is ~80 lines of copy-paste**
  **Fix:** Same — log to `.claude/bad_code.md`. The current code works; refactoring is non-trivial.

- [ ] **CR-26 — Ops registry validation logs misleading "skipped" then throws**
  `generate.mjs:~527`
  **Fix:** Change message to `'Ops registry validation failed'`.

- [ ] **CR-27 — Manifest validation catch mutates error code blindly**
  `generate.mjs:~416`
  **Fix:** Guard: `if (e instanceof Error && !e.code) e.code = 'OPS_MANIFEST_INVALID';`

- [ ] **CR-28 — Two overlapping IR family docs without cross-links**
  **Fix:** Add a cross-reference line at the top of each file pointing to the other.

- [ ] **CR-29 — `docs/README.md` does not link to new spec documents**
  **Fix:** Add links to `ir-family-spec.md`, `ir-family.md`, `qir.md` in the docs README.

## Nits

- [ ] **CR-30 — Extra trailing newlines in 8 JSON files**
  **Fix:** Strip trailing blank lines from each file.

- [ ] **CR-31 — CHANGELOG missing comparison URLs**
  **Fix:** Add `[Unreleased]: https://github.com/flyingrobots/wesley/compare/v0.1.0...HEAD` at bottom.

- [x] **CR-32 — Mermaid `\n` in node labels may not render as linebreaks**
  `docs/spec/ir-family-spec.md:14-19`
  **Fix:** Replace `\n` with `<br/>` in Mermaid node labels.

- [ ] **CR-33 — `export default` alongside named `export class` (dead code)**
  `qir-validate.mjs:155`, `rehearse.mjs:237`, `cert-sign.mjs:82`
  **Fix:** Log to `.claude/bad_code.md` — this is a project-wide convention issue.

- [ ] **CR-34 — `lockFor` condition is correct but confusing**
  `_migration-plan.mjs:74`
  **Fix:** Add a clarifying comment explaining the PG 11+ behavior.

- [ ] **CR-35 — `qir.schema.json` Literal.value `oneOf` lists all 6 JSON types**
  **Fix:** Replace `oneOf` with `{}` (accept any JSON value).

- [ ] **CR-36 — Misleading "validation skipped" in rehearse error path**
  `rehearse.mjs:122`
  **Fix:** Change to `'REALM validation failed in error path'`.

- [x] **CR-37 — `ir-family-spec.md` heading still says "(proposed)" in mermaid**
  **Fix:** Already fixed for the section heading but the Plan IR Mermaid node should also reflect
  this is shipped. Check if the Mermaid diagram label needs updating.
  **Result:** Verified — no "(proposed)" text in any Mermaid node labels; no change needed.
