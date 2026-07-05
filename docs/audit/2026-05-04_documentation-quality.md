---
report_id: 'AUD-2026-05-04-DQ01'
title: 'Documentation Quality Audit: Wesley Module-First Onboarding'
status: 'Final'
audit:
  date_started: 2026-05-04
  date_completed: 2026-05-04
  type: 'Full'
  scope: 'README.md, docs/GUIDE.md, docs/ARCHITECTURE.md, docs/VISION.md, docs/design/, docs/guides/'
  compliance_frameworks: ['OpenSSF Best Practices', 'Diataxis Documentation System']
target:
  repository: 'github.com/flyingrobots/wesley'
  branch: 'cycle/0008-holmes-counterfactual-provider-capability'
  commit_hash: 'f185446'
  language_stack: ['Node.js >=22', 'pnpm 9.15.9', 'ESM JavaScript', 'Markdown']
  environment: 'Local release-candidate branch'
methodology:
  automated_tools:
    ['rg', 'docs link check via pnpm run preflight', 'docs truth check via pnpm run preflight']
  manual_review_hours: 2
  false_positive_rate: '10%'
summary:
  total_findings: 7
  severity_count:
    critical: 0
    high: 1
    medium: 4
    low: 2
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'AUD-2026-04-11-DOCUMENTATION-QUALITY'
  tracking_ticket: 'GitHub Issues'
---

# AUDIT: DOCUMENTATION QUALITY (2026-05-04)

## 1. ACCURACY & EFFECTIVENESS ASSESSMENT

- **1.1. Core Mismatch:**
  - **Answer:** The root `README.md` is substantially more accurate than the previous audit generation: it now frames Wesley as a schema-first compiler kernel and explicitly says Continuum/PostgreSQL are extraction debt (`README.md:4-12`, `51-53`). The most critical current mismatch in the top-level documentation set is command truth, specifically `docs/GUIDE.md:35-38`, which advertises `pnpm wesley holmes dashboard`. The registered root CLI discovers command files from `packages/wesley-cli/src/commands` (`packages/wesley-cli/src/program.mjs:22-40`), and there is no registered `holmes dashboard` command. The actual dashboard surface appears to be a static workflow artifact path (`.github/workflows/wesley-holmes.yml` references `docs/holmes-dashboard`) rather than a local CLI command.

- **1.2. Audience & Goal Alignment:**
  - **Answer:** The primary audience is platform engineers and module authors evaluating or contributing to a schema-first compiler plus assurance toolchain.
  - **Top question 1, "What is Wesley?":** Mostly yes. `README.md:4-12` and `docs/GUIDE.md:40-68` clearly separate the compiler kernel from external modules and surrounding toolchain surfaces.
  - **Top question 2, "How do I run it locally?":** Mostly yes. `README.md:30-49` provides install, preflight, TypeScript generation, and module loading examples. It lacks a troubleshooting path for module-loading failures.
  - **Top question 3, "How do I extend it safely?":** Partially. README links to design-level contracts (`README.md:89-90`), but the docs do not yet provide a practical module authoring guide with runnable examples, capability registration, tests, and failure diagnostics.

- **1.3. Time-to-Value (TTV) Barrier:**
  - **Answer:** The largest documentation bottleneck is the gap between "set `WESLEY_MODULES`" and "know what happened." `README.md:45-49` and `docs/GUIDE.md:21-28` tell developers how modules are selected, but do not explain how to confirm that a module loaded, what capabilities it contributed, how disabled entries behave, or what to do when an explicit `WESLEY_CONFIG` path is wrong. This is now central because `holmes.counterfactualProviders` are supplied by modules.

## 2. REQUIRED UPDATES & COMPLETENESS CHECK

- **2.1. README.md Priority Fixes:**
  1. Add a "Verify Loaded Modules" step after the `WESLEY_MODULES` example once the CLI exposes module inspection, or add a temporary troubleshooting note that points to `docs/design/wesley-module-contract.md` and warns that modules are trusted Node code.
  2. Fix the license badge URL at `README.md:15`; it currently uses `https://img.shields.io/github/license/wesley`, which lacks the `flyingrobots/wesley` owner/repo path.
  3. Clarify the status matrix for `@wesley/runtime-node` at `README.md:74`. The package is marked `0% -> Alpha` while the current branch relies on it for shared Node module-entry loading, so the matrix should either reflect active runtime-node responsibility or explain what "0%" means.

- **2.2. Missing Standard Documentation (New Focus):**
  - **Answer:** Generic governance docs are in better shape than many repos: `CHANGELOG.md`, `docs/ARCHITECTURE.md`, and `docs/METHOD.md` exist. The missing standard docs for this project type are:
  1. `docs/reference/cli.md`: a generated or manually curated CLI reference tied to the actual Commander registry. This would prevent command drift like `pnpm wesley holmes dashboard`.
  2. `docs/guides/module-authoring.md`: a tutorial/how-to guide for external modules, including config/env loading, trusted-code warnings, capability registration, module-owned commands, counterfactual providers, and tests.
  3. `docs/troubleshooting/module-loading.md`: a short operator guide for missing config files, failed imports, disabled entries, duplicate specifiers, and env/config precedence.

- **2.3. Supplementary Documentation (Docs):**
  - **Answer:** `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs` needs dedicated docs. The module currently embodies the runtime contract for `wesley.config.mjs`, `WESLEY_CONFIG`, `WESLEY_MODULES`, dynamic import behavior, deduplication, and capability discovery (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:87-164`). That behavior is central enough to deserve a reference page and a troubleshooting guide rather than only design-level mentions.

## 3. FINAL ACTION PLAN

- **3.1. Recommendation Type:**
  - **Answer:** **A. Recommend incremental updates to the existing README and documentation.** The documentation structure is fundamentally sound; the highest-value work is command truth, module-authoring practicality, and status/trust clarity.

- **3.2. Deliverable (Prompt Generation):**
  - **Answer:** Use the mitigation prompt below to apply the README fixes from 2.1 and create the missing standard docs from 2.2.

- **3.3. Mitigation Prompt:**
  - **Action Prompt:** `Perform an incremental documentation accuracy pass for Wesley. Update README.md to fix the license badge, explain runtime-node's current status in the package matrix, and add a module-loading verification/trust note after the WESLEY_MODULES example. Update docs/GUIDE.md so every documented command exists; replace or implement the "pnpm wesley holmes dashboard" path. Create docs/reference/cli.md from the actual Commander command registry, docs/guides/module-authoring.md with a runnable external-module example and holmes.counterfactualProviders capability example, and docs/troubleshooting/module-loading.md covering WESLEY_CONFIG, WESLEY_MODULES, missing files, failed imports, disabled entries, duplicates, and trusted-code warnings. Link all three files from README.md and docs/GUIDE.md, then run pnpm run preflight.`
