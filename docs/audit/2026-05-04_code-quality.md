---
report_id: 'AUD-2026-05-04-CQ01'
title: 'Code Quality Audit: Wesley Module-First Compiler Toolchain'
status: 'Final'
audit:
  date_started: 2026-05-04
  date_completed: 2026-05-04
  type: 'Full'
  scope: 'README.md, docs/, packages/, scripts/, .github/workflows'
  compliance_frameworks: ['OWASP ASVS', 'OpenSSF Scorecard Practices']
target:
  repository: 'github.com/flyingrobots/wesley'
  branch: 'cycle/0008-holmes-counterfactual-provider-capability'
  commit_hash: 'f185446'
  language_stack:
    ['Node.js >=22', 'pnpm 9.15.9', 'ESM JavaScript', 'GraphQL', 'Commander', 'Bats', 'Vitest']
  environment: 'Local release-candidate branch'
methodology:
  automated_tools: ['rg', 'wc', 'pnpm audit --json', 'pnpm run preflight']
  manual_review_hours: 3
  false_positive_rate: '15%'
summary:
  total_findings: 12
  severity_count:
    critical: 0
    high: 3
    medium: 7
    low: 2
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'AUD-2026-04-11-CODE-QUALITY'
  tracking_ticket: 'GitHub Issues'
---

# AUDIT: CODE QUALITY (2026-05-04)

## 0. EXECUTIVE REPORT CARD (Strategic Lead View)

| **Metric**                    | **Score (1-10)** | **Recommendation**                                                                                                                                                                                                           |
| ----------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Developer Experience (DX)** | 7.0              | **Best of:** The root README now states the core value clearly: Wesley owns the compiler kernel and explicit module dispatch.                                                                                                |
| **Internal Quality (IQ)**     | 6.5              | **Watch Out For:** Runtime module loading is powerful but still too ambient, combining discovery, import execution, and capability registration behind environment/config side effects.                                      |
| **Overall Recommendation**    | **THUMBS UP**    | **Justification:** The architecture is moving in the right direction after the counterfactual-provider extraction, but release confidence depends on tightening module-loading trust, CLI/doc truth, and dependency hygiene. |

## 1. DX: ERGONOMICS & INTERFACE CLARITY (Advocate View)

- **1.1. Time-to-Value (TTV) Score (1-10):** 7
  - **Answer:** Basic compiler TTV is good: `README.md:30-49` gets a developer from install to TypeScript generation and module loading in three steps. The largest setup burden is the external-module path. A developer is told to use `WESLEY_MODULES=/path/to/my-wesley-module.mjs`, but there is no first-party command that explains which modules loaded, which capabilities they contributed, or why a module failed to appear. This matters more now that counterfactual providers are module capabilities rather than HOLMES internals.
  - **Action Prompt (TTV Improvement):** `Add a first-party module inspection command to the Wesley CLI. Implement a command such as "wesley modules list --json" that uses the existing Node module loader, reports the resolved wesley.config.mjs path, WESLEY_MODULES entries, loaded module names, disabled entries, import failures, and capability families. Include human-readable and JSON output, tests for config/env loading, and README/docs examples showing how this command reduces module setup time.`

- **1.2. Principle of Least Astonishment (POLA):**
  - **Answer:** The strongest POLA violation is documentation-facing command shape drift. `docs/GUIDE.md:35-38` tells operators to run `pnpm wesley holmes dashboard`, but the Wesley CLI command registry dynamically loads files from `packages/wesley-cli/src/commands` (`packages/wesley-cli/src/program.mjs:22-40`) and no `dashboard` command is registered under a `holmes` subcommand. Dashboard behavior exists as static workflow artifacts in `.github/workflows/wesley-holmes.yml`, not as the documented local CLI surface. A developer would expect the command in the guide to execute or to be explicitly labeled as a future/dashboard-artifact path.
  - **Action Prompt (Interface Refactoring):** `Make the HOLMES dashboard surface align with the documented command model. Either implement "pnpm wesley holmes dashboard" as a CLI command that opens or serves docs/holmes-dashboard with local JSON report inputs, or update docs/GUIDE.md and README.md to describe the actual artifact-based dashboard path. Add a CLI/help regression test or docs-truth assertion so documented commands cannot drift from the registered command list again.`

- **1.3. Error Usability:**
  - **Answer:** `findNearestWesleyConfigPath` accepts `WESLEY_CONFIG` but silently returns `null` when the explicit file does not exist (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:87-95`). The caller then falls through to env module entries (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:121-136`) and the operator gets no diagnostic that the explicit config path was ignored. A better error is: `WESLEY_CONFIG points to /path/wesley.config.mjs, but that file does not exist. Fix the path or unset WESLEY_CONFIG. See docs/design/wesley-module-contract.md#module-loading.`
  - **Action Prompt (Error Handling Fix):** `Update packages/wesley-runtime-node/src/ModuleEntryLoader.mjs so an explicit WESLEY_CONFIG path that cannot be resolved throws a typed Wesley module-loading error with the resolved path, the current cwd, and a documentation link to docs/design/wesley-module-contract.md. Add tests proving auto-discovery still returns null when no config exists, while an explicit missing WESLEY_CONFIG fails loudly.`

## 2. DX: DOCUMENTATION & EXTENDABILITY (Advocate View)

- **2.1. Documentation Gap:**
  - **Answer:** The missing high-friction document is a practical module-authoring guide. The root README points to the design-level module contract and capability contract (`README.md:89-90`), and the Holmes policy README says modules register `holmes.counterfactualProviders`, but there is no end-to-end guide that shows a small module file, config loading, command contribution, capability contribution, provider tests, and troubleshooting.
  - **Action Prompt (Documentation Creation):** `Create docs/guides/module-authoring.md as a hands-on guide for external Wesley module authors. Include a minimal module.mjs, wesley.config.mjs usage, WESLEY_MODULES usage, a capability-provider example for holmes.counterfactualProviders, CLI command contribution, expected JSON shapes, troubleshooting for missing modules, and links from README.md, docs/GUIDE.md, and docs/design/wesley-module-contract.md.`

- **2.2. Customization Score (1-10):** 7
  - **Answer:** The strongest extension point is the module capability model: the core repo now treats target behavior as externally brought, and `discoverConfiguredWesleyModules` returns entries plus discovered capabilities (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:149-164`). The weakest extension point is still ambient configuration through `WESLEY_MODULES` and dynamic imports. It is flexible, but fragile for teams because import failures, trust decisions, and disabled entries are not surfaced as a stable inspection contract.
  - **Action Prompt (Extension Improvement):** `Introduce a structured ModuleLoadReport returned by the runtime-node loader and exposed through the CLI. The report should include config source, env source, normalized specifiers, disabled entries, import status, module identity, capability families, warnings, and trust status. Keep the current module API compatible, but make module-loading diagnostics non-ambient and testable.`

## 3. INTERNAL QUALITY: ARCHITECTURE & MAINTAINABILITY (Architect View)

- **3.1. Technical Debt Hotspot:**
  - **Answer:** `packages/wesley-cli/src/commands/generate-execution.mjs` is the highest-debt module in the reviewed slice. It spans 434 lines and coordinates preconditions, IR cache resolution, unit filtering, event emission, transmutation execution, file writing, evidence bundle persistence, history merging, git SHA lookup, and dirty-worktree enforcement. Examples: command orchestration starts at `runSequentialGeneration` (`lines 41-192`), transmutation execution and source SHA lookup live in the same file (`lines 209-284`), and bundle/history persistence is also embedded there (`lines 286-331`). This is cohesive as a first implementation, but it is now the gravity well for multiple concerns.
  - **Action Prompt (Debt Reduction):** `Incrementally split packages/wesley-cli/src/commands/generate-execution.mjs without changing command behavior. Extract source/Git policy checks, transmutation execution, and evidence persistence into small internal modules with focused tests. Keep runSequentialGeneration as the orchestration facade, preserve public result shapes, and add regression coverage around --emit-bundle, --dry-run, --print-ir, --resume, and dirty-worktree policy.`

- **3.2. Abstraction Violation:**
  - **Answer:** `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs` violates separation of concerns by combining config discovery, env parsing, path normalization, file existence checks, dynamic import execution, and capability discovery in one adapter. The file is intentionally Node-specific, so Node APIs are acceptable, but the trust boundary and diagnostic model are mixed directly into loading logic (`lines 87-146`) rather than represented by a separate source-resolution/report layer.
  - **Action Prompt (SoC Refactoring):** `Refactor ModuleEntryLoader into three layers: ModuleEntrySourceResolver for wesley.config.mjs and WESLEY_MODULES discovery, ModuleImporter for import execution, and ModuleDiscoveryAdapter for @wesley/core discoverModules integration. Preserve existing exports as compatibility wrappers, but add direct unit tests for each layer and a structured load report that captures diagnostics before imports execute.`

- **3.3. Testability Barrier:**
  - **Answer:** The primary barrier is ambient process state. `program()` defaults to `process.cwd()` and `process.env` when discovering CLI modules (`packages/wesley-cli/src/program.mjs:55-62`), and the runtime loader defaults to `process.cwd()` and `process.env` as well (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:111-115`, `149-154`). Tests can inject `ctx`, env, cwd, and resolver in some paths, which is good, but production code still encourages global state and direct dynamic import as the main path.
  - **Action Prompt (Testability Improvement):** `Introduce an explicit RuntimeEnvironment object for CLI startup that contains cwd, env, importer, logger, clock, and filesystem ports. Thread it through program() and discoverConfiguredWesleyModules while keeping defaults for the real CLI binary. Update tests to instantiate RuntimeEnvironment fixtures instead of relying on process.env mutation or real dynamic import paths.`

## 4. INTERNAL QUALITY: RISK & EFFICIENCY (Auditor View)

- **4.1. The Critical Flaw:**
  - **Answer:** The highest-impact hidden risk is trusted-code execution through module loading. `loadWesleyModuleEntries` imports `wesley.config.mjs` (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:121-125`) and `importWesleyModuleSpecifier` executes arbitrary specifiers from config or `WESLEY_MODULES` (`lines 139-146`). This is probably the right power model for local modules, but the trust boundary is not explicit in CLI output, docs, or CI policy. In a production/client setting, config/env injection could execute arbitrary Node code before any capability validation.
  - **Action Prompt (Risk Mitigation):** `Add a module-loading trust boundary to runtime-node and the CLI. Document that Wesley modules are trusted code, add a --no-modules or WESLEY_DISABLE_MODULES=1 mode for CI and diagnostics, add an allowlist option for production workflows, and emit a structured warning whenever modules are loaded from env/config. Include tests proving disabled/allowlisted modes prevent imports from executing.`

- **4.2. Efficiency Sink:**
  - **Answer:** The most visible efficiency sink is the pre-push changed-file selector on non-main branch stacks. When a branch has no upstream, `scripts/pre-push-sanity.mjs` falls back to diffing against `origin/main` (`lines 176-179`). For release-targeted branches, that can select unrelated release-stack changes and run broad checks, increasing local push time and confusing review scope. The script has an explicit `--files` escape hatch (`lines 21-27`), but the branch-base heuristic is not release-aware.
  - **Action Prompt (Optimization):** `Make scripts/pre-push-sanity.mjs base-branch aware. Prefer the remote tracking branch when present, then GITHUB_BASE_REF/WESLEY_BASE_REF/release branch metadata, then origin/main. Preserve --files override, add tests for release/v0.1.0-targeted branches and first-push branches, and print the selected diff base in dry-run output.`

- **4.3. Dependency Health:**
  - **Answer:** Dependency health is currently a release risk. `pnpm audit --json` reports 2 high and 6 moderate vulnerabilities across 682 dependencies. The most urgent are `picomatch@4.0.3` ReDoS (patched in `>=4.0.4`), `postcss@8.5.6` XSS in CSS stringify output (patched in `>=8.5.10`), and `brace-expansion` zero-step sequence hang/memory exhaustion (patched in `5.0.5+` for one major line and other fixed lines depending on parent dependencies). Root package overrides already exist in `package.json:55-62`, so dependency remediation can fit the existing mechanism.
  - **Action Prompt (Dependency Update):** `Resolve the current pnpm audit findings before release. Add safe pnpm overrides or direct dependency updates for picomatch >=4.0.4, postcss >=8.5.10, and fixed brace-expansion lines compatible with eslint/minimatch/ts-morph parents. Run pnpm install, pnpm audit --json, pnpm run preflight, and targeted package tests that exercise glob/config/doc processing. Document any advisory left unresolved with rationale.`

## 5. STRATEGIC SYNTHESIS & ACTION PLAN (Strategist View)

- **5.1. Combined Health Score (1-10):**
  - **Answer:** 6.8. The codebase has a coherent module-first direction and good local verification discipline, but module loading, documentation truth, and dependency audit status are not yet at client-release quality.

- **5.2. Strategic Fix:**
  - **Answer:** Build the module-loading inspection and trust boundary. This improves DX by making `WESLEY_MODULES` and `wesley.config.mjs` explainable, and improves internal quality by separating source resolution, import execution, diagnostics, and capability discovery.

- **5.3. Mitigation Prompt:**
  - **Action Prompt (Strategic Priority):** `Implement a ModuleLoadReport-centered module-loading refactor. In @wesley/runtime-node, split config/env source resolution from import execution and capability discovery, produce structured diagnostics for missing configs/import failures/disabled modules/trust warnings, and add WESLEY_DISABLE_MODULES plus an allowlist option. In @wesley/cli, add "wesley modules list" with human-readable and JSON output. Update README.md and docs/GUIDE.md to use the new command in the module setup path. Verify with runtime-node unit tests, CLI module-loading tests, pnpm run preflight, and a docs-truth check that the documented command exists.`
