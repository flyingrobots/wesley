---
title: HLAW-024 GitHubLawEvidenceLinks
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-024 GitHubLawEvidenceLinks

## Feature Overview & Objectives

### Problem Statement

GitHub comments and summaries should link reviewers to law evidence artifacts,
CI runs, bundle manifests, and rendered reports. Links must be explicit,
sanitized, and honest about retention or expiration. Broken or unsafe links
make assurance output hard to audit and can expose reviewers to untrusted URL
content.

### Target User/Audience

- PR reviewers opening full law reports and raw evidence artifacts.
- CI maintainers configuring artifact retention and URL generation.
- Holmes GitHub adapter developers.
- QA engineers testing missing, expired, and unsafe links.

### Success Metrics

| KPI | Target |
| --- | --- |
| Link traceability | Every published evidence link includes role, label, URL, and retention note where known. |
| Safety | Unsafe URL schemes are rejected before Markdown rendering. |
| Missing-link clarity | Missing artifacts produce unavailable link rows, not broken Markdown. |

## Scope Definition

### In Scope

- Define evidence link objects for report document, validation result, law diff,
  coverage report, capability summary, bundle manifest, CI run, and workflow
  artifact.
- Define allowed URL schemes and Markdown link escaping.
- Define retention metadata: expiresAt, retentionDays, unavailable, unknown, or
  local-only.
- Define missing artifact behavior and stale link warnings.
- Define ordering and grouping in GitHub comments.

### Out of Scope

- No upload of artifacts.
- No GitHub API calls to discover artifact URLs.
- No link shortening service.
- No dashboard or static site.
- No authentication or signed URL generation.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a reviewer, I want links to full reports and raw evidence so that I can audit summary claims. |
| US-002 | As a CI maintainer, I want retention notes so that reviewers understand when workflow artifacts may expire. |
| US-003 | As a security reviewer, I want unsafe link schemes rejected so that PR comments cannot publish malicious links. |
| US-004 | As a QA engineer, I want missing links represented explicitly so snapshots do not contain broken anchors. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Report artifact URL is available | Holmes builds link set | Link includes role `reportDocument`, label, URL, and media type. |
| US-002 | Artifact retention is 14 days | Holmes builds link set | Link metadata includes retention note. |
| US-003 | URL uses `javascript:` scheme | Holmes validates link | Link is rejected with unsafe scheme diagnostic. |
| US-004 | Coverage artifact was unavailable | Holmes builds link set | Coverage link row is marked unavailable without Markdown URL. |
| US-004 | A local-only path has no public URL | Holmes builds GitHub links | Link row states local-only and does not expose unsafe absolute paths. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Complete CI link set | Happy | report with artifact URLs | Grouped evidence links. |
| TS-002 | Missing optional coverage link | Edge | unavailable coverage | Unavailable row. |
| TS-003 | Unsafe scheme | Security | `javascript:` URL | Link validation failure. |
| TS-004 | Expiring artifact | Happy | expiresAt metadata | Retention note. |
| TS-005 | Long URL | Edge | very long artifact URL | Escaped and preserved. |
| TS-006 | Local absolute path | Security | `/Users/...` path | Not published by default. |

### Happy Path Testing

1. Build evidence links from report attachments and CI metadata.
2. Verify roles, labels, URLs, media types, and retention notes.
3. Render Markdown link rows through a test renderer.
4. Snapshot deterministic ordering.

### Negative/Edge Case Testing

- Invalid inputs: unsafe URL scheme, missing label, duplicate role/id, malformed
  URL, local absolute path, missing retention metadata, and expired artifact.
- Timeouts: link construction performs no network checks.
- Concurrent users or retries: link ordering is deterministic and pure.
- Broken dependencies: missing CI metadata yields unavailable links rather than
  failing assessment.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build 1,000 evidence links in under 50 ms. | Synthetic link benchmark. |
| Load | Link grouping handles large attachment sets without duplicate scans. | Large attachment fixture. |
| Security | Allow only `https` and explicitly approved repository-relative link schemes. | Unsafe scheme fixture suite. |
| Accessibility | Link labels describe destination role, not "click here". | Snapshot link labels. |
