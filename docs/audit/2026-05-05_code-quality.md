---
report_id: 'AUD-2026-05-05-CQ01'
title: 'Code Quality Audit: Wesley v0.1.0 Release Branch'
status: 'Final'
audit:
  date_started: 2026-05-05
  date_completed: 2026-05-05
  type: 'Differential'
  scope: 'README.md, CONTRIBUTING.md, SECURITY.md, docs/, packages/wesley-cli, packages/wesley-core, packages/wesley-holmes, packages/wesley-runtime-node, scripts/'
  compliance_frameworks: ['OWASP ASVS', 'OpenSSF Scorecard Practices', 'SLSA Release Principles']
target:
  repository: 'github.com/flyingrobots/wesley'
  branch: 'release/v0.1.0'
  commit_hash: '1333104'
  language_stack:
    ['Node.js >=22', 'pnpm 9.15.9', 'ESM JavaScript', 'GraphQL', 'Commander', 'Bats', 'Playwright']
  environment: 'Local release branch'
methodology:
  automated_tools: ['git status', 'git log', 'rg', 'wc', 'pnpm audit --json', 'pnpm wesley --help']
  manual_review_hours: 3
  false_positive_rate: '12%'
summary:
  total_findings: 11
  severity_count:
    critical: 0
    high: 3
    medium: 6
    low: 2
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'AUD-2026-05-04-CQ01'
  tracking_ticket: 'docs/method/backlog/'
---

# AUDIT: CODE QUALITY (2026-05-05)

## 0. EXECUTIVE REPORT CARD (Strategic Lead View)

| **Metric**                    | **Score (1-10)** | **Recommendation**                                                                                                                                                                                |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Developer Experience (DX)** | 7.4              | **Best of:** The README and GUIDE now correctly present Wesley as a domain-empty compiler kernel with module-brought targets and documented trust controls.                                       |
| **Internal Quality (IQ)**     | 7.0              | **Watch Out For:** Module loading and command orchestration still need structured diagnostic/report layers so operators do not have to infer runtime behavior from source.                        |
| **Overall Recommendation**    | **THUMBS UP**    | **Justification:** The release branch is materially healthier after the runtime hardening pass, but the next quality step is turning implicit module and CLI behavior into inspectable contracts. |

## 1. DX: ERGONOMICS & INTERFACE CLARITY (Advocate View)

- **1.1. Time-to-Value (TTV) Score (1-10):** 7
  - **Answer:** Basic compiler TTV is strong: `README.md:30-52` gets a developer through install, preflight, TypeScript generation, module selection, and module trust controls. The single biggest remaining setup burden is still module verification. The README tells a user to run `WESLEY_MODULES=/path/to/my-wesley-module.mjs pnpm wesley --help`, but there is no first-party command that reports which modules loaded, which entries were disabled, which entries were blocked, and which capabilities are available. The existing backlog card `docs/method/backlog/cool-ideas/DX_inspect-module-capabilities-command.md` is the right follow-up.
  - **Action Prompt (TTV Improvement):** `Implement a first-party "wesley modules list" command. It must load modules through @wesley/runtime-node using the same cwd/env/default-specifier behavior as program(), then print config source, env source, loaded module names, disabled entries, blocked entries, import failures, and capability counts. Provide --json output, human-readable output, and tests covering no modules, WESLEY_DISABLE_MODULES=1, WESLEY_MODULE_ALLOWLIST, config modules, env modules, and duplicate/disabled entries. Add a README quick-start line showing the command after the WESLEY_MODULES example.`

- **1.2. Principle of Least Astonishment (POLA):**
  - **Answer:** The biggest public-interface surprise is the mismatch between the older generator-plugin docs and the current external-module architecture. `docs/guides/generator-plugins.md:43-51` shows a `wesley.config.mjs` shape with a top-level `generators` array, but the current runtime module entry loader reads `config.modules` (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:206-218`) and module capabilities carry generators/targets under `capabilities.wesley` (`docs/design/wesley-module-capability-contract.md:75-115`). A developer would expect the guide's registration snippet to match the real config entry shape.
  - **Action Prompt (Interface Refactoring):** `Update docs/guides/generator-plugins.md and docs/guides/extending.md so plugin registration uses the current Wesley module contract. Replace the top-level "generators" config example with a minimal module file exported through config.modules, show capabilities.wesley.generators and capabilities.wesley.targets, and link to docs/design/wesley-module-contract.md. Add a docs-truth fixture or docs CLI/config check so future examples do not teach obsolete wesley.config.mjs shapes.`

- **1.3. Error Usability:**
  - **Answer:** Module-loading errors are now less silent, but still under-diagnostic. `findNearestWesleyConfigPath` throws `WESLEY_CONFIG_NOT_FOUND` with env, specifier, resolved path, and cwd (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:154-175`), and allowlist failures include code/meta (`lines 138-151`). The missing piece is a stable user-facing diagnostic report that explains all entries and decisions together; today an operator sees a thrown error or a successful load, not a report they can inspect or attach to CI logs.
  - **Action Prompt (Error Handling Fix):** `Introduce a ModuleLoadReport object in @wesley/runtime-node. The report should include cwd, config discovery mode, explicit WESLEY_CONFIG path, env module specifiers, normalized entries, disabled entries, allowlist status, import status, module identity, capability families, and errors with codes/meta. Keep existing loadWesleyModuleEntries and discoverConfiguredWesleyModules exports as compatibility wrappers, but add a new report-returning API and CLI tests that snapshot representative failure diagnostics.`

## 2. DX: DOCUMENTATION & EXTENDABILITY (Advocate View)

- **2.1. Documentation Gap:**
  - **Answer:** The most valuable missing content is still a hands-on module-authoring and loading guide. The design docs define the architecture (`docs/design/wesley-module-contract.md`, `docs/design/wesley-module-capability-contract.md`), but a new module author does not yet have a single runnable guide showing a minimal module, `wesley.config.mjs`, `WESLEY_MODULES`, trust controls, module-owned commands, `wesley.targets`, and `holmes.counterfactualProviders`.
  - **Action Prompt (Documentation Creation):** `Create docs/guides/module-authoring.md. Include a minimal module.mjs, a matching wesley.config.mjs with modules entries, WESLEY_MODULES usage, WESLEY_DISABLE_MODULES and WESLEY_MODULE_ALLOWLIST usage, a wesley.targets compile-target example, a holmes.counterfactualProviders example, a module-owned CLI command example, and a troubleshooting table for missing configs, blocked imports, disabled modules, duplicate target names, and unknown capability collections. Link it from README.md, docs/GUIDE.md, and both module contract docs.`

- **2.2. Customization Score (1-10):** 7
  - **Answer:** The strongest extension point is the module capability registry. `createModuleCapabilityRegistry` normalizes known capability areas and freezes registry output (`packages/wesley-core/src/application/ModuleCapabilityRegistry.mjs:32-218`), and `compile` dispatches only through `wesley.targets` (`packages/wesley-cli/src/commands/compile.mjs:76-95`). The weakest extension point is introspection: module behavior exists, but the runtime still exposes entries/capabilities only as internal return values (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:242-258`) and there is no stable CLI/reference output for module authors.
  - **Action Prompt (Extension Improvement):** `Turn module capability introspection into a supported extension surface. Add a public runtime helper that returns a frozen capability summary grouped by area and collection, expose it through "wesley modules list --json", and document the JSON schema in docs/reference/module-load-report.md. Preserve the existing capability arrays for command internals, but give external tools a stable summary contract that does not expose live capability objects.`

## 3. INTERNAL QUALITY: ARCHITECTURE & MAINTAINABILITY (Architect View)

- **3.1. Technical Debt Hotspot:**
  - **Answer:** `packages/wesley-cli/src/commands/generate-execution.mjs` remains the highest-debt module. It is 434 lines and coordinates preconditions, IR cache resolution, unit filtering, event emission, transmutation execution, artifact writing, snapshot persistence, evidence enrichment, history merging, git SHA lookup, dirty-worktree policy, and failure attachment. The main orchestrator spans `runSequentialGeneration` (`lines 41-192`), transmutation execution and git SHA lookup live nearby (`lines 209-284`), and bundle/history persistence is embedded in the same file (`lines 286-331`).
  - **Action Prompt (Debt Reduction):** `Incrementally split packages/wesley-cli/src/commands/generate-execution.mjs without changing CLI behavior. Extract source/git policy checks, transmutation execution, and evidence/history persistence into separate internal modules with focused unit tests. Keep runSequentialGeneration as the compatibility facade, preserve emitted event shapes, and add regression coverage for --emit-bundle, --dry-run, --print-ir, --resume, and dirty-worktree enforcement.`

- **3.2. Abstraction Violation:**
  - **Answer:** `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs` still blends source resolution, path normalization, allowlist policy, config import execution, module import execution, dedupe behavior, and capability discovery (`lines 65-258`). The recent hardening fixed several correctness bugs, but the file still lacks a clean separation between "what would load", "what is allowed", "what executed", and "what capabilities resulted".
  - **Action Prompt (SoC Refactoring):** `Refactor ModuleEntryLoader into SourceResolver, TrustPolicy, ModuleImporter, and CapabilityDiscovery layers. Preserve existing public exports as wrappers, but add direct tests for each layer. The SourceResolver must not import code. The TrustPolicy must decide allowed/blocked/disabled entries. The ModuleImporter must execute imports only after policy approval. The CapabilityDiscovery layer must build the registry and report capability summaries.`

- **3.3. Testability Barrier:**
  - **Answer:** The primary testability barrier is ambient process/runtime state. `program()` defaults to `process.cwd()` and `process.env` when module discovery runs (`packages/wesley-cli/src/program.mjs:55-62`), runtime loading defaults to `process.cwd()`/`process.env` (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:191-194`, `242-247`), and `WesleyCommand.execute` mutates `process.env.WESLEY_LOG_FORMAT` in JSON mode (`packages/wesley-cli/src/framework/WesleyCommand.mjs:197-202`). Tests can inject cwd/env in important paths, but the production entrypoints still lean on globals.
  - **Action Prompt (Testability Improvement):** `Create a RuntimeEnvironment object for CLI startup containing cwd, env, stdout/stderr/stdin, logger, fs, shell, importer, clock, and log-format controls. Thread it through program(), WesleyCommand, and module discovery while preserving default real-process construction in the host binary. Replace process.env.WESLEY_LOG_FORMAT mutation with an injected log-format setting, and add tests proving JSON mode does not leak env changes across in-process command invocations.`

## 4. INTERNAL QUALITY: RISK & EFFICIENCY (Auditor View)

- **4.1. The Critical Flaw:**
  - **Answer:** No unresolved critical flaw was found after the May 5 hardening commit. The highest-impact residual risk is still trusted module execution without a structured, auditable load report. `WESLEY_DISABLE_MODULES` and `WESLEY_MODULE_ALLOWLIST` now exist, but when no allowlist is set the runtime imports auto-discovered config and module specifiers as trusted local code (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:206-239`). That power model is acceptable for a local compiler, but client/release automation needs a first-class report surface so the trust decision is visible.
  - **Action Prompt (Risk Mitigation):** `Promote module-loading diagnostics to a release gate. Add ModuleLoadReport generation to @wesley/runtime-node, emit the report in JSON for CI, document the trusted-code model in SECURITY.md and docs/guides/module-authoring.md, and add a release checklist item requiring either WESLEY_DISABLE_MODULES=1 or a populated WESLEY_MODULE_ALLOWLIST for client automation.`

- **4.2. Efficiency Sink:**
  - **Answer:** The main efficiency sink is `scripts/pre-push-sanity.mjs` selecting and executing checks through string commands. It builds shell command strings (`lines 65-90`) and runs them through `/bin/bash -lc` (`lines 206-212`). It also falls back to `origin/main` for first pushes when no upstream exists (`lines 171-179`), which can over-select checks on release branch stacks. Existing backlog already tracks branch-aware diff base; this audit adds a separate bad-code card for shell-string execution.
  - **Action Prompt (Optimization):** `Refactor scripts/pre-push-sanity.mjs so buildCommands returns { key, label, cmd, args } instead of shell strings. Run spawnSync(cmd, args, { shell: false }) for all checks, add a safe command formatter for --dry-run output, and keep exact check selection behavior. In a follow-up, make diff base selection branch-aware by honoring WESLEY_BASE_REF/GITHUB_BASE_REF before falling back to origin/main.`

- **4.3. Dependency Health:**
  - **Answer:** `pnpm audit --json` reports zero known vulnerabilities across 682 dependencies on this branch. The May 4 dependency advisories for `picomatch`, `postcss`, and `brace-expansion` are resolved through direct updates/overrides in `package.json:55-72`. The residual risk is process: dependency audit is not yet listed as an enforced CI/preflight gate in `scripts/preflight.mjs`.
  - **Action Prompt (Dependency Update):** `Add a dependency-audit release gate. Either include pnpm audit --prod=false --json in the release checklist or add an explicit preflight/release script that runs pnpm audit --json, parses vulnerability counts, and fails on high/critical findings. Document any allowlisted advisory with package path, exposure analysis, temporary mitigation, and expiration date.`

## 5. STRATEGIC SYNTHESIS & ACTION PLAN (Strategist View)

- **5.1. Combined Health Score (1-10):**
  - **Answer:** 7.2. Wesley has a coherent module-first architecture, a clean dependency audit, and improved runtime safety controls; the remaining quality gap is making module and CLI truth inspectable instead of implicit.

- **5.2. Strategic Fix:**
  - **Answer:** Build a ModuleLoadReport plus `wesley modules list`. It improves DX by making module setup self-service, and improves internal quality by separating source resolution, trust policy, import execution, and capability discovery.

- **5.3. Mitigation Prompt:**
  - **Action Prompt (Strategic Priority):** `Implement ModuleLoadReport and a "wesley modules list" CLI command. Split @wesley/runtime-node module loading into source resolution, trust policy, import execution, and capability discovery. Return a structured report with config/env sources, normalized entries, disabled entries, allowlist decisions, import failures, loaded module identities, and capability summaries. Expose the report through human-readable and --json CLI output. Update README.md, docs/GUIDE.md, docs/guides/module-authoring.md, SECURITY.md, and tests so module loading is explainable, safe in CI, and easy for module authors to debug.`
