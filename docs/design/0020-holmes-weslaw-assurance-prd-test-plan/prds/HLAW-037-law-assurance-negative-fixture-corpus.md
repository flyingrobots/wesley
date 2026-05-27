---
title: HLAW-037 LawAssuranceNegativeFixtureCorpus
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-037 LawAssuranceNegativeFixtureCorpus

## Feature Overview & Objectives

### Problem Statement

Holmes must fail safely on malformed, unsupported, unauthorized, stale, and
contradictory `weslaw` assurance evidence. A negative fixture corpus is required
so invalid inputs never accidentally produce findings, gates, reports, or
success artifacts. The corpus must distinguish validation failures from
assessment failures and infrastructure errors.

### Target User/Audience

- QA engineers building validation and panic-free guarantees.
- Holmes implementers verifying error taxonomy.
- Security reviewers testing path and link handling.
- CI maintainers ensuring invalid evidence fails early.

### Success Metrics

| KPI | Target |
| --- | --- |
| Error coverage | Every validation diagnostic family has at least one negative fixture. |
| Panic-free behavior | 100% of negative fixtures return typed diagnostics instead of panics. |
| Failure isolation | Invalid evidence fixtures emit zero assurance findings and zero gate decisions. |

## Scope Definition

### In Scope

- Define `fixtures/hlaw/negative/` as the planned negative corpus root.
- Include invalid JSON, unsupported versions, missing required artifacts,
  invalid hashes, hash mismatches, unknown profiles, malformed policies,
  unsafe paths, unsafe URLs, duplicate ids, contradictory capability posture,
  broad suppressions, expired suppressions, and unauthorized MCP resources.
- Define expected diagnostic codes, exit categories, and no-assessment
  guarantees.
- Define isolation rules so each fixture fails for one primary reason unless it
  is explicitly a multi-error fixture.
- Define panic-free and no-success-artifact assertions.

### Out of Scope

- No fuzzing engine in this slice.
- No negative fixture implementation files in this PRD slice.
- No live GitHub API failure simulation.
- No remote URL fetch tests.
- No runtime handler access violation tests.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a QA engineer, I want one negative fixture per diagnostic family so that error coverage is measurable. |
| US-002 | As a Holmes implementer, I want invalid evidence to stop before assessment so that bad inputs cannot become findings. |
| US-003 | As a security reviewer, I want unsafe path and URL fixtures so that publishing and artifact loading remain safe. |
| US-004 | As a CI maintainer, I want expected exit categories for each negative fixture so that regressions break fast. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A diagnostic code exists in the validation taxonomy | Corpus coverage is checked | At least one negative fixture declares that code as its primary expected diagnostic. |
| US-002 | A malformed law diff fixture is evaluated | Holmes validates evidence | Validation fails and no assessment report is produced. |
| US-003 | A bundle path escapes workspace root | Artifact locator runs | Fixture expects `HLAW_ARTIFACT_PATH_ESCAPE` and no file content read. |
| US-004 | An unknown profile policy fixture runs through CLI assessment | Command exits | Exit category is usage or validation failure as documented, not success. |
| US-004 | A multi-error fixture is marked `multiError: true` | Corpus validation runs | Multiple diagnostics are allowed and sorted deterministically. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Malformed bundle JSON | Negative | `negative/bundle-malformed-json` | Malformed JSON diagnostic. |
| TS-002 | Unsupported law diff version | Negative | `negative/law-diff-unsupported-version` | Unsupported version diagnostic. |
| TS-003 | Missing required manifest | Negative | `negative/missing-manifest` | Missing required artifact diagnostic. |
| TS-004 | Unsafe path traversal | Security | `negative/path-traversal` | Workspace escape diagnostic. |
| TS-005 | Unsafe evidence link | Security | `negative/link-unsafe-scheme` | Unsafe URL diagnostic. |
| TS-006 | Contradictory capability posture | Negative | `negative/capability-contradiction` | Contradiction diagnostic. |

### Happy Path Testing

1. Validate the negative corpus index.
2. For each fixture, run the command or domain validator named in metadata.
3. Assert the expected primary diagnostic, exit category, and no-success-output
   guarantees.
4. Snapshot diagnostic order for multi-error fixtures.

### Negative/Edge Case Testing

- Invalid inputs: negative fixture metadata missing primary diagnostic, fixture
  that unexpectedly passes, fixture that emits a different primary diagnostic,
  fixture with local absolute path, and fixture that produces success artifact.
- Timeouts: timeout fixtures must use injected fake adapters, not real sleeps.
- Concurrent users or retries: negative fixtures must be read-only and safe for
  parallel test execution.
- Broken dependencies: if a fixture references missing expected output, corpus
  validation fails before the negative test body runs.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Negative corpus validation completes in under 1 second for 200 fixtures. | Fixture index benchmark. |
| Load | Multi-error fixtures can assert at least 100 diagnostics without unstable ordering. | Synthetic multi-error fixture. |
| Security | Corpus lint rejects absolute paths, unsafe URLs, and shell snippets in executable fields. | Metadata security lint. |
| Accessibility | Diagnostic snapshots include code, artifact role, and remediation text. | Snapshot assertions. |
