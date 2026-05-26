---
title: HLAW-045 LawAssuranceOperatorDocs
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-045 LawAssuranceOperatorDocs

## Feature Overview & Objectives

### Problem Statement

Operators need clear documentation for generating Wesley law evidence, running
Holmes validation and assessment, reading findings, handling failures, and
publishing or inspecting reports. Without operator docs, even a correct Rust
implementation will be difficult to adopt and likely misused in CI.

### Target User/Audience

- Local developers running law assurance before PRs.
- CI maintainers wiring law assurance into workflows.
- Release managers interpreting failed gates.
- Agents and reviewers following troubleshooting paths.

### Success Metrics

| KPI | Target |
| --- | --- |
| Command coverage | Docs include examples for validate, assess, report, artifact writing, and GitHub/MCP inspection. |
| Troubleshooting completeness | Docs cover validation failure, failed gates, unavailable evidence, stale hashes, and publisher failures. |
| Accessibility | Examples and tables are readable without color and do not rely on screenshots. |

## Scope Definition

### In Scope

- Define planned docs locations for operator guide, CI integration guide,
  troubleshooting matrix, command reference, GitHub comment guide, MCP resource
  guide, and FAQ.
- Define required command examples for generating Wesley artifacts, assembling
  bundle, validating, assessing, rendering, writing artifacts, and publishing.
- Define troubleshooting matrix by symptom, likely cause, command to run, and
  remediation.
- Define docs validation checks for links, command snippets, fixture references,
  and accessibility.
- Define update rule: operator docs must change whenever command flags, exit
  codes, artifact paths, or report fields change.

### Out of Scope

- No final operator docs are written in this PRD slice.
- No screenshots or marketing pages.
- No live hosted documentation site.
- No product tutorial for GraphQL or `weslaw` authoring beyond links to Wesley
  docs.
- No support escalation process.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a local developer, I want a copy/paste-safe command path so that I can validate law evidence before opening a PR. |
| US-002 | As a CI maintainer, I want workflow examples so that law assurance artifacts are generated and archived correctly. |
| US-003 | As a release manager, I want troubleshooting guidance for failed gates and stale evidence. |
| US-004 | As a docs reviewer, I want command snippets and links checked automatically. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Developer opens operator guide | They follow local commands | The guide shows validate, assess, report, and artifact output examples with placeholders clearly marked. |
| US-002 | CI maintainer opens integration guide | They copy workflow outline | The guide names job order, artifact paths, permissions, and fork-safe publishing posture. |
| US-003 | Release gate fails on traceability | Operator reads troubleshooting matrix | Matrix points to bundle hash mismatch, evidence artifact links, and rerun guidance. |
| US-004 | Command flag changes in implementation | Docs check runs | Missing docs update is caught by command snippet or reference check. |
| US-004 | Docs include external link | Link check runs | Broken link fails docs validation. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Local happy-path docs | Happy | operator guide command snippets | Snippets parse and reference known fixtures. |
| TS-002 | CI guide docs | Happy | workflow guide | Artifact paths and permissions documented. |
| TS-003 | Troubleshooting stale evidence | Negative | matrix row | Stale hash remediation present. |
| TS-004 | Broken docs link | Negative | invalid link fixture | Link checker fails. |
| TS-005 | Missing command flag docs | Negative | command manifest diff | Docs coverage check fails. |
| TS-006 | Accessibility review | Happy | Markdown docs | Headings, tables, text statuses pass. |

### Happy Path Testing

1. Validate all operator docs links.
2. Extract command snippets and compare command names/flags to the CLI manifest.
3. Validate fixture references exist.
4. Review troubleshooting matrix rows for validation failure, failed gate,
   unavailable evidence, stale evidence, publisher failure, and internal error.

### Negative/Edge Case Testing

- Invalid inputs: broken links, stale command flags, missing fixture references,
  outdated exit code table, missing fork-safety warning, docs using screenshots
  as sole information, and absolute local paths.
- Timeouts: docs checks must be local and deterministic; external link checks
  should be pinned or separated to avoid flaky PR validation.
- Concurrent users or retries: docs generation/checks are read-only and
  deterministic.
- Broken dependencies: if CLI manifest is unavailable, docs command parity check
  reports infrastructure error instead of silently passing.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Docs checks complete in under 30 seconds in CI. | Docs validation benchmark. |
| Load | Troubleshooting matrix remains scan-friendly under 50 rows. | Markdown lint and reviewer checklist. |
| Security | Docs do not include secrets, local absolute paths, or privileged token examples. | Secret/path lint. |
| Accessibility | Docs use headings, tables, and text status labels; no screenshot-only instructions. | Accessibility checklist and Markdown snapshots. |
