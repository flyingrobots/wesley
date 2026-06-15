---
report_id: 'AUD-2026-06-15-DX01'
title: 'Day 0 DX And Purity Audit: Wesley Rust-Native Checkout'
status: 'Final'
audit:
  date_started: 2026-06-15
  date_completed: 2026-06-15
  type: 'Full'
  scope: 'README.md, docs/GUIDE.md, docs/TECHNICAL_TEARDOWN.md, pnpm-workspace.yaml, package.json, .editorconfig, .prettierrc.json, eslint.config.js, crates/wesley-cli, crates/wesley-holmes, xtask'
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
      'git status',
      'rg',
      'cargo wesley doctor --json',
      'cargo wesley schema lower --help',
      'cargo wesley schema lower --json',
      'cargo wesley law explain --json',
      'pnpm lint',
      'cargo fmt --check',
      'cargo clippy --workspace --all-targets -- -D warnings',
      'pnpm audit --prod=false --json'
    ]
  manual_review_hours: 4
  false_positive_rate: '12%'
summary:
  total_findings: 5
  severity_count:
    critical: 0
    high: 2
    medium: 2
    low: 1
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'docs/audit/2026-05-05_code-quality.md'
  tracking_ticket: 'TBD'
---

# Day 0 DX And Purity Audit

## Scope Note

This report audits the local checkout on `docs/current-truth-cleanup` at commit
`018c8c528e26e2541b92ec0657287ddc2797fa84`. The requested IRS template names
`main`, but reporting `main` here would be false because this branch already
contains the current-truth documentation cleanup commit.

## Day 0 Boot Trace

Observed fast path:

```bash
pnpm --version
cargo --version
cargo wesley doctor --json
cargo wesley schema lower --help
pnpm lint
```

Observed results:

- `pnpm --version` returned `9.15.9`.
- `cargo --version` returned `cargo 1.96.0`.
- `cargo wesley doctor --json` returned `ok: true` and five passing Rust-native
  checks.
- `pnpm lint` passed.
- `cargo fmt --check` failed.
- `cargo clippy --workspace --all-targets -- -D warnings` failed.

Time-to-value score: **7 / 10**.

The Rust-native first boot is unusually strong for a compiler project because
`doctor --json` is fast and useful. The score is capped because strict local
quality gates fail today and because JSON-mode errors do not remain JSON on
failure.

## Findings

### DX-001 High: Strict Rust Formatting Gate Fails

Evidence:

- `cargo fmt --check` reported diffs in `crates/wesley-holmes/src/domain/mod.rs`,
  `crates/wesley-holmes/src/lib.rs`, and
  `crates/wesley-holmes/tests/suppression_abuse.rs`.
- The repository's style contracts prefer spaces, not tabs:
  `.editorconfig:7`, `.prettierrc.json:7`.

Impact:

A new contributor following a strict Rust workflow will hit a formatting failure
before they can claim a clean local checkout. This is Day 0 friction and a
purity failure, even though `pnpm lint` passes.

Action Prompt:

```text
Fix Wesley's Rust formatting drift without changing behavior. Run `cargo fmt`,
inspect the resulting diff, and ensure it only contains rustfmt mechanical
rewrites in `crates/wesley-holmes/src/domain/mod.rs`,
`crates/wesley-holmes/src/lib.rs`, and
`crates/wesley-holmes/tests/suppression_abuse.rs`. Then run
`cargo fmt --check`, `cargo test --workspace`, and `cargo xtask preflight`.
Commit the result as `style(rust): apply rustfmt to Holmes sources`.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-DX01'
finding_id: 'DX-001'
status: 'pending'
---

# Apply rustfmt to Holmes sources

`cargo fmt --check` fails on the current checkout. Apply rustfmt only, verify no
behavioral changes, and run the Rust workspace tests plus preflight.

## Action Prompt

Fix Wesley's Rust formatting drift without changing behavior. Run `cargo fmt`,
inspect the resulting diff, and ensure it only contains rustfmt mechanical
rewrites in `crates/wesley-holmes/src/domain/mod.rs`,
`crates/wesley-holmes/src/lib.rs`, and
`crates/wesley-holmes/tests/suppression_abuse.rs`. Then run
`cargo fmt --check`, `cargo test --workspace`, and `cargo xtask preflight`.
Commit the result as `style(rust): apply rustfmt to Holmes sources`.
```

### DX-002 High: README Current Release Text Still Names JS Lowering

Evidence:

- `README.md:39` says "**Object extension folding**: The JS GraphQL lowering now
  rejects duplicate fields..."
- `docs/BEARING.md:112-128` says no legacy Node authority remains in compiler,
  runtime, product entrypoint, tests, CI posture, or active release plan.
- `docs/GUIDE.md:42-73` directs users to native Rust commands and says the
  historical package CLI is retired.

Impact:

The README is the public front door. A new user sees a release note that points
at "JS GraphQL lowering" while the active architecture says the compiler spine
is Rust-native. That is semantic drift at the highest-visibility location.

Action Prompt:

```text
Rewrite the README v0.0.5 "Object extension folding" bullet so it names the
current Rust/native compiler truth without falsely implying active JS compiler
authority. Cross-check the wording against `docs/BEARING.md`,
`docs/GUIDE.md`, `CHANGELOG.md`, and the v0.0.5 release notes. Add or update a
docs-truth regression if the repository has a checker for retired JS compiler
phrases in the README.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-DX01'
finding_id: 'DX-002'
status: 'pending'
---

# Correct README v0.0.5 compiler wording

The public README still says "JS GraphQL lowering" in the v0.0.5 release note
even though the current compiler authority is Rust-native.

## Action Prompt

Rewrite the README v0.0.5 "Object extension folding" bullet so it names the
current Rust/native compiler truth without falsely implying active JS compiler
authority. Cross-check the wording against `docs/BEARING.md`,
`docs/GUIDE.md`, `CHANGELOG.md`, and the v0.0.5 release notes. Add or update a
docs-truth regression if the repository has a checker for retired JS compiler
phrases in the README.
```

### DX-003 Medium: JSON Mode Does Not Produce JSON Error Envelopes

Evidence:

- `crates/wesley-cli/src/main.rs:32-40` prints every top-level error with
  `eprintln!("{error}")`.
- `crates/wesley-cli/src/main.rs:2169-2224` formats `CliError` as plain text.
- `cargo wesley schema lower --schema does-not-exist.graphql --json` printed:
  `failed to access schema ...`
- `cargo wesley law explain --law ... missing.subject --json` printed a plain
  usage error and `Run `wesley --help` for usage.`
- `crates/wesley-core/src/domain/error.rs:32-63` already exposes structured
  `WesleyDiagnostic`, but the CLI does not use a top-level JSON error envelope.

Impact:

The Principle of Least Astonishment is violated. A caller who asks for `--json`
should not have to special-case stderr text on failure. This blocks reliable
CI, editor integration, MCP adapters, and agent workflows.

Action Prompt:

```text
Add a CLI-wide JSON error envelope for Wesley. Track whether `--json` or
`--format json` was requested before command execution, and when a command fails
emit a stable JSON object to stderr with `ok: false`, `code`, `message`,
`exitCode`, and optional `path`, `line`, `column`, and `source` fields. Preserve
existing human-readable errors for text mode. Add CLI tests for missing schema
files, parse errors, unknown commands, and `law explain` misses in JSON mode.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'medium'
source_report: 'AUD-2026-06-15-DX01'
finding_id: 'DX-003'
status: 'pending'
---

# Add JSON error envelopes to the native CLI

Commands that accept `--json` still print plain text on failure.

## Action Prompt

Add a CLI-wide JSON error envelope for Wesley. Track whether `--json` or
`--format json` was requested before command execution, and when a command fails
emit a stable JSON object to stderr with `ok: false`, `code`, `message`,
`exitCode`, and optional `path`, `line`, `column`, and `source` fields. Preserve
existing human-readable errors for text mode. Add CLI tests for missing schema
files, parse errors, unknown commands, and `law explain` misses in JSON mode.
```

### DX-004 Medium: Style Policy Is Split Across Tools And Conflicts With The IRS Tab Rule

Evidence:

- `.editorconfig:7-8` sets `indent_style = space` and `indent_size = 2`.
- `.prettierrc.json:6-7` sets `tabWidth: 2` and `useTabs: false`.
- `eslint.config.js:66` contains an indentation rule, while
  `eslint.config.js:145-147` then delegates formatting to Prettier.
- No `rustfmt.toml` is present, so Rust follows rustfmt defaults.

Impact:

The IRS prompt asks for tabs over spaces, but the repository has an explicit
space-based style contract. The repo should not be forced into tab indentation
for Rust or Prettier-managed files, but the current policy is discoverable only
by reading scattered config files.

Action Prompt:

```text
Create a short repository style policy document that names the authoritative
formatters and resolves the IRS tab-vs-space mismatch. State that Rust is
formatted by rustfmt defaults, JavaScript/Markdown/JSON are formatted by
Prettier with `useTabs: false`, and Makefiles remain tab-indented through
`.editorconfig`. Link it from `docs/GUIDE.md` and ensure no docs claim tabs are
required outside Makefiles.
```

### DX-005 Low: `pnpm-workspace.yaml` Still Calls Retained Packages "Core Packages"

Evidence:

- `pnpm-workspace.yaml:2-3` labels `packages/*` as "Core packages (domain logic,
  CLI, adapters, generators)".
- Current retained packages are Holmes plus browser/Bun/Deno host experiments:
  `packages/wesley-holmes`, `packages/wesley-host-browser`,
  `packages/wesley-host-bun`, and `packages/wesley-host-deno`.
- `packages/wesley-holmes/package.json:7-13` marks Holmes as
  `legacy-compatibility`.
- `packages/wesley-host-browser/package.json:7-13`,
  `packages/wesley-host-bun/package.json:7-13`, and
  `packages/wesley-host-deno/package.json:7-13` mark those hosts as
  delete-or-externalize experiments.

Impact:

This is not a runtime bug, but it is a misleading signpost. A new maintainer may
think `packages/*` remains the compiler core when the current architecture says
the Rust workspace is the product spine.

Action Prompt:

```text
Update `pnpm-workspace.yaml` comments so `packages/*` is described as retained
non-compiler JavaScript surfaces: Holmes compatibility tooling and external
host smoke experiments. Do not change the workspace globs. Run docs checks and
the package metadata guard afterward.
```

## Executive Note

The Day 0 path is close to good. The native doctor command is a major asset.
The immediate standard-raising move is to make the strict local gates agree
with the claimed quality posture: format clean, clippy clean, JSON errors
structured, and front-door wording aligned with the Rust-native truth.
