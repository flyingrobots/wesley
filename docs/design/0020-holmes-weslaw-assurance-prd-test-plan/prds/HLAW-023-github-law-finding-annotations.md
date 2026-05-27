---
title: HLAW-023 GitHubLawFindingAnnotations
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-023 GitHubLawFindingAnnotations

## Feature Overview & Objectives

### Problem Statement

Some law findings have source file and line context, but many are bundle-level
or artifact-level. Holmes needs a safe mapping from findings to GitHub
annotations where line context exists, with deterministic fallback to PR comment
bullets where it does not. Bad annotation mapping can create noisy, misleading,
or rate-limited reviews.

### Target User/Audience

- PR reviewers looking for inline context.
- GitHub adapter developers implementing annotation publishing.
- CI maintainers concerned about API rate limits.
- QA engineers testing deduplication and no-line fallback behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Annotation eligibility | 100% of annotations require file path, line, severity, and source artifact context. |
| Fallback safety | Findings without line context remain visible in summary comments. |
| Rate-limit control | Annotation count respects configurable maximums with omitted counts. |

## Scope Definition

### In Scope

- Define annotation eligibility for findings with workspace-relative file path
  and valid line range.
- Define annotation fields: path, start line, end line, severity, title,
  message, finding id, law id, subject, and artifact reference.
- Define deduplication by finding id and source location.
- Define fallback row generation for no-line or invalid-line findings.
- Define rate-limit and max-annotation truncation behavior.

### Out of Scope

- No GitHub API implementation details.
- No Checks API decision.
- No attempt to infer line numbers from raw law ids.
- No source file mutation.
- No resolving stale annotations after file changes beyond deterministic
  eligibility checks.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a reviewer, I want inline annotations for findings with precise source lines so that I can inspect law changes near source. |
| US-002 | As a reviewer, I want no-line findings still visible so that bundle-level issues are not lost. |
| US-003 | As a CI maintainer, I want annotation limits so that large reports do not exhaust GitHub API budgets. |
| US-004 | As a QA engineer, I want deterministic deduplication so that reruns do not duplicate annotations. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A finding has valid file and line context | Holmes maps annotations | One annotation candidate is produced. |
| US-002 | A finding lacks line context | Holmes maps annotations | No annotation is produced and fallback comment item is emitted. |
| US-003 | Eligible annotations exceed max count | Holmes maps annotations | First deterministic set is emitted and omitted count is recorded. |
| US-004 | Two findings share id and location | Holmes maps annotations | Duplicate annotation is suppressed. |
| US-004 | A line number is outside file bounds when bounds are available | Holmes maps annotations | Finding falls back to summary item with invalid-location reason. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Finding with valid source line | Happy | finding with path/line | Annotation candidate. |
| TS-002 | Bundle-level finding | Happy | no-line finding | Fallback item. |
| TS-003 | Duplicate finding location | Edge | duplicate finding ids | One annotation. |
| TS-004 | Max annotations exceeded | Load | 1,000 eligible findings | Truncated annotations and omitted count. |
| TS-005 | Invalid path escape | Security | path `../law.json` | No annotation, security diagnostic. |
| TS-006 | Invalid line range | Negative | start line greater than end | Fallback with invalid-location reason. |

### Happy Path Testing

1. Map a mixed finding set with line and no-line findings.
2. Assert valid-line findings produce annotation candidates.
3. Assert no-line findings produce fallback comment items.
4. Verify deterministic order and deduplication.

### Negative/Edge Case Testing

- Invalid inputs: path traversal, absolute path when disabled, invalid line
  range, missing severity, missing finding id, duplicate candidate, and too many
  annotations.
- Timeouts: annotation mapping does not call GitHub; optional file-bound checks
  use injected repository file metadata.
- Concurrent users or retries: mapping is pure and deterministic.
- Broken dependencies: absent file metadata does not block annotation creation
  if line context is syntactically valid, but records unchecked bounds.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Map 10,000 findings in under 300 ms. | Synthetic finding benchmark. |
| Load | Annotation truncation must preserve omitted counts. | Large eligible finding fixture. |
| Security | Annotation paths are workspace-relative and sanitized. | Traversal and absolute path fixtures. |
| Accessibility | Annotation messages include text severity and law id. | Contract test annotation fields. |
