---
title: HLAW-019 LawAssuranceArtifactWriter
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-019 LawAssuranceArtifactWriter

## Feature Overview & Objectives

### Problem Statement

CI and local workflows need deterministic artifacts from validation,
assessment, and rendering: validation JSON, report document JSON, rendered
Markdown, rendered text, and audit-ready metadata. If each command writes files
ad hoc, artifact names, overwrite behavior, byte stability, and directory
creation rules will diverge.

`LawAssuranceArtifactWriter` defines the local output adapter for reproducible
Holmes law assurance artifacts.

### Target User/Audience

- CI maintainers archiving law assurance outputs.
- Local developers comparing generated reports.
- QA engineers snapshotting deterministic artifact bytes.
- Future GitHub publishers linking to local or workflow artifacts.

### Success Metrics

| KPI | Target |
| --- | --- |
| Deterministic bytes | Repeated writes from identical inputs produce byte-identical files. |
| Naming consistency | Artifact filenames follow one documented naming convention. |
| Safe writes | Existing files are not overwritten unless policy explicitly allows it. |

## Scope Definition

### In Scope

- Define default artifact names: validation result, assessment report document,
  rendered Markdown, rendered text, rendered JSON, and writer manifest.
- Define output directory creation, temp-file write, atomic replace, overwrite
  policy, collision handling, and file permissions.
- Define deterministic serialization settings.
- Define writer manifest with artifact role, filename, media type, byte length,
  content hash, and creation clock value.
- Define failure handling for unwritable directories, collisions, partial
  writes, and disk-full simulation.

### Out of Scope

- No remote artifact upload.
- No GitHub Actions artifact API integration.
- No retention or cleanup policy beyond local write behavior.
- No compression or signing.
- No assessment logic.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want Holmes to write predictable artifact names so that workflow upload steps are stable. |
| US-002 | As a QA engineer, I want deterministic bytes and content hashes so that snapshots catch real changes. |
| US-003 | As a local developer, I want safe overwrite controls so that manual artifacts are not lost. |
| US-004 | As a future publisher, I want a writer manifest so that report links can be generated without rediscovering files. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Output directory is empty | Holmes writes validation and report artifacts | Files use documented names and roles. |
| US-002 | The same report is written twice to separate directories | Holmes writes artifacts | File bytes and content hashes match. |
| US-003 | A target file exists and overwrite is false | Holmes writes artifacts | Writer fails before replacing the file. |
| US-004 | Artifacts are written successfully | Holmes writes writer manifest | Manifest lists role, path, media type, byte length, and hash for each artifact. |
| US-004 | A write fails after temp file creation | Holmes handles failure | Partial temp files are cleaned up where possible and final manifest is not written as success. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Write complete artifact set | Happy | report and validation fixtures | Files and manifest written. |
| TS-002 | Repeat write in fresh directory | Happy | same inputs | Byte-identical outputs. |
| TS-003 | Collision without overwrite | Negative | existing report file | Collision diagnostic. |
| TS-004 | Atomic overwrite enabled | Edge | existing generated file | Atomic replace and updated manifest. |
| TS-005 | Unwritable directory | Negative | permission-denied temp dir | Infrastructure diagnostic. |
| TS-006 | Disk-full simulation | Edge | fake writer adapter | Partial write failure, no success manifest. |

### Happy Path Testing

1. Write validation result, report document, Markdown, text, and JSON renderings
   to an empty temp directory.
2. Verify filenames, media types, byte counts, hashes, and manifest contents.
3. Repeat in a second temp directory and compare hashes.
4. Assert all writes use injected clock for manifest timestamps.

### Negative/Edge Case Testing

- Invalid inputs: empty output dir path, output path outside workspace, file
  where directory is expected, collision without overwrite, invalid media type,
  manifest hash mismatch after write, and non-UTF-8 rendered text.
- Timeouts: fake writer timeout produces infrastructure diagnostic and no
  success manifest.
- Concurrent users or retries: concurrent writes to same directory must fail or
  lock according to documented collision policy; distinct directories succeed.
- Broken dependencies: filesystem errors are surfaced without changing domain
  assessment results.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Write a 25 MB artifact set in under 2 seconds on local disk. | Temp-directory benchmark. |
| Load | Writer manifest handles 1,000 artifacts without quadratic sorting. | Synthetic artifact list. |
| Security | Output paths are workspace-confined by default. | Traversal and symlink output tests. |
| Accessibility | Rendered text and Markdown artifacts preserve headings and status labels. | Snapshot generated outputs. |
