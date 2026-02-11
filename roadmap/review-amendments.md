# Review Amendments

> Applied per review verdict: **APPROVE — with surgical amendments**.
> These sections summarize cross-cutting policy decisions. All items below have been **wired into their respective task specs** as concrete requirements and acceptance criteria. This appendix serves as a reference index.

---

## SHOULD Changes (High Leverage)

### SHOULD-1 — Conformance Suite Package

Before E2d fully lands, create a shared `test/conformance/` directory (or `@wesley/conformance` package) with:

- Canonical AST fixtures (input SDL + expected canonical bytes)
- Hash fixtures (input → expected hex for each hash stage)
- Layout fixtures (type definition → expected `layout_hash`)
- Join semantics fixtures (input pairs + strategy → expected merge result)

This is the language test suite for Wesley semantics. It prevents regressions across plugins and enables future third-party implementations to prove conformance.

**When:** Start alongside E1.1. Grow incrementally with each milestone.
**Wired into:** E1.1, E1.2, E2d.1 (Definition of Done — conformance fixture requirements)

---

### SHOULD-2 — Feature Gates by Milestone

Use explicit config flags to gate in-progress features:

```js
// wesley.config.mjs
experimental: {
  irV2: true,       // E1.5
  rawLe: false,     // E2a
  join: false,       // E3
}
```

This lets work land progressively on `main` without breaking ecosystem users accidentally. Remove gates when the feature is stable.

**When:** Implement in E0.2 (plugin discovery already reads config).
**Wired into:** E0.2 (Requirements — `experimental` config block, Acceptance Criteria, Definition of Done)

---

### SHOULD-3 — Version the Plugin Contract Independently

`GeneratorPlugin` should carry an `apiVersion` field (e.g., `"1"`).

```js
const plugin = {
  apiVersion: "1",
  name: "generator-echo",
  // ...lifecycle hooks
};
```

Without this, future core upgrades become breakage roulette. Wesley core checks `apiVersion` and emits a clear error if a plugin's contract version is unsupported.

**When:** Implement in E0.1 (part of the interface definition).
**Wired into:** E0.1 (Requirements — `apiVersion` field in `GeneratorPlugin` interface, Acceptance Criteria, Definition of Done)

---

### SHOULD-4 — Performance Budgets per Milestone

Extend the E1.1 timing target pattern to all milestones:

| Milestone | Operation | Budget |
| --- | --- | --- |
| E1.1 | `canonicalize()` for 1,000-type schema | < 100ms |
| E1.2 | `schemaHash()` for 1,000-type schema | < 150ms (includes canonicalization) |
| E1.6 | `computeDelta()` for two 500-type schemas | < 200ms |
| E1.7 | `wesley diff` CLI end-to-end | < 500ms |
| E2a.1 | Encoder generation for 100-type schema | < 2s |
| E2a.1 | `encode_raw_le()` single struct (50 fields) | < 1µs (Rust runtime) |
| E3.2 | `join()` single struct (20 fields) | < 500ns (Rust runtime) |

Determinism that takes forever is still a failure. Measure in CI, fail on regression.

**Wired into:** E1.1, E1.2, E1.6, E1.7, E2a.1, E3.2 (Definition of Done — performance budget line items)

---

### SHOULD-5 — Clarify Emit Responsibility

Current lifecycle: `init → plan → generate → emit` pushes I/O into plugins. This creates risk: plugins with side effects are harder to test, compose, and reason about.

**Recommended model:**
- Plugins return artifacts (pure data: `Record<string, string | Uint8Array>`)
- Core handles writing, overwrite detection, and atomic commits
- `emit()` becomes a core responsibility, not a plugin hook

**Decision: RESOLVED.** Plugins return pure data. Core handles all I/O. `emit()` removed from plugin lifecycle.
**Wired into:** E0.1 (Requirements — pure-return `generate()`, emit responsibility note, Acceptance Criteria, Scope table, Definition of Done)

---

## COULD Changes (Nice-to-Have, Not Blocking)

- [x] `wesley diff --format summary` — single-line CI-friendly output → **Wired into E1.7** (flags, acceptance criteria, Definition of Done)
- [x] Machine-readable error codes for plugin and schema validation failures → **Wired into E0.1** (acceptance criteria, Definition of Done — `WPLY0xx` prefix)
- [x] `wesley doctor` command → **Added as E0.5** (full task spec with requirements, acceptance criteria, Definition of Done)
- [ ] Mermaid dependency graph generation from milestone metadata for planning docs (not yet wired — no natural task spec home)

---

## Risks (Underestimated)

### Risk 1 — Cross-Repo Release Choreography

E1.5 and E2.* need tightly coordinated release pins with Echo. `echo-wesley-gen` consumes Wesley's IR output — if IR format bumps and Echo's consumer haven't been updated, builds break.

**Mitigation:** Pre-plan version windows. Each IR-breaking Wesley PR should include a companion Echo PR (or at minimum a compatibility shim). Pin Wesley version ranges in Echo's `Cargo.toml` with exact minor versions during transition periods.

### Risk 2 — Overlapping Source-of-Truth During Transition

E2b.1 defines core types in Wesley SDL, but Echo currently has hand-written Rust structs for the same types. During transition, both exist. Drift is inevitable.

**Mitigation:** Short dual-run validation period — generate from Wesley SDL, diff against hand-written structs, assert equivalence in CI. Once validated, delete hand-written structs and enforce one-way generation. Do not let the dual-run period exceed one release cycle.

### Risk 3 — Plugin Fault Isolation Semantics in CI

Continuing after plugin failures is useful locally but dangerous in CI. A "passing" build that silently skipped a broken generator is worse than a failed build.

**Mitigation:** Addressed by MUST-1 exit code policy. CI MUST NOT use `--best-effort`. Default mode (non-zero exit on any plugin failure) is the CI path. `--best-effort` is for local development only.
