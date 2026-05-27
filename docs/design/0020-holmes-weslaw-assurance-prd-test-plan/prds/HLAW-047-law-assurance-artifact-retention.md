---
title: HLAW-047 LawAssuranceArtifactRetention
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-047 LawAssuranceArtifactRetention

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance will write local artifacts, CI artifacts, PR comment links,
audit witnesses, and future dashboard references. If retention rules are not
explicit, operators can lose the evidence needed to debug a failed gate, PR
comments can point to stale or inaccessible files, and local runs can
accumulate unbounded data. Retention rules must balance traceability,
determinism, storage cost, and fork-safe publication.

### Target User/Audience

- CI maintainers configuring artifact upload and cleanup.
- Local developers running repeated assessments.
- Release managers preserving evidence for merge decisions.
- GitHub publisher adapter implementers.
- Security reviewers checking fork and token behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Retention coverage | Local, CI, PR comment, audit witness, and future dashboard artifact lifecycles are documented. |
| Link safety | PR comments never publish file paths or URLs that are known inaccessible to the PR author context. |
| Cleanup determinism | Local cleanup removes only Holmes-owned run directories and preserves pinned evidence by default. |

## Scope Definition

### In Scope

- Define artifact naming scheme for local runs, CI runs, PR comments, audit
  witness files, and future dashboard handles.
- Define default retention periods and cleanup rules for local `.wesley-cache`
  output versus CI-uploaded artifacts.
- Define overwrite behavior for reruns, retries, and repeated commits.
- Define stale link detection and warning behavior for PR comments.
- Define fork-safe behavior when artifact upload, comment publication, or token
  permissions are unavailable.
- Define pinned evidence behavior for release gates and audit replay.

### Out of Scope

- No hosted dashboard implementation.
- No object-store integration.
- No artifact signing beyond consuming existing bundle and law hashes.
- No cleanup of non-Holmes files.
- No retention policy for external repos outside the current Wesley workflow.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a local developer, I want repeated Holmes law assurance runs to write predictable artifact directories so that I can compare outputs without guessing filenames. |
| US-002 | As a CI maintainer, I want artifact retention periods and names documented so that workflow storage stays bounded. |
| US-003 | As a release manager, I want failed gate evidence retained long enough to audit a merge decision. |
| US-004 | As a fork PR contributor, I want the workflow to avoid publishing inaccessible or privileged artifact links. |
| US-005 | As a GitHub publisher adapter, I want stale link rules so that comments do not imply unavailable evidence is reviewable. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Developer runs assessment twice for the same commit | Artifacts are written locally | Runs use deterministic run ids or sequence ids and do not overwrite pinned evidence. |
| US-002 | CI uploads law assurance artifacts | Retention policy is applied | Artifact names include PR or commit identity, schema family, and run purpose. |
| US-003 | A release gate fails | Holmes writes audit evidence | Evidence is marked retention-required and referenced from report metadata. |
| US-004 | Workflow runs on an untrusted fork | Publisher checks permissions | GitHub comment omits privileged links and includes local artifact names instead. |
| US-005 | Previously published artifact link is no longer available | Publisher renders next comment | Comment marks the previous link stale and points to current retained evidence if available. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Local happy path | Happy | two local assessment runs | Deterministic directories, no pinned overwrite. |
| TS-002 | CI artifact naming | Happy | PR run context | Names include PR number, commit SHA, and artifact family. |
| TS-003 | Cleanup old unpinned runs | Happy | local cache with old runs | Only Holmes-owned expired runs removed. |
| TS-004 | Preserve pinned failed gate | Edge | pinned release evidence | Cleanup skips pinned evidence. |
| TS-005 | Fork-safe publication | Security | read-only fork context | No privileged links emitted. |
| TS-006 | Stale comment link | Edge | previous missing artifact URL | Stale link warning emitted. |
| TS-007 | Broken upload dependency | Negative | artifact upload unavailable | Report records unavailable artifact with deterministic diagnostic. |

### Happy Path Testing

1. Run local validate, assess, report, and artifact writer over a clean bundle.
2. Assert artifact directory names are deterministic and include run purpose.
3. Simulate CI context with PR number and commit SHA.
4. Assert uploaded artifact names match retention policy.
5. Render a GitHub comment with accessible artifact references.
6. Assert audit witness records retained artifact identifiers.

### Negative/Edge Case Testing

- Invalid inputs: malformed retention config, negative retention days, missing
  run id, path traversal in artifact names, duplicate artifact ids, and cleanup
  roots outside Holmes-owned directories.
- Timeouts: artifact upload timeout becomes publisher-unavailable diagnostic;
  local artifact writing remains complete.
- Concurrent users or retries: concurrent runs must not race on the same output
  directory unless the run id is explicitly identical and idempotent.
- Broken dependencies: missing GitHub token, artifact upload failure, read-only
  filesystem, and stale artifact URL are reported without losing local evidence.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Cleanup over 1,000 local run directories completes in under 2 seconds. | Generated cache fixture. |
| Load | Retention metadata handles at least 500 artifact references in one report. | Large report fixture. |
| Security | Artifact paths are relative, normalized, and cannot escape Holmes output root. | Path traversal tests. |
| Accessibility | Stale and unavailable artifact states are text labels, not color-only signals. | Snapshot report and comment rendering. |
