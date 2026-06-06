---
title: "{ID} - {Short Title}"
legend: "SPEC|SOURCE|TRANSMUTE|OWN|EVIDENCE|RUNTIME|RE|CI"
packet: "NNNN-short-slug"
issue: "https://github.com/flyingrobots/wesley/issues/{number}"
pr: "https://github.com/flyingrobots/wesley/pull/{number}"
status: "draft|active|landed|superseded"
owners:
  - "@flyingrobots"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
---

<!-- markdownlint-disable-next-line MD025 -->
# {ID} - {Short Title}

## Linked Issue

- [{issue URL}](https://github.com/flyingrobots/wesley/issues/{number})

## Roadmap Gate

Name the BEARING section or active campaign this work advances.

Example:

- §11 weslaw Semantic Law IR
- HIMP-036–038: Rollout policy and abuse prevention
- §6 Module Capability Boundary

## Cycle Start

- [ ] `git fetch origin` completed.
- [ ] Local `main` synced to `origin/main` without rebase or force operations.
- [ ] Cycle branch checked out from the synced merge target.
- [ ] GitHub issue created and labeled `work-in-progress`.
- [ ] Design doc, issue link, and initial cycle scaffold staged and committed.
- [ ] Branch pushed and non-draft PR opened to `main`.

## Decision Summary

One short paragraph describing the decision this document is making.

Be specific enough that a reviewer can decide whether the proposed
implementation matches the design. Avoid roadmap language here. Say what will
exist, what it will do, and what boundary it owns.

## Sponsored Human

A `{operator/author/consumer}` wants `{capability/outcome}` so that
`{reason}`, without having to `{current pain or unsafe workaround}`.

## Sponsored Agent

An agent needs `{inspectable contract/tool/surface}` so it can
`{operation}`, without inferring `{unstable/private/undocumented state}`.

## Hill

By the end of this cycle, `{operator/agent}` can `{observable outcome}`
through `{surface/CLI/crate API}`, and the repo proves it with
`{tests/fixtures/witnesses}`.

## Current Truth

Describe what exists today. This section is factual, not aspirational.

Include concrete anchors where relevant:

- crates and modules
- CLI commands and flags
- exported Rust types or trait surfaces
- current docs and BEARING gravity
- current failure mode or gap
- related GitHub issues or PRs
- known test fixture or golden file coverage

Draft docs may cite repo-relative paths. Active or PR-ready docs must use
commit-pinned GitHub permalinks for critical current-truth claims.

Use this format for pinned source or test evidence:

```text
[<path>#L<line>:<short-sha>](https://github.com/flyingrobots/wesley/blob/<full-commit-sha>/<path>#L<line>)
```

## Problem

State the actual problem. Name the failure mode, missing contract, or operator
workaround.

Good:

- "`holmes weslaw assess` exits 0 when an expired suppression overrides a
  non-overridable gate, silently passing a required check."

Bad:

- "Abuse prevention would be useful."

## Scope

This cycle includes:

- ...

## Non-Goals

This cycle does not include:

- ...

Non-goals prevent the design from silently expanding while the PR is in flight.

## Compiler / CLI Contract

Required for new or changed CLI commands, emitter outputs, `weslaw` artifact
formats, or Wesley crate APIs.

Name the software contract and include only relevant subsections:

- exported Rust types, traits, or enums
- CLI subcommands, flags, and exit codes
- artifact schema fields (`weslaw/v1`, `wesley.law-diff/v1`, etc.)
- emitted metadata fields
- state transitions or validation gate outcomes
- error behavior and diagnostic codes
- compatibility aliases or migration behavior

This is the section tests should be able to compile or assert against.

## Data / State / Schema Model

Required when state persists, mutates, or crosses a crate or process boundary.

Summarize:

- source of truth
- derived state
- invalid states
- reset behavior
- serialization format and version
- schema versioning or migration behavior
- deterministic clock or runtime assumptions

Use Mermaid diagrams only when they clarify complex state, entity, or data
flows.

## Security / Trust Boundary

Required for module WASM execution, `weslaw` or contract bundle ingestion,
filesystem or network surfaces, or user-provided content.

Describe:

- trusted and untrusted inputs
- sanitizer or validator boundaries
- path traversal or capability escalation handling
- failure behavior for unsafe data
- regression tests or witnesses that prove the boundary

## Agent Inspectability

Describe how an agent can inspect the result without scraping pixels or
inferring from prose.

Examples:

- stable diagnostic codes
- deterministic JSON artifact fields
- machine-readable fixture corpora
- `--json` CLI output shape
- MCP tool schemas
- emitted metadata constants

## Accessibility Posture

Required for CLI or MCP surfaces that produce structured operator output.

| Surface | Requirement |
| ------- | ----------- |
| Exit codes and error envelopes | ... |
| Structured JSON output | ... |
| Human-readable Markdown summaries | ... |
| Agent-safe summary fields | ... |

For purely internal crate work with no operator-facing output, write "Not
applicable — internal crate with no operator surface" and explain briefly.

## Localization / Directionality Posture

Required when user-visible strings, error messages, or diagnostic text are
added or changed.

| String or surface | Requirement |
| ----------------- | ----------- |
| Diagnostic messages | ... |
| CLI help text | ... |
| Report or summary strings | ... |

For purely internal crate work with no user-visible strings, write "Not
applicable" and explain briefly.

## Linked Invariants

List repo invariants this work must preserve. See
[`docs/invariants/`](../invariants/README.md) for the exact set.

Examples:

- `schema-source-of-truth` — Wesley's GraphQL SDL remains sovereign over
  structural shape; this cycle must not invent schema semantics in Holmes.
- `evidence-truth` — Holmes reports must not invent findings that Wesley
  did not emit.
- `governance-boundaries` — capability gates must reject modules that request
  unavailable host imports.
- `docs-runtime-honesty` — docs must describe actual CLI and artifact
  behavior, not aspirational behavior.

## Alternatives Considered

### Option A: {name}

Pros:

- ...

Cons:

- ...

### Option B: {name}

Pros:

- ...

Cons:

- ...

## Decision

State the chosen option and why. If the decision is temporary, name the
expiration, migration window, or follow-on issue.

## Implementation Slices

- [ ] Slice 1:
- [ ] Slice 2:
- [ ] Slice 3:

Each slice should be small enough to commit or review independently and should
correspond to one test case, fixture, golden file, or user story.

## Tests To Write First

Behavior tests required:

- [ ] ...

Documentation or process tests, only if relevant:

- [ ] ...

Rule: documentation tests and golden fixture diffs cannot be the only proof for
product or runtime work.

## Proof Matrix

| Claim | Required proof |
| ----- | -------------- |
| `{behavior exists}` | `{test / fixture / cargo test path}` |

## Acceptance Criteria

The work is done when:

- [ ] Behavior test proves the core contract.
- [ ] CLI or artifact output proves the operator-visible outcome.
- [ ] Schema or artifact compatibility is documented when a versioned format
      changes.
- [ ] Agent-inspectable fields are stable and documented when an MCP surface
      changes.
- [ ] New user-visible strings are accounted for when diagnostic or report
      copy changes.
- [ ] `docs/BEARING.md` campaign status is updated when a campaign slice lands.
- [ ] `CHANGELOG.md` is updated when behavior changes.
- [ ] CI and `cargo xtask preflight` are green.

## Validation Plan

Commands expected before PR:

```bash
cargo xtask preflight
cargo test -p {crate-name}
```

Trim commands that do not apply. Add focused fixture regeneration, golden diff,
lint, or schema validation commands when needed.

## Playback / Witness

Describe what a reviewer can run or inspect.

Examples:

```bash
cargo test -p wesley-holmes -- law_assurance
wesley law validate --bundle fixtures/clean-bundle.json --json
```

If there is a structured JSON output, include the expected shape or a fixture
path a reviewer can diff.

## Open Questions

| Question | Owner | Resolution |
| -------- | ----- | ---------- |
| ... | ... | ... |

## Follow-On Issues

Create GitHub issues for deferred work. Do not hide required future work in
prose.

- ...

## Retrospective

Fill this in after implementation.

What changed from the design:

- ...

What the tests proved:

- ...

What remains open:

- ...

PR:

- [{pull request URL}](https://github.com/flyingrobots/wesley/pull/{number})
