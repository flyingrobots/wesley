---
report_id: "AUD-2026-05-05-SR01"
title: "Ship Readiness Audit: Wesley v0.1.0 Release Branch"
status: "Final"
audit:
  date_started: 2026-05-05
  date_completed: 2026-05-05
  type: "Differential"
  scope: "README.md, CONTRIBUTING.md, SECURITY.md, docs/, packages/, scripts/, package.json, pnpm-lock.yaml, .github/workflows"
  compliance_frameworks: ["OWASP ASVS", "OpenSSF Scorecard Practices", "SLSA Release Principles"]
target:
  repository: "github.com/flyingrobots/wesley"
  branch: "release/v0.1.0"
  commit_hash: "1333104"
  language_stack: ["Node.js >=22", "pnpm 9.15.9", "ESM JavaScript", "GraphQL", "Commander", "Bats", "Playwright"]
  environment: "Local release branch"
methodology:
  automated_tools: ["git status", "git log", "rg", "wc", "pnpm audit --json", "pnpm wesley --help"]
  manual_review_hours: 4
  false_positive_rate: "15%"
summary:
  total_findings: 17
  severity_count:
    critical: 0
    high: 4
    medium: 10
    low: 3
  remediation_status: "Pending"
related_reports:
  previous_audit: "AUD-2026-05-04-SR01"
  tracking_ticket: "docs/method/backlog/"
---

# AUDIT: READY-TO-SHIP ASSESSMENT (2026-05-05)

## 1. QUALITY & MAINTAINABILITY ASSESSMENT (EXHAUSTIVE)

1.1. **Technical Debt Score (1-10):** 5

The score is improved from the previous audit. Dependency advisories are clear, documented CLI command drift is guarded, and module-loading correctness was hardened. The branch is now plausible for an internal v0.1.0 release, but not yet polished enough for a high-stakes external client release without caveats.

The three most problematic patterns are:

1. **Large orchestration modules.** `packages/wesley-cli/src/commands/generate-execution.mjs` is 434 lines and coordinates IR resolution, event emission, transmutation, artifact writing, bundle persistence, history persistence, git SHA lookup, and dirty-worktree policy (`lines 41-331`).
2. **Module loading without an auditable report surface.** `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs` now has disable and allowlist controls, but source resolution, trust policy, import execution, and capability discovery are still combined in one runtime adapter (`lines 65-258`).
3. **Root governance docs lag architecture.** `CONTRIBUTING.md:3-37` and `SECURITY.md:12-65` still describe the old database-change posture while README/ARCHITECTURE describe domain-empty Wesley.

1.2. **Readability & Consistency:**

- **Issue 1:** `CONTRIBUTING.md` conflicts with the current identity. It states Wesley is for planning/rehearsing/certifying database change (`CONTRIBUTING.md:3-5`) and repeats that product doctrine under `CONTRIBUTING.md:22-37`, while `README.md:8-12` says database semantics belong outside this repo.
- **Mitigation Prompt 1:** `Rewrite CONTRIBUTING.md to match the current domain-empty Wesley posture. Replace the database-change product doctrine with the module-first compiler-and-assurance doctrine from README.md and docs/ARCHITECTURE.md, keep METHOD workflow guidance, preserve the development commands, and add a short "Where domain behavior belongs" section that points database/product features to external modules.`

- **Issue 2:** `SECURITY.md` is materially stale. It focuses on generated SQL, Supabase Auth functions, RLS, bcrypt, and migration risk (`SECURITY.md:35-65`) even though those are now module/domain responsibilities rather than generic Wesley guarantees.
- **Mitigation Prompt 2:** `Rewrite SECURITY.md around Wesley's actual generic threat model. Keep supported versions and reporting policy, but replace generated-SQL-specific claims with sections for trusted module code, WESLEY_DISABLE_MODULES, WESLEY_MODULE_ALLOWLIST, dependency audit posture, evidence integrity, generated artifact review, and external module responsibility for database-specific security controls.`

- **Issue 3:** `docs/guides/generator-plugins.md` teaches an obsolete config shape. It tells users to register plugins under a top-level `generators` array (`docs/guides/generator-plugins.md:43-51`), while current loading expects `config.modules` and capabilities supplied by loaded modules.
- **Mitigation Prompt 3:** `Update docs/guides/generator-plugins.md to use the current module contract. Show a minimal module that exports capabilities.wesley.generators or capabilities.wesley.targets, show wesley.config.mjs with modules: [{ specifier: './my-plugin.mjs' }], and include a test command that proves the module-loaded capability is visible.`

1.3. **Code Quality Violation:**

- **Violation 1:** `ModuleEntryLoader` still performs source discovery, trust policy, import execution, dedupe, and capability discovery in one adapter.

Original code excerpt:

```js
const configPath = findNearestWesleyConfigPath(baseDir, env);
if (configPath) {
  assertModuleAllowlisted(configPath, allowlist, 'config');
  const configDir = dirname(configPath);
  const loaded = await import(pathToFileURL(configPath).href);
  const config = loaded?.default ?? {};
  if (Array.isArray(config.modules)) {
    entries.push(...config.modules.map((entry) => normalizeWesleyModuleEntry(entry, configDir)).filter(Boolean));
  }
}
```

Simplified rewrite:

```js
export async function loadWesleyModuleReport(runtime) {
  const sources = resolveModuleEntrySources(runtime);
  const decisions = applyModuleTrustPolicy(sources.entries, runtime.trust);
  const imports = await importAllowedModules(decisions.allowed, runtime.importer);
  const registry = createCapabilityRegistry(imports.modules);
  return buildModuleLoadReport({ sources, decisions, imports, registry });
}
```

- **Mitigation Prompt 4:** `Split packages/wesley-runtime-node/src/ModuleEntryLoader.mjs into source resolution, trust policy, importing, and capability report construction. Preserve current exports as wrappers, add a ModuleLoadReport API, and cover explicit missing WESLEY_CONFIG, allowlist blocks, disabled entries, file:// paths, duplicate entries, successful imports, and capability summaries with unit tests.`

- **Violation 2:** `packages/wesley-holmes/src/cli.mjs` repeats MORIARTY option wiring and context mapping between `predict` and `report` (`lines 228-356`), making counterfactual/run-context changes easy to apply inconsistently.

Original code excerpt:

```js
.option('--run-id <id>', 'Bind prediction context to a persisted Wesley run')
.option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
.option('--counterfactual [baseRef]', 'Analyze a module-provided counterfactual lane against a base ref')
.option('--counterfactual-braid <ref>', 'Add a braid ref to the counterfactual lane', collectRepeatableOption, [])
.option('--explain', 'Show resolved refs, digests, and counterfactual details')
```

Simplified rewrite:

```js
function addMoriartyContextOptions(command, runIdDescription) {
  return command
    .option('--run-id <id>', runIdDescription)
    .option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
    .option('--counterfactual [baseRef]', 'Analyze a module-provided counterfactual lane against a base ref')
    .option('--counterfactual-braid <ref>', 'Add a braid ref to the counterfactual lane', collectRepeatableOption, [])
    .option('--explain', 'Show resolved refs, digests, and counterfactual details');
}
```

- **Mitigation Prompt 5:** `Refactor packages/wesley-holmes/src/cli.mjs to share MORIARTY option wiring and context extraction between predict and report. Add tests that both commands expose run-id, transmutation, counterfactual, counterfactual-braid, and explain options and that JSON output remains backward compatible.`

- **Violation 3:** `scripts/preflight.mjs` uses global mutable `ok` and `failures` state plus numbered inline checks (`scripts/preflight.mjs:12-231`). This makes new checks easy to add inconsistently and hard to test independently.

Original code excerpt:

```js
let ok = true;
const failures = [];

function fail(msg) { ok = false; failures.push(msg); }
```

Simplified rewrite:

```js
const checks = [
  { name: 'gitignore', run: checkGitignore },
  { name: 'docs links', run: () => runProcess(process.execPath, ['scripts/check-doc-links.mjs']) },
  { name: 'dependency boundaries', run: checkDependencyCruiser }
];

const failures = [];
for (const check of checks) {
  failures.push(...await check.run());
}
```

- **Mitigation Prompt 6:** `Refactor scripts/preflight.mjs into a registry of named checks where each check returns failure messages instead of mutating global state. Preserve the public "pnpm run preflight" behavior and output, add smoke tests for one passing and one failing check, and keep docs link, docs truth, docs CLI command, dependency-cruiser, core purity, license, progress, and whitespace checks intact.`

## 2. PRODUCTION READINESS & RISK ASSESSMENT (EXHAUSTIVE)

2.1. **Top 3 Immediate Ship-Stopping Risks (The "Hard No"):**

- **Risk 1:** **High - stale security and contributor docs can mislead external users.** `CONTRIBUTING.md:3-37` and `SECURITY.md:12-65` still describe database-change and generated-SQL security posture that the current domain-empty release branch explicitly moved out to modules.
- **Mitigation Prompt 7:** `Before external v0.1.0 release, update CONTRIBUTING.md and SECURITY.md to match the current module-first compiler kernel. Remove generic Wesley promises about generated SQL, Supabase Auth, RLS, bcrypt, and database migration controls. Replace them with accurate module trust, dependency audit, evidence integrity, generated artifact review, and external-module responsibility language. Run pnpm run preflight and docs link/truth checks.`

- **Risk 2:** **High - module execution policy is controlled but not auditable as a release artifact.** `WESLEY_DISABLE_MODULES` and `WESLEY_MODULE_ALLOWLIST` exist, but there is no ModuleLoadReport or required release evidence showing which modules were loaded or blocked (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:191-258`).
- **Mitigation Prompt 8:** `Add ModuleLoadReport evidence to release workflows. Generate a JSON report for module loading that records cwd, config path, env specifiers, allowlist entries, disabled entries, blocked entries, imported modules, and capability families. Store it as a CI artifact for release runs, and require either WESLEY_DISABLE_MODULES=1 or WESLEY_MODULE_ALLOWLIST to be set for client-facing automation.`

- **Risk 3:** **High - pre-push command execution uses shell strings.** `scripts/pre-push-sanity.mjs` builds string commands (`lines 65-90`) and executes them with `/bin/bash -lc` (`lines 206-212`). The current interpolation is narrow and shell-quoted, but the pattern is a sharp edge for future file/path-driven checks.
- **Mitigation Prompt 9:** `Replace shell-string command execution in scripts/pre-push-sanity.mjs with argv-based spawnSync calls. Make buildCommands return { key, label, cmd, args }, preserve dry-run output with a safe formatter, remove shellQuote from package command construction, and add tests covering package names, repo checks, and explicit --files input.`

2.2. **Security Posture:**

- **Vulnerability 1:** **Trusted-code execution through module config/env remains a primary threat model.** Module loading can import auto-discovered `wesley.config.mjs` and allowed module specifiers (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:206-239`). This is expected local compiler behavior, but it needs accurate `SECURITY.md` language and CI report artifacts.
- **Mitigation Prompt 10:** `Document and operationalize Wesley's module trust model. Update SECURITY.md, README.md, and module-authoring docs to state that modules are trusted Node code; require WESLEY_DISABLE_MODULES=1 or WESLEY_MODULE_ALLOWLIST for client automation; add structured import audit logs; and add tests proving blocked modules are not imported.`

- **Vulnerability 2:** **Shell-command execution pattern in pre-push checks.** The pre-push hook uses `/bin/bash -lc` (`scripts/pre-push-sanity.mjs:206-212`) for commands assembled earlier in the script. This is not an active exploit in the reviewed paths, but it is a preventable injection class.
- **Mitigation Prompt 11:** `Convert pre-push checks to direct argv execution. Avoid /bin/bash -lc, represent every check as cmd + args, and include a safe pretty-printer for dry-run output. Add regression tests proving explicit file lists cannot alter command argv.`

2.3. **Operational Gaps:**

- **Gap 1:** No module-load report artifact exists for release runs, so trust policy decisions are not inspectable after the fact.
- **Gap 2:** Dependency audit is clean today, but `pnpm audit --json` is not yet a documented release gate in preflight or the release runbook.
- **Gap 3:** No generated CLI reference is linked from the public docs, so command truth still depends on live help output and the docs command checker rather than a reader-friendly reference.

## 3. FINAL RECOMMENDATIONS & NEXT STEP

3.1. **Final Ship Recommendation:** **YES, BUT...** ship as an internal v0.1.0 release branch after documenting the remaining caveats. For external/client release, first fix stale root security/contributor docs, add module-load report evidence, and remove shell-string pre-push execution.

3.2. **Prioritized Action Plan:**

- **Action 1 (High Urgency):** Rewrite `CONTRIBUTING.md` and `SECURITY.md` to match the domain-empty module-first release posture.
- **Action 2 (High Urgency):** Add ModuleLoadReport and a `wesley modules list --json` surface, then attach that report to release workflow evidence.
- **Action 3 (Medium Urgency):** Refactor `scripts/pre-push-sanity.mjs` to argv-based command execution and branch-aware diff-base selection.
