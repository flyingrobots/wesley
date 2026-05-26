---
title: HLAW-018 holmes weslaw report CLI
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-018 `holmes weslaw report` CLI

## Feature Overview & Objectives

### Problem Statement

Assessment and rendering are separate concerns. Operators need a command that
renders an existing `LawAssuranceReportDocument` into terminal text, Markdown,
or JSON without revalidating evidence or re-evaluating gates. This allows CI
pipelines to archive structured reports once, then render them for different
surfaces.

### Target User/Audience

- CI workflows rendering saved law reports into artifacts.
- Local developers previewing Markdown before PR publication.
- GitHub publishers reusing Markdown from an existing report.
- QA engineers snapshotting renderer behavior separately from assessment.

### Success Metrics

| KPI | Target |
| --- | --- |
| Separation of concerns | Report command never reads raw law diff, coverage, or manifest artifacts. |
| Renderer parity | Markdown, text, and JSON renderers use the same report document input. |
| Output safety | File overwrite behavior is explicit and deterministic. |

## Scope Definition

### In Scope

- Define command: `holmes weslaw report --report <path> --format text|markdown|json`.
- Support `--output <path>`, `--overwrite`, and stdout behavior.
- Validate report document version before rendering.
- Define Markdown, terminal text, and JSON rendering requirements at a product
  level.
- Define snapshot tests for each renderer and overwrite policy.

### Out of Scope

- No evidence validation.
- No gate evaluation.
- No GitHub publishing.
- No report mutation except renderer-specific output.
- No remote report loading.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want to render a saved report to Markdown so that it can be uploaded or posted later. |
| US-002 | As a local developer, I want terminal text output so that I can inspect assessment results quickly. |
| US-003 | As a QA engineer, I want renderer snapshots so that presentation drift is visible. |
| US-004 | As an operator, I want explicit overwrite controls so that report artifacts are not accidentally replaced. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A valid report document path and `--format markdown` | The command runs | Markdown is emitted to stdout or output path without re-running assessment. |
| US-002 | A valid report and `--format text` | The command runs | Terminal-safe text includes verdict, gates, and section summaries. |
| US-003 | The same report is rendered twice | The command runs | Output bytes are identical for the same format and width setting. |
| US-004 | Output file exists and `--overwrite` is absent | The command runs | Command fails with overwrite diagnostic and leaves file unchanged. |
| US-004 | Report document version is unsupported | The command runs | Command fails with unsupported report version diagnostic. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Markdown render | Happy | complete report fixture | Markdown snapshot. |
| TS-002 | Text render | Happy | complete report fixture | Text snapshot. |
| TS-003 | JSON pass-through render | Happy | complete report fixture | Normalized JSON snapshot. |
| TS-004 | Existing output without overwrite | Negative | temp output path exists | Overwrite diagnostic. |
| TS-005 | Unsupported report version | Negative | future report fixture | Unsupported version diagnostic. |
| TS-006 | Large report render | Load | 10,000 findings report | Truncated display, valid output. |

### Happy Path Testing

1. Render the same valid report to text, Markdown, and JSON.
2. Assert renderers use section order from the report document.
3. Verify stdout and file-output modes.
4. Snapshot output with stable width and color disabled.

### Negative/Edge Case Testing

- Invalid inputs: missing `--report`, missing file, malformed report JSON,
  unsupported version, unknown format, invalid output path, existing output
  without overwrite, and directory output path.
- Timeouts: file read/write timeout is an infrastructure error; rendering is
  CPU-only after bytes load.
- Concurrent users or retries: rendering to the same output path without
  overwrite must fail deterministically; distinct paths can run concurrently.
- Broken dependencies: no GitHub or network dependency is allowed.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Render a 10,000-finding report to Markdown under 1 second. | Renderer benchmark. |
| Load | Large reports must preserve machine-readable counts even when display rows truncate. | Large report fixture. |
| Security | Markdown renderer must escape untrusted law ids, subjects, and paths. | Injection fixtures. |
| Accessibility | Text and Markdown include headings and status words, not color-only signals. | Snapshot with color disabled and heading assertions. |
