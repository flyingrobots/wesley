---
title: HLAW-006 WeslawArtifactLocator
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-006 WeslawArtifactLocator

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance needs to resolve evidence artifacts from local CLI flags,
bundle metadata, and CI workflow paths. If path resolution is duplicated across
commands and publishers, the system will produce inconsistent diagnostics,
security posture, and path precedence. Artifact location must be deterministic,
workspace-confined by default, and testable without network or wall-clock
dependencies.

`WeslawArtifactLocator` is the adapter boundary that resolves local law evidence
references into loaded artifact bytes and source metadata for ingest ports.

### Target User/Audience

- CLI operators supplying artifact paths manually.
- GitHub workflow maintainers passing workspace-relative paths from CI jobs.
- Holmes application services that need loaded bytes without knowing filesystem
  policy.
- Security reviewers checking path traversal and symlink behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Resolution determinism | The same bundle and flag inputs resolve to the same ordered artifact list on repeated runs. |
| Security coverage | 100% of path traversal, symlink escape, and missing-file cases have stable diagnostics. |
| Adapter reuse | All first-chunk ingest ports receive bytes through the same locator contract. |

## Scope Definition

### In Scope

- Define path resolution precedence: explicit CLI flag, bundle artifact path,
  bundle manifest relative reference, and workflow-provided artifact directory.
- Normalize workspace-relative paths against an explicit workspace root.
- Reject path traversal, symlink escape, unsupported URI schemes, directory
  paths where files are required, unreadable files, and duplicate resolved
  canonical paths.
- Return loaded bytes plus artifact role, original reference, canonical path,
  file size, and optional content hash.
- Provide in-memory test locator behavior for deterministic unit tests.

### Out of Scope

- No remote artifact download in this slice.
- No GitHub Actions artifact API calls in this slice.
- No caching layer beyond one locator invocation.
- No automatic discovery of artifacts by glob unless a later feature explicitly
  designs it.
- No mutation, cleanup, or writing of artifact files.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CLI operator, I want explicit flags to override bundle-relative defaults so that I can test replacement artifacts locally. |
| US-002 | As a CI maintainer, I want workspace-confined path resolution so that untrusted PR inputs cannot make Holmes read arbitrary files. |
| US-003 | As a Holmes developer, I want loaded bytes tagged with artifact roles so that ingest ports produce precise diagnostics. |
| US-004 | As a QA engineer, I want an in-memory locator so that ingest tests do not rely on wall-clock, filesystem layout, or shell state. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Both `--law-diff path/a.json` and a bundle `lawDiff.path` are present | The locator resolves the law diff role | The explicit CLI path wins and the source metadata records the override. |
| US-002 | A bundle path resolves to `../secrets.json` outside the workspace | The locator resolves artifacts | Resolution fails with `HLAW_ARTIFACT_PATH_ESCAPE`. |
| US-002 | A symlink inside the workspace points outside the workspace | The locator canonicalizes it | Resolution fails with `HLAW_ARTIFACT_SYMLINK_ESCAPE`. |
| US-003 | A law coverage artifact is unreadable | The locator loads it | The error includes artifact role `lawCoverage` and the original path reference. |
| US-004 | A unit test supplies in-memory bytes for `lawDiff` | The application requests the artifact | The in-memory locator returns bytes with deterministic metadata and no filesystem access. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Explicit flag overrides bundle path | Happy | temp workspace with two law diff files | Explicit path loaded and override recorded. |
| TS-002 | Bundle-relative path resolution | Happy | `fixtures/hlaw/bundles/clean-release.json` | Artifact loaded relative to bundle directory. |
| TS-003 | Path traversal attempt | Security | path `../outside.json` | `HLAW_ARTIFACT_PATH_ESCAPE`. |
| TS-004 | Symlink escape | Security | symlink fixture | `HLAW_ARTIFACT_SYMLINK_ESCAPE`. |
| TS-005 | Missing file | Negative | missing law coverage path | `HLAW_ARTIFACT_NOT_FOUND`. |
| TS-006 | Directory supplied as file | Edge | directory path for manifest | `HLAW_ARTIFACT_NOT_FILE`. |
| TS-007 | Large artifact file | Load | 25 MB generated JSON file | Load succeeds or fails with documented size diagnostic if over budget. |

### Happy Path Testing

1. Create a temporary workspace containing a bundle and all required artifacts.
2. Resolve artifacts using bundle-relative paths only.
3. Resolve again with an explicit override for one role.
4. Verify deterministic artifact order, canonical path metadata, byte lengths,
   and role labels.

### Negative/Edge Case Testing

- Invalid inputs: empty path strings, unsupported URI schemes, absolute paths
  when absolute mode is disabled, path traversal, symlink escape, directories,
  missing files, unreadable files, duplicate canonical paths, and files over the
  configured size limit.
- Timeouts: inject a filesystem adapter timeout and assert
  `HLAW_ARTIFACT_READ_TIMEOUT` with no retry loop in the domain layer.
- Concurrent users or retries: concurrent resolution of the same workspace must
  not mutate shared process working directory or global path state.
- Broken dependencies: unavailable filesystem adapter returns an infrastructure
  error mapped to input validation, not an assurance finding.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Resolve and read five 5 MB artifacts in under 1 second on local disk. | Temp-file benchmark with deterministic fixture bytes. |
| Load | Enforce a documented per-artifact and total-byte budget before parsing. | Generate files just below and above configured limits. |
| Security | Workspace confinement must happen after canonicalization and symlink resolution. | Path traversal and symlink escape fixtures on supported platforms. |
| Accessibility | Diagnostics must name role, original reference, and normalized path when safe. | Snapshot text diagnostics with color disabled. |
