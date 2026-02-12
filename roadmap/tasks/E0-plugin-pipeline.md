# E0 — Plugin Pipeline Stabilization: Task Specs

> **Prerequisite for everything below.** Make sure Wesley's plugin architecture is solid enough that Echo generators can evolve independently.

---

## E0.1 — Stable GeneratorPlugin Contract

**User Story**

As a generator plugin author, I can implement a well-defined `GeneratorPlugin` interface in `@wesley/core` so that my generator receives parsed schema data and emits output artifacts without depending on Wesley internals.

**Requirements**

- Define a `GeneratorPlugin` interface/type (JSDoc or TypeScript) in `@wesley/core` with lifecycle hooks:
  - `apiVersion: string` — plugin contract version (e.g., `"1"`). Wesley core MUST check this field and emit a clear error if the version is unsupported (e.g., `Plugin "generator-echo" requires apiVersion "2", but Wesley core only supports "1"`)
  - `name: string` — unique plugin identifier
  - `init(config)` — called once with user-supplied config from `wesley.config.mjs`
  - `plan(schema, context)` — receives the parsed canonical AST; returns a generation plan (list of output artifacts to produce)
  - `generate(plan, context)` — produces output artifact contents as `Record<string, string | Uint8Array>` (pure data, no I/O)
- **Emit responsibility:** Plugins MUST NOT perform filesystem I/O. The `generate()` hook returns artifacts as pure data. Core handles all writing, overwrite detection, and atomic commits. This keeps plugins testable, composable, and side-effect-free. (If a plugin needs custom write behavior, it should declare it in its plan and let core execute it.)
- The interface must be generator-agnostic: the same contract serves `generator-echo`, `generator-ttd`, `generator-vue`, and future generators
- Plugins must be composable: multiple generators can run in a single `wesley compile` invocation
- Errors in one plugin must not crash others (isolated failure boundaries)
- **Exit code policy:**
  - The pipeline MUST continue running all healthy plugins even if one fails
  - The final process exit code MUST be non-zero if any enabled plugin failed (unless `--best-effort` flag is passed)
  - When `--best-effort` is passed, exit code is 0 if at least one plugin succeeded, non-zero only if all plugins failed
  - The pipeline MUST emit a per-plugin status summary on completion (plugin name, status, error message if failed)

**Acceptance Criteria**

- [x] `GeneratorPlugin` type is exported from `@wesley/core`
- [x] At least one existing generator (`generator-echo` or `generator-ttd`) is refactored to implement the interface
- [x] A second generator can be added without modifying `@wesley/core`
- [x] A plugin that throws during `generate()` does not prevent other plugins from completing
- [x] The interface is documented with JSDoc including parameter types and return types
- [x] `apiVersion` field is required on all plugins; core rejects plugins with unsupported versions with a clear error message
- [x] Plugins return artifacts as pure data (`Record<string, string | Uint8Array>`) — no filesystem I/O in plugins
- [x] Core handles all artifact writing, overwrite detection, and atomic commits
- [x] Validation and plugin errors use machine-readable error codes (e.g., `WPLY001: Plugin validation error`, `WPLY002: Plugin execution error`)
- [x] Pipeline exit code is non-zero when any enabled plugin fails (default mode)
- [x] Pipeline exit code is 0 with `--best-effort` when at least one plugin succeeds
- [x] Per-plugin status summary is emitted on completion

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Interface definition and types, `apiVersion` field | Hot-reloading plugins |
| Lifecycle hook contract (pure-return, no plugin I/O) | Plugin dependency resolution (plugin A needs plugin B) |
| Error isolation between plugins | Refactor all generators |

**Expected Complexity**

~200–350 LoC (interface definition + types + error wrapper + one generator refactor)

**Est. Human Working Hours:** 6–10h

**Test Plan**

- **Golden path:** Instantiate a minimal plugin implementing `GeneratorPlugin` (with `apiVersion: "1"`), run it through the pipeline with a trivial SDL (`type Query { ping: String }`), assert it returns the declared output artifacts as pure data. Assert core writes them to disk.
- **Failure modes:** Plugin throws during `init()` → pipeline reports error, skips plugin. Plugin throws during `generate()` → other plugins still complete. Plugin returns malformed artifacts → pipeline rejects with descriptive error.
- **Edges:** Plugin with no output artifacts (valid no-op). Plugin with overlapping output paths as another plugin (should warn or error). Plugin that returns zero-length artifact content.
- **Fuzz/stress:** Feed 100 randomly-generated SDL strings (via `graphql-js` fuzzer or hand-crafted edge cases) through a plugin and assert no unhandled exceptions escape the pipeline boundary.

**Definition of Done**

- [x] `GeneratorPlugin` interface exported from `@wesley/core` with JSDoc
- [x] `apiVersion` field is part of the interface; core validates it
- [x] One existing generator refactored to implement it (pure-return `generate()`, no `emit()` hook)
- [x] Unit tests for lifecycle hooks (init/plan/generate) pass
- [x] Core artifact writer handles output (plugins have no filesystem side effects)
- [x] Error isolation test passes (one broken plugin, one healthy plugin, healthy plugin completes)
- [x] Error codes are machine-readable (prefixed, e.g., `WPLY0xx`)
- [x] No regressions in existing `@wesley/core` tests

**Blocking:** E0.2, E0.3, E0.4, E1.1, E2a.1, E3.1
**Blocked by:** nothing

---

## E0.2 — Plugin Discovery and Registration

**User Story**

As a Wesley user, I can declare which generator plugins to run in my `wesley.config.mjs` file, and Wesley discovers and loads them automatically at compile time.

**Requirements**

- `wesley.config.mjs` supports a `generators` array (or object) where each entry specifies:
  - `package` — npm package name or relative path (e.g., `"@wesley/generator-echo"` or `"./my-plugin"`)
  - `config` — plugin-specific configuration object passed to `init(config)`
  - `enabled` — optional boolean (default `true`)
- `wesley.config.mjs` supports an `experimental` object for feature-gating in-progress capabilities:

  ```js
  experimental: {
    irV2: true,       // E1.5 — echo-ir/v2 format
    rawLe: false,     // E2a — raw_le encoding generation
    join: false,      // E3 — @wes_join directive support
  }
  ```

  - All experimental flags default to `false`
  - Wesley MUST log a warning when an experimental flag is enabled (e.g., `Experimental feature "irV2" is enabled — behavior may change without notice`)
  - Generators can read experimental flags from their `init(config)` context to conditionally enable new output
  - Flags are removed (replaced with always-on behavior) when the feature is stable
- Wesley resolves each package via Node's module resolution
- Wesley instantiates each plugin and calls its lifecycle hooks in declaration order
- Invalid or missing packages produce clear error messages with the package name and resolution path

**Acceptance Criteria**

- [x] A `wesley.config.mjs` with two generators listed runs both generators
- [x] Setting `enabled: false` skips the plugin entirely (no `init()` call)
- [x] A missing package produces an error like `Generator "@wesley/generator-foo" not found. Searched: [paths]`
- [x] Plugin-specific config is forwarded to `init(config)` verbatim
- [x] `experimental` config block is parsed and validated; unknown flags produce a warning
- [x] Experimental flags default to `false` when absent
- [x] A warning is logged when an experimental flag is enabled

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Config schema for `generators` array | Dynamic plugin installation (`wesley add-plugin`) |
| Node module resolution for plugins | Remote/URL-based plugin loading |
| `enabled` toggle | Conditional plugin loading based on target environment |
| Error messages for missing plugins | Plugin marketplace or registry |

**Expected Complexity**

~150–250 LoC (config parsing + module resolution + instantiation loop)

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Config with `generator-echo` listed, `wesley compile` produces echo-ir output.
- **Failure modes:** Config lists nonexistent package → clear error, remaining generators still run, **final exit code non-zero** (per E0.1 exit code policy; zero only with `--best-effort`). Config has invalid `config` shape → plugin's `init()` rejects with descriptive error. Per-plugin status summary emitted in all cases.
- **Edges:** Empty `generators` array → Wesley compiles but produces no generator output (only parse). Same plugin listed twice → runs twice (or deduplicates with warning). Plugin path is relative (`"./local-plugin"`).
- **Fuzz/stress:** N/A (config parsing, not data processing).

**Definition of Done**

- [x] `wesley.config.mjs` schema documented and validated (including `experimental` block)
- [x] At least two generators configured and running in a single invocation
- [x] Error messages for missing/broken plugins are actionable
- [x] `experimental` flags are parsed, validated, and forwarded to plugin context
- [x] Integration test with real config file passes

**Blocking:** E1.1, E2a.1, E3.1
**Blocked by:** E0.1

---

## E0.3 — Generator Test Harness

**User Story**

As a generator plugin author, I can use a test harness that feeds SDL into my plugin and asserts on the output artifacts, without needing to set up the full Wesley pipeline or filesystem.

**Requirements**

- Export a `testGenerator(plugin, sdl, config?)` helper from `@wesley/core` (or a dedicated `@wesley/test-utils` package)
- The helper:
  - Parses the SDL using Wesley's parser
  - Calls the plugin's full lifecycle (init → plan → generate)
  - Returns the generated artifacts as an in-memory map (`Record<string, string | Uint8Array>`)
  - Does NOT write to disk (emit step is skipped or uses a virtual FS)
- Support snapshot testing: `expect(artifacts).toMatchSnapshot()`
- Support assertion helpers: `expectArtifact(artifacts, 'output.rs').toContain('pub struct')`

**Acceptance Criteria**

- [x] `testGenerator()` is importable and callable in a Vitest test file
- [x] A minimal test using `testGenerator(echoPlugin, 'type Query { ping: String }')` returns artifacts containing echo-ir JSON
- [x] The harness works without any filesystem setup (no temp dirs, no cleanup)
- [x] Snapshot tests produce stable output (no timestamps, no random values in artifacts)

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| In-memory test harness | Filesystem-based integration tests |
| Snapshot testing support | Visual diff tooling |
| Assertion helpers for artifact content | Performance benchmarking harness |
| Stable, deterministic output | Testing plugin error recovery (covered by E0.1 tests) |

**Expected Complexity**

~150–200 LoC (harness function + assertion helpers + one example test)

**Est. Human Working Hours:** 3–5h

**Test Plan**

- **Golden path:** `testGenerator(echoPlugin, validSDL)` returns `{ 'echo-ir.json': '...' }` with correct structure.
- **Failure modes:** `testGenerator(echoPlugin, invalidSDL)` throws or returns an error result (not an unhandled exception). Plugin that crashes during `generate()` → harness captures the error.
- **Edges:** SDL with no types (only directives). SDL with only enums. SDL with deeply nested input types.
- **Fuzz/stress:** Run harness with 50 SDL fixtures from Wesley's existing test suite; assert zero unhandled exceptions.

**Definition of Done**

- [x] `testGenerator()` exported and documented
- [x] At least 3 tests using the harness for `generator-echo` pass
- [x] Snapshot stability verified (run twice, no diff)
- [x] No filesystem side effects during test execution

**Blocking:** E1.1 (canonical AST tests will use this harness)
**Blocked by:** E0.1

---

## E0.4 — Plugin Lifecycle Documentation

**User Story**

As a developer who wants to write a new Wesley generator (e.g., for a new language target), I can read documentation that explains the plugin lifecycle, data flow, and extension points so I can build a generator without reading Wesley's source code.

**Requirements**

- A `docs/guides/generator-plugins.md` (or similar) covering:
  - The `GeneratorPlugin` interface with annotated examples
  - Data flow diagram: SDL → parse → canonical AST → plan → generate → emit
  - How to access schema metadata (types, fields, directives, operations)
  - How to declare output artifacts and their paths
  - How to test a plugin using the test harness (E0.3)
  - Error handling conventions (what to throw vs. what to return)
- Inline code examples for a minimal "hello world" generator
- Reference to existing generators as real-world examples

**Acceptance Criteria**

- [x] A developer unfamiliar with Wesley internals can follow the guide and produce a working no-op generator within 30 minutes
- [x] The guide includes a working code example that can be copy-pasted and run
- [x] The guide is linked from the root README under a "For Generator Authors" section

**Scope / Out of Scope**

| In scope | Out of scope |
| --- | --- |
| Plugin authoring guide | Wesley architecture deep-dive |
| Lifecycle hook documentation | Parser internals |
| Code examples | Video tutorials |
| Link from README | Maintaining a separate docs site for this |

**Expected Complexity**

~300–500 lines of Markdown + ~100 LoC inline code examples

**Est. Human Working Hours:** 4–6h

**Test Plan**

- **Golden path:** Follow the guide end-to-end; resulting plugin compiles SDL and produces output. (Manual QA.)
- **Failure modes:** N/A (documentation).
- **Edges:** N/A.
- **Fuzz/stress:** N/A.

**Definition of Done**

- [x] `docs/guides/generator-plugins.md` exists and is linked from README
- [x] Code examples in the guide are tested (extracted into a test or verified manually)
- [x] At least one reviewer unfamiliar with Wesley can follow the guide successfully

**Blocking:** nothing directly (but enables future contributors)
**Blocked by:** E0.1, E0.2, E0.3

---

## E0.5 — `wesley doctor` Diagnostic Command

**User Story**

As a Wesley user or CI pipeline, I can run `wesley doctor` to verify that my Wesley installation is healthy — plugins resolve, config is valid, runtime versions meet requirements, and hash algorithms are available.

**Requirements**

- New CLI subcommand: `wesley doctor`
- Checks:
  - Node.js version meets `>=18.17` requirement
  - `wesley.config.mjs` is present and parses without errors
  - All declared generator packages resolve via Node module resolution
  - Each resolved plugin exports a valid `GeneratorPlugin` with a supported `apiVersion`
  - `crypto.subtle` (or Node `crypto`) is available for SHA-256 hashing
  - `experimental` flags are listed with their current values
- Output: structured checklist with pass/fail per check

  ```text
  [pass] Node.js v22.1.0 (>=18.17)
  [pass] Config: wesley.config.mjs
  [pass] Plugin: @wesley/generator-echo (apiVersion: 1)
  [pass] Plugin: @wesley/generator-ttd (apiVersion: 1)
  [fail] Plugin: @wesley/generator-foo — not found (searched: [paths])
  [pass] Hash: SHA-256 available
  [info] Experimental: irV2=true, rawLe=false, join=false
  ```

- Exit code: 0 if all checks pass, 1 if any check fails
- `--format json` flag for machine-readable output

**Acceptance Criteria**

- [x] `wesley doctor` runs and produces structured output
- [x] Missing plugins are detected and reported with search paths
- [x] Invalid config produces a clear error with line/column if possible
- [x] `--format json` produces machine-readable diagnostic output
- [x] Exit code reflects pass/fail

**Expected Complexity**

~100–200 LoC (CLI wiring + check functions + formatters)

**Est. Human Working Hours:** 3–5h

**Test Plan**

- **Golden path:** Config with valid plugins → all checks pass, exit 0.
- **Failure modes:** Missing plugin → `[fail]` line, exit 1. Invalid config → `[fail]` line, exit 1. Unsupported `apiVersion` → `[fail]` line.
- **Edges:** No config file → helpful error suggesting `wesley init`. Empty `generators` array → passes (valid config, no plugins to check).

**Definition of Done**

- [x] `wesley doctor` subcommand works
- [x] At least 5 checks implemented (node version, config, plugins, crypto, experimental flags)
- [x] JSON output format available
- [x] CLI help text documented
- [x] Integration test passes

**Blocking:** nothing
**Blocked by:** E0.1, E0.2
