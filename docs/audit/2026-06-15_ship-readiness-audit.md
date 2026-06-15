---
report_id: 'AUD-2026-06-15-SR01'
title: 'Ship Readiness And Risk Audit: Wesley Rust-Native Checkout'
status: 'Final'
audit:
  date_started: 2026-06-15
  date_completed: 2026-06-15
  type: 'Full'
  scope: 'package.json, pnpm-lock.yaml, .github/workflows, xtask, scripts, crates/wesley-cli, crates/wesley-holmes, docs/TECHNICAL_TEARDOWN.md'
  compliance_frameworks: ['System-Style', 'OWASP ASVS']
target:
  repository: 'github.com/flyingrobots/wesley'
  branch: 'docs/current-truth-cleanup'
  commit_hash: '018c8c528e26e2541b92ec0657287ddc2797fa84'
  language_stack:
    ['Rust', 'Cargo', 'GraphQL SDL', 'ESM JavaScript', 'Node.js', 'pnpm', 'Bats', 'Vite']
  environment: 'Local'
methodology:
  automated_tools:
    [
      'pnpm audit --prod=false --json',
      'cargo fmt --check',
      'cargo clippy --workspace --all-targets -- -D warnings',
      'pnpm lint',
      'cargo wesley doctor --json',
      'rg'
    ]
  manual_review_hours: 5
  false_positive_rate: '12%'
summary:
  total_findings: 5
  severity_count:
    critical: 0
    high: 4
    medium: 1
    low: 0
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'docs/audit/2026-05-05_ship-readiness.md'
  tracking_ticket: 'TBD'
---

# Ship Readiness And Risk Audit

## Final Ship Recommendation

**NO** for a high-stakes deployment or release branch.

**YES, BUT** for local alpha compiler experimentation, provided users understand
that the JavaScript website/host-experiment lane currently has a high advisory,
strict Rust formatting is not clean, strict Clippy is not clean, and JSON error
contracts are incomplete.

## Top 3 Immediate Ship-Stopping Risks

### SR-001 High: High-Severity `esbuild` Advisory In The JavaScript Tooling Lane

Evidence:

- `pnpm audit --prod=false --json` exited nonzero.
- Audit metadata reported `high: 1`, `critical: 0`, `totalDependencies: 599`.
- Advisory: `GHSA-gv7w-rqvm-qjhr`.
- Vulnerable module: `esbuild@0.25.10`.
- Vulnerable range: `>=0.17.0 <0.28.1`.
- Patched range: `>=0.28.1`.
- Paths include `rolldown-vite@7.1.14`, `packages/wesley-host-browser >
vitest@4.1.7`, and `wesley-website`.

Impact:

The Rust compiler can still be used locally, but the repository cannot honestly
claim release-grade JavaScript tooling health while a high advisory is present.
The advisory describes binary integrity failure in esbuild's Deno module under
registry influence, which is directly relevant to CI and host-experiment
contexts.

Action Prompt:

```text
Resolve the high esbuild advisory reported by `pnpm audit --prod=false --json`.
Upgrade the Vite/rolldown-vite/Vitest dependency path or add a targeted pnpm
override so every resolved `esbuild` version is `>=0.28.1`. Regenerate the lock
file, run `pnpm audit --prod=false --json`, `pnpm lint`, affected package tests,
browser/website smoke checks if available, and `cargo xtask preflight`. Document
the advisory resolution in CHANGELOG.md if this affects release readiness.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-SR01'
finding_id: 'SR-001'
status: 'pending'
---

# Resolve high esbuild advisory in JS tooling

`pnpm audit --prod=false --json` reports `GHSA-gv7w-rqvm-qjhr` through
`esbuild@0.25.10` under `rolldown-vite@7.1.14`.

## Action Prompt

Resolve the high esbuild advisory reported by `pnpm audit --prod=false --json`.
Upgrade the Vite/rolldown-vite/Vitest dependency path or add a targeted pnpm
override so every resolved `esbuild` version is `>=0.28.1`. Regenerate the lock
file, run `pnpm audit --prod=false --json`, `pnpm lint`, affected package tests,
browser/website smoke checks if available, and `cargo xtask preflight`. Document
the advisory resolution in CHANGELOG.md if this affects release readiness.
```

### SR-002 High: Strict Clippy Fails On Holmes Test Code

Evidence:

- `cargo clippy --workspace --all-targets -- -D warnings` exited with code 101.
- Clippy flagged `default_constructed_unit_structs`.
- Examples:
  - `crates/wesley-holmes/tests/assessment_core.rs:238`
  - `crates/wesley-holmes/tests/law_coverage_ingest.rs:58`
  - `crates/wesley-holmes/tests/law_diff_ingest.rs:11`
  - `crates/wesley-holmes/tests/suppression_abuse.rs:81`
  - `crates/wesley-holmes/tests/suppression_abuse.rs:452`

Impact:

The default preflight does not catch this, but a strict Rust release lane does.
The fixes are mechanical, which makes the current failure more embarrassing:
the code is not far from compliant, but the strict gate is red.

Action Prompt:

```text
Fix Clippy's `default_constructed_unit_structs` findings in Holmes tests. Replace
`JsonLawDiffIngestPort::default()` with `JsonLawDiffIngestPort` and
`JsonLawCoverageIngestPort::default()` with `JsonLawCoverageIngestPort` wherever
the type is a unit struct. Run `cargo clippy --workspace --all-targets -- -D
warnings`, `cargo test -p wesley-holmes`, and `cargo xtask preflight`.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-SR01'
finding_id: 'SR-002'
status: 'pending'
---

# Fix strict Clippy failures in Holmes tests

Strict Clippy fails on `JsonLawDiffIngestPort::default()` and
`JsonLawCoverageIngestPort::default()` unit-struct construction.

## Action Prompt

Fix Clippy's `default_constructed_unit_structs` findings in Holmes tests. Replace
`JsonLawDiffIngestPort::default()` with `JsonLawDiffIngestPort` and
`JsonLawCoverageIngestPort::default()` with `JsonLawCoverageIngestPort` wherever
the type is a unit struct. Run `cargo clippy --workspace --all-targets -- -D
warnings`, `cargo test -p wesley-holmes`, and `cargo xtask preflight`.
```

### SR-003 High: Preflight Does Not Enforce The Strict Gates That Currently Fail

Evidence:

- `package.json:15` maps `preflight` to `cargo xtask preflight`.
- `xtask/src/main.rs:86-91` runs git identity guard, docs check, workspace tests,
  and CLI help.
- `xtask/src/main.rs:86-91` does not run `cargo fmt --check`,
  `cargo clippy --workspace --all-targets -- -D warnings`, or
  `pnpm audit --prod=false --json`.
- Those omitted gates currently fail.

Impact:

The repository's green default preflight can coexist with red strict release
hygiene. That is a ship-readiness integrity problem: developers can reasonably
believe the repo is clean when the stricter quality and dependency gates are
not clean.

Action Prompt:

```text
Add an explicit strict quality gate to Wesley automation. Either extend
`cargo xtask preflight` or add `cargo xtask strict-preflight` that runs
`cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
`pnpm audit --prod=false --json`, docs checks, workspace tests, and native CLI
smoke. Update README.md, docs/GUIDE.md, and release governance docs so the
default human command and release command cannot silently diverge.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-SR01'
finding_id: 'SR-003'
status: 'pending'
---

# Make strict quality gates enforceable

The current default preflight omits the strict gates that fail today:
rustfmt, Clippy, and pnpm audit.

## Action Prompt

Add an explicit strict quality gate to Wesley automation. Either extend
`cargo xtask preflight` or add `cargo xtask strict-preflight` that runs
`cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
`pnpm audit --prod=false --json`, docs checks, workspace tests, and native CLI
smoke. Update README.md, docs/GUIDE.md, and release governance docs so the
default human command and release command cannot silently diverge.
```

## Security Posture And Operational Gaps

### SR-004 High: Generated Output Writes Are Not Atomic And Metadata Does Not Prove Output Bytes

Evidence:

- `crates/wesley-cli/src/main.rs:1074-1089` writes output directly with
  `fs::write`.
- `crates/wesley-cli/src/main.rs:1092-1127` writes metadata separately.
- The metadata records input and generator identity, but not a content hash for
  the generated output bytes.

Impact:

This is not an injection bug. It is an operational provenance gap. A crash,
interruption, or local mutation can leave output and metadata out of sync, and
the sidecar cannot prove it.

Action Prompt:

```text
Make native emitter writes atomic and self-verifying. Write generated output and
metadata through temp paths followed by rename, include `generatedOutputHash`,
`outputByteLength`, and `metadataVersion` in metadata, and test interruption-safe
behavior through a fake filesystem or injectable write port.
```

### SR-005 Medium: Shell-String Pre-Push Commands Are Still Executed Through Bash

Evidence:

- `scripts/pre-push-sanity.mjs:64-68` stores commands as shell strings.
- `scripts/pre-push-sanity.mjs:75-92` builds command strings, including package
  test commands.
- `scripts/pre-push-sanity.mjs:228-234` executes those strings through
  `/bin/bash -lc`.

Impact:

The current code quotes package names, and the command set is mostly internal.
Still, shell-string execution is unnecessary risk in a repository that is trying
to make provenance and boundaries explicit.

Action Prompt:

```text
Refactor `scripts/pre-push-sanity.mjs` so selected checks are structured
`{ key, label, cmd, args }` records rather than shell strings. Execute with
`spawnSync(cmd, args, { shell: false })`, keep the dry-run display readable, and
add tests covering package names, repo bats, preflight, legacy-preflight, and no
matching checks.
```

## COOL IDEAS(TM): Off-Label Misuse

### Use Wesley As An Agent Capability Attestation Gateway

The architecture can be misused productively: compile an agent's proposed
GraphQL operation plus `weslaw` into a signed capability dossier before the
agent touches a host. The dossier would include schema hash, law hash, selected
operation, generated bindings, required permissions, forbidden resources, and
Holmes assurance output. A host could refuse all agent actions that do not carry
a current dossier.

Filesystem Backlog Block:

```markdown
---
lane: 'cool-ideas'
severity: 'idea'
source_report: 'AUD-2026-06-15-SR01'
finding_id: 'SR-IDEA-001'
status: 'uncommitted'
---

# Agent capability attestation gateway

Use Wesley as a preflight compiler for agent actions. An agent proposes a
GraphQL operation; Wesley compiles the operation and bound `weslaw` into a
capability dossier containing schema hash, law hash, operation identity,
required permissions, forbidden resources, generated bindings, and Holmes
assurance output. Hosts reject actions without a current dossier.

## Action Prompt

Design an experimental `wesley attest operation` workflow. It should accept a
schema, operation, and law file, then emit a signed or hash-bound dossier with
operation selections, law coverage, capability requirements, forbidden
resources, generated binding metadata, and Holmes assessment status. Keep host
admission outside Wesley; Wesley only produces the evidence packet.
```

## Ship Judgment

Do not cut a high-stakes release from this state. Fix the high advisory, make
strict Rust hygiene green, and close the preflight gap first. After that, the
repo can support a much more credible technical teardown rewrite because the
teardown can cite living gates rather than aspirational quality posture.
