---
report_id: 'AUD-2026-06-15-AP01'
title: 'Architecture And Provenance Audit: Wesley Rust-Native Compiler Spine'
status: 'Final'
audit:
  date_started: 2026-06-15
  date_completed: 2026-06-15
  type: 'Full'
  scope: 'crates/wesley-core, crates/wesley-cli, crates/wesley-emit-rust, crates/wesley-emit-typescript, crates/wesley-holmes, xtask, scripts/pre-push-sanity.mjs, docs/BEARING.md, docs/TECHNICAL_TEARDOWN.md'
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
      'rg',
      'wc -l',
      'cargo wesley doctor --json',
      'cargo fmt --check',
      'cargo clippy --workspace --all-targets -- -D warnings',
      'pnpm audit --prod=false --json'
    ]
  manual_review_hours: 5
  false_positive_rate: '12%'
summary:
  total_findings: 6
  severity_count:
    critical: 0
    high: 2
    medium: 4
    low: 0
  remediation_status: 'Pending'
related_reports:
  previous_audit: 'docs/audit/2026-05-05_code-quality.md'
  tracking_ticket: 'TBD'
---

# Architecture And Provenance Audit

## Architectural Baseline

The repository has a coherent current center:

- `Cargo.toml:1-10` defines six Rust workspace members.
- `docs/BEARING.md:112-128` records the legacy Node compiler retirement
  closeout.
- `crates/wesley-core/src/domain/ir.rs:158-185` computes canonical registry
  hashes by stripping nondeterministic metadata and sorting JSON object keys.
- `crates/wesley-holmes/src/ports/mod.rs:25-69` defines deterministic ports for
  time, artifact IO, and filesystem IO.
- `crates/wesley-holmes/tests/architecture.rs:4-35` actively blocks domain
  imports of filesystem, network, process, wall-clock, and GitHub clients.

The core direction is sound. The remaining architecture problems are mostly
concentration, provenance gaps around generated outputs, and stale cross-layer
language left behind by rapid migration.

## Findings

### AP-001 High: Native CLI Is A 2,244-Line God Module

Evidence:

- `crates/wesley-cli/src/main.rs` is 2,244 lines.
- `crates/wesley-cli/src/main.rs:44-75` manually dispatches top-level commands.
- `crates/wesley-cli/src/main.rs:77-178` handles law command behavior directly.
- `crates/wesley-cli/src/main.rs:887-1047` implements generic option parsing.
- `crates/wesley-cli/src/main.rs:1066-1127` performs file IO and metadata
  writing.
- `crates/wesley-cli/src/main.rs:1997-2167` embeds all help text.
- `crates/wesley-cli/src/main.rs:2169-2224` defines the CLI error surface.

Impact:

This file violates separation of concerns. It contains command routing, option
parsing, filesystem side effects, Git integration, law behavior, schema
behavior, emitter behavior, help rendering, and error formatting. The module is
currently comprehensible, but further growth will turn every feature into a
merge-risk event.

Action Prompt:

```text
Refactor `crates/wesley-cli/src/main.rs` into command modules without changing
observable CLI behavior. Create `commands/schema.rs`, `commands/law.rs`,
`commands/emit.rs`, `commands/operation.rs`, `options.rs`, `io.rs`,
`help.rs`, and `error.rs`. Preserve all current command names, flags, exit
codes, stdout/stderr behavior, and tests. Move one command family at a time,
running `cargo test -p wesley-cli --test cli`, `cargo fmt --check`, and
`cargo xtask preflight` after each migration.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-AP01'
finding_id: 'AP-001'
status: 'pending'
---

# Split the native CLI god module

`crates/wesley-cli/src/main.rs` is 2,244 lines and owns routing, parsing, IO,
metadata, help, and error formatting.

## Action Prompt

Refactor `crates/wesley-cli/src/main.rs` into command modules without changing
observable CLI behavior. Create `commands/schema.rs`, `commands/law.rs`,
`commands/emit.rs`, `commands/operation.rs`, `options.rs`, `io.rs`,
`help.rs`, and `error.rs`. Preserve all current command names, flags, exit
codes, stdout/stderr behavior, and tests. Move one command family at a time,
running `cargo test -p wesley-cli --test cli`, `cargo fmt --check`, and
`cargo xtask preflight` after each migration.
```

### AP-002 High: `xtask` Concentrates Release, Docs, Governance, GitHub, And Node-Retirement Logic

Evidence:

- `xtask/src/main.rs` is 3,558 lines.
- `xtask/src/main.rs:80-120` dispatches preflight, docs-check, packaging,
  publishing, release prep, release guard, release check, and legacy preflight.
- `xtask/src/main.rs:179-220` performs publishing workflow control.
- `xtask/src/main.rs` also contains docs truth checks, release governance checks,
  GitHub issue queries, package metadata rules, Node retirement ledger rules, and
  tests.

Impact:

The project has correctly moved release authority into Rust, but the automation
boundary is now too dense. `xtask` is a second god module with production
release consequences. A future release-guard change can accidentally disturb
docs checks or package publication code.

Action Prompt:

```text
Split `xtask/src/main.rs` into focused modules while preserving the public
`cargo xtask ...` interface. Extract `preflight`, `docs_check`, `release`,
`publish`, `github_issues`, `node_retirement`, `package_metadata`, and
`command` helpers. Move existing unit tests with the code they exercise. Add a
small integration test that proves every existing xtask subcommand still parses
and routes to the same handler label.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'high'
source_report: 'AUD-2026-06-15-AP01'
finding_id: 'AP-002'
status: 'pending'
---

# Decompose xtask automation authority

`xtask/src/main.rs` is 3,558 lines and mixes preflight, docs, release,
publishing, GitHub issue, package metadata, and Node retirement logic.

## Action Prompt

Split `xtask/src/main.rs` into focused modules while preserving the public
`cargo xtask ...` interface. Extract `preflight`, `docs_check`, `release`,
`publish`, `github_issues`, `node_retirement`, `package_metadata`, and
`command` helpers. Move existing unit tests with the code they exercise. Add a
small integration test that proves every existing xtask subcommand still parses
and routes to the same handler label.
```

### AP-003 Medium: Emit Metadata Does Not Bind The Generated Output Bytes

Evidence:

- `crates/wesley-cli/src/main.rs:1074-1089` writes generated files directly with
  `fs::write`.
- `crates/wesley-cli/src/main.rs:1092-1127` writes metadata sidecars.
- `crates/wesley-cli/src/main.rs:1111-1122` records schema hash, law hashes,
  generator identity, generator version, and execution mode.
- No output content hash, output path, or atomic write witness is present in the
  metadata fields.

Impact:

Wesley correctly treats authored schema and law as authority, but generated
artifacts are still mutable local files. The metadata proves what input and
generator were used; it does not prove which exact bytes were written to the
output file or that the output and sidecar were produced atomically.

Action Prompt:

```text
Extend native emit metadata to bind generated output bytes. Compute a
`generatedOutputHash` over the exact emitted UTF-8 content, include
`outputPath`, `outputByteLength`, and `metadataVersion`, and write output plus
metadata through temp-file-and-rename semantics. Add CLI tests proving metadata
hashes match the generated file for Rust, TypeScript, and
le-binary-typescript emitters.
```

Filesystem Backlog Block:

```markdown
---
lane: 'bad-code'
severity: 'medium'
source_report: 'AUD-2026-06-15-AP01'
finding_id: 'AP-003'
status: 'pending'
---

# Bind emit metadata to generated output bytes

Emitter metadata records schema and law provenance but not the exact generated
output hash.

## Action Prompt

Extend native emit metadata to bind generated output bytes. Compute a
`generatedOutputHash` over the exact emitted UTF-8 content, include
`outputPath`, `outputByteLength`, and `metadataVersion`, and write output plus
metadata through temp-file-and-rename semantics. Add CLI tests proving metadata
hashes match the generated file for Rust, TypeScript, and
le-binary-typescript emitters.
```

### AP-004 Medium: Directive Semantics Collapse To Untyped JSON At The Core Boundary

Evidence:

- `crates/wesley-core/src/domain/ir.rs:56-57` stores type directives as
  `IndexMap<String, serde_json::Value>`.
- `crates/wesley-core/src/domain/ir.rs:107-108` stores field directives the
  same way.
- `crates/wesley-core/src/adapters/apollo.rs:531-573` extracts directives into
  generic JSON values, with duplicate checks only for canonical core directive
  aliases.

Impact:

This is partly intentional because Wesley is domain-empty. The risk is that a
consumer can mistake preserved directive JSON for validated law. Invariants
cross the boundary as shape, not as enforced semantics, unless a later `weslaw`
or target-specific layer binds them.

Action Prompt:

```text
Add an explicit directive semantics boundary document and test fixture. The doc
must state that L1 directive JSON is preservation, not validation, except for
Wesley-owned canonical directive alias checks. Add a fixture proving an unknown
directive is preserved in L1 but does not become active law until a `weslaw`
binding or target-specific validator consumes it. Link the fixture from
`docs/ARCHITECTURE.md` and `docs/GUIDE.md`.
```

### AP-005 Medium: Parser Diagnostics Drop All But The First Parse Error

Evidence:

- `crates/wesley-core/src/adapters/apollo.rs:240-244` collects parser errors but
  returns only `errors[0]`.
- `crates/wesley-core/src/adapters/apollo.rs:126-130` repeats the same first
  error behavior for operation listing.
- `crates/wesley-core/src/domain/error.rs:7-18` models a single parse error,
  not a diagnostic collection.

Impact:

For small schemas this is acceptable. For Day 0 authoring and large schema
migrations it loses causal history: one syntax issue hides the rest. This is a
provenance problem because the compiler cannot report the full diagnostic set
that caused lowering to fail.

Action Prompt:

```text
Introduce a multi-diagnostic parse error path. Preserve the existing
`WesleyError::ParseError` display for compatibility, but add a diagnostic list
type used by CLI JSON mode and tests. Update lower, operations, hash, and diff
commands so JSON output can include every parser diagnostic from
`apollo-parser`, including line and column where available.
```

### AP-006 Medium: Stale Retired Command Name Remains In Capability Descriptor Comments

Evidence:

- `crates/wesley-core/src/domain/capability.rs:142` says a target is "selected
  by `wesley compile` or a future Rust verb."
- `docs/BEARING.md:82-84` says not to resurrect the retired Node
  `wesley compile` dispatch path.

Impact:

The code behavior is not wrong, but the comment is architecturally dangerous.
Comments are doctrine in a compiler boundary. Keeping retired command names in
core capability types invites future contributors to reintroduce the wrong
entrypoint.

Action Prompt:

```text
Replace stale `wesley compile` language in Rust capability comments with the
current Rust-native target registry vocabulary. Audit `crates/wesley-core`,
`crates/wesley-cli`, and docs for remaining retired command names used as
future-facing guidance. Add a docs/code grep guard if the existing Node
retirement checks do not cover Rust comments.
```

## Architecture Judgment

Wesley has the right northbound boundary: authored SDL and law become
deterministic compiler facts, and external runtimes own runtime authority. The
highest-leverage internal cleanup is not a conceptual rewrite. It is modular
extraction of CLI and xtask code so the architecture in the docs is physically
visible in the code.
