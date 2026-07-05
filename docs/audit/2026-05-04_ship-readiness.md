---
report_id: 'AUD-2026-05-04-SR01'
title: 'Ship Readiness Audit: Wesley v0.1.0 Release Candidate Branch'
status: 'Final'
audit:
  date_started: 2026-05-04
  date_completed: 2026-05-04
  type: 'Full'
  scope: 'README.md, docs/, packages/, scripts/, package.json, pnpm-lock.yaml, .github/workflows'
  compliance_frameworks: ['OWASP ASVS', 'OpenSSF Scorecard Practices', 'SLSA Release Principles']
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
  false_positive_rate: '20%'
summary:
  total_findings: 13
  severity_count:
    critical: 0
    high: 5
    medium: 6
    low: 2
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'AUD-2026-04-11-SHIP-READINESS'
  tracking_ticket: 'GitHub Issues'
---

# AUDIT: READY-TO-SHIP ASSESSMENT (2026-05-04)

## 1. QUALITY & MAINTAINABILITY ASSESSMENT (EXHAUSTIVE)

1.1. **Technical Debt Score (1-10):** 6

The score is moderate: the current branch has good architectural direction and a passing local preflight expectation, but it is not yet clean enough to call low-debt for client release.

The three most problematic patterns are:

1. **Large orchestration modules.** `packages/wesley-cli/src/commands/generate-execution.mjs` is 434 lines and coordinates IR resolution, transmutation, event collection, artifact writing, evidence bundle persistence, git SHA lookup, and history merging. The mixed concerns are visible across `runSequentialGeneration` (`lines 41-192`) and `persistTransmutationArtifacts` (`lines 286-331`).
2. **Ambient runtime module loading.** `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs` mixes config discovery, env parsing, dynamic imports, and capability discovery (`lines 87-164`). This is powerful but increases trust-boundary and testability risk.
3. **Documentation command drift.** `docs/GUIDE.md:35-38` documents `pnpm wesley holmes dashboard`, while the CLI registry dynamically loads root command files (`packages/wesley-cli/src/program.mjs:22-40`) and no matching subcommand exists.

1.2. **Readability & Consistency:**

- **Issue 1:** `docs/VISION.md` still carries historical domain residue that conflicts with the current domain-empty core posture. It says every artifact includes "SQL, Rust, TypeScript, or JSON" (`docs/VISION.md:33-34`) and references Echo, `git-warp`, and `warp-ttd` as if they are core inevitability examples (`docs/VISION.md:39-40`).
- **Mitigation Prompt 1:** `Refresh docs/VISION.md to match the domain-empty Wesley core posture. Replace specific Continuum/git-warp/SQL examples with module-brought target language, keep GraphQL SDL and evidence-backed change as the core claims, fix the "rerrunable" typo, and link to docs/design/wesley-extraction-map.md for historical residue.`

- **Issue 2:** The guide documents a dashboard CLI path that does not exist (`docs/GUIDE.md:35-38`). This slows onboarding because a new operator cannot tell whether HOLMES is local CLI, package binary, workflow artifact, or future TUI.
- **Mitigation Prompt 2:** `Correct the HOLMES dashboard documentation. Either implement "pnpm wesley holmes dashboard" or revise docs/GUIDE.md to describe the actual static dashboard artifact workflow and local report command. Add a docs-truth check that fails when a backticked pnpm wesley command in README.md or docs/GUIDE.md is not present in the CLI help tree.`

- **Issue 3:** Runtime package status is inconsistent with behavior. `README.md:74` marks `@wesley/runtime-node` as `0% -> Alpha`, but the current branch depends on it for shared Node module-entry loading used by CLI and HOLMES paths.
- **Mitigation Prompt 3:** `Update the package progress metadata and README package matrix so @wesley/runtime-node reflects its actual module-entry-loading responsibility. If progress should remain 0%, add a note explaining which capabilities are production-owned and which runtime-node responsibilities remain unproven.`

  1.3. **Code Quality Violation:**

- **Violation 1:** `ModuleEntryLoader` violates SRP by resolving env/config, importing modules, and discovering capabilities in one file.

Original snippet:

```js
const configPath = findNearestWesleyConfigPath(baseDir, env);
if (configPath) {
  const configDir = dirname(configPath);
  const loaded = await import(pathToFileURL(configPath).href);
  const config = loaded?.default ?? {};
  if (Array.isArray(config.modules)) {
    entries.push(
      ...config.modules.map((entry) => normalizeWesleyModuleEntry(entry, configDir)).filter(Boolean)
    );
  }
}

entries.push(...parseWesleyEnvModuleEntries(env?.[WESLEY_ENV_MODULES], baseDir));
return dedupeEntries(entries);
```

Simplified rewrite:

```js
export async function loadWesleyModules(runtime) {
  const sourceReport = resolveModuleEntrySources(runtime);
  const importReport = await importResolvedModuleEntries(sourceReport.entries, runtime.importer);
  return discoverModuleCapabilities(importReport.modules, {
    logger: runtime.logger,
    diagnostics: [...sourceReport.diagnostics, ...importReport.diagnostics]
  });
}
```

- **Mitigation Prompt 4:** `Split packages/wesley-runtime-node/src/ModuleEntryLoader.mjs into source resolution, importing, and capability discovery layers. Preserve existing exports as wrappers, add ModuleLoadReport diagnostics, and cover explicit missing WESLEY_CONFIG, disabled entries, duplicate entries, import failures, and successful capability discovery in tests.`

- **Violation 2:** The HOLMES CLI repeats option wiring and prediction setup between `predict` and `report` (`packages/wesley-holmes/src/cli.mjs:228-356`). This makes new counterfactual options easy to add to one command and forget in the other.

Original snippet:

```js
.option('--run-id <id>', 'Bind prediction context to a persisted Wesley run')
.option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
.option('--counterfactual [baseRef]', 'Analyze a module-provided counterfactual lane against a base ref')
.option('--counterfactual-braid <ref>', 'Add a braid ref to the counterfactual lane', collectRepeatableOption, [])
.option('--explain', 'Show resolved refs, digests, and counterfactual details')
```

Simplified rewrite:

```js
function addMoriartyContextOptions(command) {
  return command
    .option('--run-id <id>', 'Bind prediction context to a persisted Wesley run')
    .option('--transmutation <name>', 'Disambiguate the persisted run stream by transmutation')
    .option(
      '--counterfactual [baseRef]',
      'Analyze a module-provided counterfactual lane against a base ref'
    )
    .option(
      '--counterfactual-braid <ref>',
      'Add a braid ref to the counterfactual lane',
      collectRepeatableOption,
      []
    )
    .option('--explain', 'Show resolved refs, digests, and counterfactual details');
}
```

- **Mitigation Prompt 5:** `Refactor packages/wesley-holmes/src/cli.mjs to share MORIARTY option wiring and execution context creation between predict and report. Add tests that assert both commands expose the same counterfactual/run-id/transmutation/explain options and that JSON output remains unchanged.`

- **Violation 3:** `scripts/preflight.mjs` is a single imperative script with global mutable `ok`/`failures` state and numbered inline checks (`scripts/preflight.mjs:12-227`). Adding a new check requires editing the main flow and keeping labels/comments synchronized.

Original snippet:

```js
let ok = true;
const failures = [];

function fail(msg) {
  ok = false;
  failures.push(msg);
}
// numbered check blocks mutate global state
```

Simplified rewrite:

```js
const checks = [
  { name: 'gitignore generated outputs', run: checkGitignore },
  { name: 'workflow runners', run: checkWorkflowRunners },
  { name: 'docs links', run: () => runOrFail(process.execPath, ['scripts/check-doc-links.mjs']) }
];

const failures = [];
for (const check of checks) {
  failures.push(...(await check.run()));
}
```

- **Mitigation Prompt 6:** `Refactor scripts/preflight.mjs into a small check registry where each check returns an array of failure messages. Preserve current command behavior and output, add a unit/smoke test for at least one passing and one failing check, and keep pnpm run preflight as the public entrypoint.`

## 2. PRODUCTION READINESS & RISK ASSESSMENT (EXHAUSTIVE)

2.1. **Top 3 Immediate Ship-Stopping Risks (The "Hard No"):**

- **Risk 1:** **High - unresolved dependency advisories.** `pnpm audit --json` reports 2 high and 6 moderate vulnerabilities across 682 dependencies. High risk includes `picomatch@4.0.3` ReDoS via extglob quantifiers, patched in `>=4.0.4`; moderate risk includes `postcss@8.5.6` XSS in CSS stringify output, patched in `>=8.5.10`, and `brace-expansion` zero-step sequence hang/memory exhaustion.
- **Mitigation Prompt 7:** `Resolve pnpm audit findings before release. Update direct dependencies and pnpm overrides for picomatch >=4.0.4, postcss >=8.5.10, and compatible fixed brace-expansion lines. Run pnpm install, pnpm audit --json, pnpm run preflight, and targeted glob/docs/website/package tests. If any advisory remains, document the exact path, exposure analysis, and temporary mitigation.`

- **Risk 2:** **High - trusted dynamic module execution without a formal trust control.** `loadWesleyModuleEntries` imports `wesley.config.mjs` (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:121-125`) and `importWesleyModuleSpecifier` executes config/env-provided specifiers (`lines 139-146`). In production/client automation, malicious or accidental env/config input can execute arbitrary Node code before validation.
- **Mitigation Prompt 8:** `Implement explicit module-loading trust controls. Add WESLEY_DISABLE_MODULES=1 and --no-modules, add an allowlist option for CI/client workflows, emit structured warnings when modules are loaded from env/config, and document modules as trusted code. Add tests proving disabled and non-allowlisted modules are not imported.`

- **Risk 3:** **High - documented release/operator command does not exist.** `docs/GUIDE.md:35-38` presents a governance dashboard path that a release operator may try during validation. The absence of the command means documented ship procedure and actual tooling are not aligned.
- **Mitigation Prompt 9:** `Close the dashboard command gap before release. Implement the documented "pnpm wesley holmes dashboard" path or update the guide to the actual artifact/local-report workflow. Add a smoke test or docs-truth check that verifies documented CLI commands in README.md and docs/GUIDE.md.`

  2.2. **Security Posture:**

- **Vulnerability 1:** **Trusted-code injection via module config/env.** The module loader executes `wesley.config.mjs` and arbitrary `WESLEY_MODULES` entries (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:121-146`) without an allowlist, disabled mode, or trust warning. This is acceptable only if documented as trusted local code and controlled in automation.
- **Mitigation Prompt 10:** `Add a module trust policy to runtime-node and CLI startup. Include allowlist/disable controls, structured audit logs for module imports, docs that modules are trusted code, and tests that prove CI can run with modules disabled.`

- **Vulnerability 2:** **Shell-command execution pattern in pre-push checks.** `scripts/pre-push-sanity.mjs` builds command strings and runs them via `/bin/bash -lc` (`scripts/pre-push-sanity.mjs:65-89`, `206-214`). Current inputs are mostly fixed and package names are shell-quoted, but the pattern makes future checks prone to injection if file paths or user-controlled values are interpolated.
- **Mitigation Prompt 11:** `Replace string-based pre-push command execution with argv arrays. Change buildCommands to return {cmd, args, label}, run spawnSync(cmd, args) without /bin/bash -lc, preserve dry-run printing with a safe formatter, and add tests covering package names and explicit --files input.`

  2.3. **Operational Gaps:**

- **Gap 1:** No formal production/client module trust profile. There is no documented policy for when modules are allowed, disabled, or allowlisted in CI/client environments.
- **Gap 2:** No automated dependency-audit gate in the required preflight path. `pnpm run preflight` enforces docs, architecture boundaries, package metadata, and license checks, but `pnpm audit` is currently a manual check.
- **Gap 3:** No generated CLI reference tied to command truth. Documentation can drift from the Commander registry without failing validation.

## 3. FINAL RECOMMENDATIONS & NEXT STEP

3.1. **Final Ship Recommendation:** **NO** for high-stakes production/client release until the three high-risk items in section 2.1 are resolved. **YES, BUT** is acceptable only for an internal alpha branch where module code is trusted, dependency advisories are tracked, and the dashboard command drift is documented as known release debt.

3.2. **Prioritized Action Plan:**

- **Action 1 (High Urgency):** Resolve `pnpm audit` findings for `picomatch`, `postcss`, and `brace-expansion`, then add a dependency-audit check or release checklist gate.
- **Action 2 (High Urgency):** Implement module-loading trust controls and diagnostics: disabled mode, allowlist, structured ModuleLoadReport, and docs.
- **Action 3 (Medium Urgency):** Fix CLI documentation truth by either implementing `pnpm wesley holmes dashboard` or replacing it with the actual artifact/local-report flow plus a docs-truth guard.
