---
title: HLAW-021 GitHubLawAssuranceComment
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-021 GitHubLawAssuranceComment

## Feature Overview & Objectives

### Problem Statement

Reviewers need a concise PR comment that summarizes Holmes `weslaw` assurance
without dumping full JSON or duplicating comments on every CI rerun. The comment
must be idempotent, clearly marked as Holmes output, and faithful to the report
document. It must not hide validation errors behind polished summaries or imply
that Holmes owns Wesley semantic truth.

### Target User/Audience

- PR reviewers reading law assurance evidence in GitHub.
- CI maintainers configuring comment publishing.
- Holmes adapter developers implementing GitHub output.
- QA engineers testing idempotent updates and Markdown safety.

### Success Metrics

| KPI | Target |
| --- | --- |
| Idempotent publishing | Repeated runs update one sticky comment instead of creating duplicates. |
| Reviewer usefulness | Comment includes verdict, gate summary, high-risk findings, and artifact links when available. |
| Markdown safety | Untrusted law ids, subjects, and paths are escaped in rendered Markdown. |

## Scope Definition

### In Scope

- Define a sticky PR comment body for `LawAssuranceReportDocument`.
- Define hidden marker format, update behavior, author matching, and stale
  comment replacement.
- Include summary verdict, validation status, gate table, semantic diff
  highlights, coverage summary, capability posture disclaimer, provenance hash
  family, and evidence links.
- Define truncation and "details omitted" behavior.
- Define behavior when validation fails and no assessment report exists.

### Out of Scope

- No GitHub Check Run API implementation.
- No inline annotation creation.
- No merge decision or branch protection mutation.
- No CodeRabbit interaction.
- No artifact upload.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a PR reviewer, I want one updated Holmes law assurance comment so that I can review current evidence without comment spam. |
| US-002 | As a CI maintainer, I want validation failures rendered clearly so that broken evidence wiring is not mistaken for a law failure. |
| US-003 | As a Holmes adapter developer, I want a stable hidden marker so that comment updates are deterministic. |
| US-004 | As a QA engineer, I want Markdown injection fixtures so that untrusted law fields are escaped. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A PR already has a Holmes law comment marker | Publisher runs again | The existing comment is updated rather than creating a new one. |
| US-002 | Evidence validation fails | Publisher renders comment | Comment headline says validation failed and omits assurance verdict claims. |
| US-003 | No prior marker exists | Publisher runs | A new comment is created with the hidden marker. |
| US-004 | Law id contains Markdown table syntax | Renderer builds comment | The law id is escaped or code-formatted safely. |
| US-004 | Report exceeds max comment size | Renderer builds comment | Comment truncates deterministically and links to full artifact when available. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | First publish | Happy | report fixture, no prior comment | New marked comment. |
| TS-002 | Update existing comment | Happy | prior marker comment | Single comment updated. |
| TS-003 | Validation failure | Negative | validation result only | Validation failure comment. |
| TS-004 | Large report | Load | 10,000 findings report | Truncated comment and omitted counts. |
| TS-005 | Markdown injection | Security | crafted law ids | Escaped Markdown. |
| TS-006 | GitHub API failure | Edge | fake publisher error | Publisher failure surfaced separately. |

### Happy Path Testing

1. Render a comment from a passing report fixture.
2. Publish to a fake GitHub comment store with no marker.
3. Publish again with updated report contents.
4. Assert one comment exists and contains current verdict, gates, provenance,
   and evidence links.

### Negative/Edge Case Testing

- Invalid inputs: missing report and missing validation result, duplicate
  existing markers, malformed artifact links, comment body over GitHub size
  limit, missing PR number, and unauthorized publisher.
- Timeouts: GitHub API timeout maps to publisher failure, not assessment
  failure.
- Concurrent users or retries: concurrent publishers must use marker lookup and
  update semantics to avoid duplicate comments where GitHub API permits.
- Broken dependencies: if GitHub is unavailable, local artifacts remain valid
  and publishing failure is reported separately.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Render comment from a large report in under 500 ms. | Renderer benchmark. |
| Load | Comment body must stay under configured size limit with omitted counts. | Large report fixture. |
| Security | Escape Markdown and HTML-sensitive fields. | Injection fixture snapshots. |
| Accessibility | Comment uses headings, tables, and text statuses independent of color. | Markdown snapshot review. |
