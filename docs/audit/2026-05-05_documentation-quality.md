---
report_id: 'AUD-2026-05-05-DQ01'
title: 'Documentation Quality Audit: Wesley Release Branch Onboarding'
status: 'Final'
audit:
  date_started: 2026-05-05
  date_completed: 2026-05-05
  type: 'Differential'
  scope: 'README.md, CONTRIBUTING.md, SECURITY.md, docs/GUIDE.md, docs/ARCHITECTURE.md, docs/VISION.md, docs/design/, docs/guides/, docs/scripts-reference.md'
  compliance_frameworks: ['OpenSSF Best Practices', 'Diataxis Documentation System', 'OWASP ASVS']
target:
  repository: 'github.com/flyingrobots/wesley'
  branch: 'release/v0.1.0'
  commit_hash: '1333104'
  language_stack: ['Node.js >=22', 'pnpm 9.15.9', 'ESM JavaScript', 'Markdown', 'GraphQL']
  environment: 'Local release branch'
methodology:
  automated_tools:
    [
      'rg',
      'find',
      'pnpm wesley --help',
      'pnpm audit --json',
      'docs truth scripts via package metadata review'
    ]
  manual_review_hours: 2
  false_positive_rate: '10%'
summary:
  total_findings: 8
  severity_count:
    critical: 0
    high: 2
    medium: 4
    low: 2
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'AUD-2026-05-04-DQ01'
  tracking_ticket: 'GitHub Issues'
---

# AUDIT: DOCUMENTATION QUALITY (2026-05-05)

## 1. ACCURACY & EFFECTIVENESS ASSESSMENT

- **1.1. Core Mismatch:**
  - **Answer:** The single most critical mismatch is no longer in the root README; it is in the root governance/security docs that many contributors will read before the design docs. `CONTRIBUTING.md:3-5` says Wesley explains "database change", and `CONTRIBUTING.md:22-37` says Wesley exists to make database change trustworthy. `SECURITY.md:12` and `SECURITY.md:35-65` frame security around production database code, generated SQL, Supabase Auth, RLS, bcrypt, and migration risk. Current repo truth says Wesley is the domain-empty `GraphQL -> whatever` compiler and assurance toolchain, while database/PostgreSQL/Supabase semantics belong in external modules (`README.md:8-12`, `docs/ARCHITECTURE.md:31-44`). This mismatch is likely to mislead new contributors about where features belong.

- **1.2. Audience & Goal Alignment:**
  - **Answer:** The primary audience is platform engineers, contributors, and external module authors evaluating a schema-first compiler kernel plus assurance stack.
  - **Top question 1, "What is Wesley now?":** Yes in `README.md`, `docs/GUIDE.md`, and `docs/ARCHITECTURE.md`; no in `CONTRIBUTING.md` and `SECURITY.md`, which still use the older database-change framing.
  - **Top question 2, "How do I run it locally?":** Mostly yes. `README.md:30-52` and `docs/GUIDE.md:11-35` provide the fast path and actual commands. The docs command drift found on May 4 has been fixed.
  - **Top question 3, "How do I extend it safely?":** Partially. The design contracts are good, but `docs/guides/generator-plugins.md:43-51` still teaches a top-level `generators` config shape rather than the current `config.modules` and capability model, and there is no practical module-authoring guide.

- **1.3. Time-to-Value (TTV) Barrier:**
  - **Answer:** The biggest documentation bottleneck is the missing "verify and troubleshoot module loading" path. `README.md:45-52` explains how to load modules and names the trust controls, but a user has no documented command or reference page that says "this config was discovered, this env entry was normalized, this module loaded, these capabilities were registered." The design docs explain why modules exist; the operational docs do not yet show how to debug them.

## 2. REQUIRED UPDATES & COMPLETENESS CHECK

- **2.1. README.md Priority Fixes:**
  1. Fix the license badge URL at `README.md:15`; it currently uses `https://img.shields.io/github/license/wesley` rather than the owner/repo path `flyingrobots/wesley`.
  2. Add a module verification/troubleshooting link after the trust-control note at `README.md:50-52`, once `docs/guides/module-authoring.md` or a module-loading troubleshooting page exists.
  3. Clarify the `@wesley/runtime-node` package matrix row at `README.md:77`; it says `0% -> Alpha` while the release branch depends on runtime-node for shared module entry loading and trust controls.

- **2.2. Missing Standard Documentation (New Focus):**
  - **Answer:** Standard governance files exist (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`), but two important standard docs are missing or not yet current for this project type:
  1. `docs/reference/cli.md`: a generated or curated CLI reference tied to the actual Commander registry. `pnpm wesley --help` shows the current command list, but there is no durable reference page linked from README/GUIDE.
  2. `docs/guides/module-authoring.md`: a practical module-authoring guide that shows a minimal external module, config/env loading, trusted-code controls, capability registration, and tests.
  3. `docs/troubleshooting/module-loading.md` or `docs/reference/module-load-report.md`: a focused operator guide for `WESLEY_CONFIG`, `WESLEY_MODULES`, `WESLEY_DISABLE_MODULES`, `WESLEY_MODULE_ALLOWLIST`, missing files, blocked imports, duplicate names, and disabled entries.

- **2.3. Supplementary Documentation (Docs):**
  - **Answer:** `packages/wesley-runtime-node/src/ModuleEntryLoader.mjs` needs dedicated docs. It now embodies the runtime contract for config discovery, env parsing, file URL splitting, disable mode, allowlist enforcement, explicit missing config errors, dynamic imports, dedupe, and capability discovery (`packages/wesley-runtime-node/src/ModuleEntryLoader.mjs:65-258`). This behavior is central enough to deserve a reference page and examples, not only design-level notes.

## 3. FINAL ACTION PLAN

- **3.1. Recommendation Type:**
  - **Answer:** **A. Recommend incremental updates to the existing README and documentation.** The front-door README/GUIDE/ARCHITECTURE are directionally correct; the needed work is targeted cleanup of stale root governance/security docs plus practical module and CLI references.

- **3.2. Deliverable (Prompt Generation):**
  - **Answer:** Use the mitigation prompt below to apply the README fixes from 2.1, refresh the stale standard docs, and create the missing docs from 2.2.

- **3.3. Mitigation Prompt:**
  - **Action Prompt:** `Perform an incremental Wesley documentation accuracy pass. Update CONTRIBUTING.md and SECURITY.md so they describe Wesley as a domain-empty GraphQL compiler and assurance toolchain with external modules bringing database/product/runtime semantics. Fix the README license badge, clarify @wesley/runtime-node's package-matrix status, and add links from README/GUIDE to a new module authoring/troubleshooting path. Create docs/reference/cli.md from the actual pnpm wesley --help command tree, docs/guides/module-authoring.md with a minimal external module and capability examples, and docs/troubleshooting/module-loading.md covering WESLEY_CONFIG, WESLEY_MODULES, WESLEY_DISABLE_MODULES, WESLEY_MODULE_ALLOWLIST, missing configs, failed imports, disabled entries, duplicate target names, and trusted-code warnings. Update docs/guides/generator-plugins.md so config examples use modules and capabilities, then run pnpm run preflight and docs command truth checks.`
