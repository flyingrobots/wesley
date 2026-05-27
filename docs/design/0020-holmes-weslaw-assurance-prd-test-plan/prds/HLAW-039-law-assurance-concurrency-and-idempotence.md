---
title: HLAW-039 LawAssuranceConcurrencyAndIdempotence
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-039 LawAssuranceConcurrencyAndIdempotence

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance will run in CI retries, local repeated commands, parallel
MCP requests, and GitHub publishing reruns. These operations must be idempotent
where safe, deterministic under concurrency, and explicit where collisions are
not allowed. The design must prevent duplicated PR comments, unstable artifact
bytes, race-prone output paths, and report ids that change without input
changes.

### Target User/Audience

- CI maintainers relying on retry-safe law assurance jobs.
- Holmes adapter developers implementing GitHub, CLI, and MCP surfaces.
- QA engineers designing race simulations.
- Reviewers checking that reruns do not create noisy duplicate output.

### Success Metrics

| KPI | Target |
| --- | --- |
| Retry safety | Re-running assessment with identical inputs produces identical report ids, finding ids, gate ids, and witness hashes. |
| Publish idempotence | GitHub comment publishing updates one sticky comment across reruns. |
| Collision clarity | Concurrent writes to the same output directory either serialize safely or fail with a documented collision diagnostic. |

## Scope Definition

### In Scope

- Define idempotence keys for validation, assessment, report document, artifact
  writer, witness, GitHub comment, MCP assessment, and resource registry.
- Define deterministic ids derived from input bundle hash family, policy hash,
  profile, command/tool version, and fake-clock value where appropriate.
- Define concurrent artifact write policy: unique output directory required by
  default, explicit overwrite/replace behavior only when enabled.
- Define GitHub sticky comment update race behavior.
- Define race simulation fixtures and retry tests.

### Out of Scope

- No distributed lock service.
- No database transaction model.
- No live GitHub race test.
- No queue or job scheduler.
- No cross-repo concurrency coordination.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want retried assessment jobs to produce identical outputs so that reruns are trustworthy. |
| US-002 | As a GitHub adapter developer, I want sticky comment idempotence so that reruns update rather than duplicate comments. |
| US-003 | As a CLI user, I want concurrent output collisions to fail clearly instead of corrupting files. |
| US-004 | As a QA engineer, I want deterministic race simulations without real sleeps. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Same bundle, policy, profile, and fake clock are assessed twice | Assessment runs | Report id, finding ids, gate ids, and witness hash match. |
| US-002 | Two publishers race to update the same marker comment | Fake GitHub publisher runs | Exactly one latest comment body is retained or a documented retry diagnostic is emitted. |
| US-003 | Two CLI runs write to the same output directory without overwrite | Artifact writer runs | One run succeeds and the other fails with collision diagnostic, or both fail before partial writes according to policy. |
| US-004 | Race fixture injects interleaving at write step | Test harness runs | Outcome is deterministic across repeated runs. |
| US-004 | MCP assessment request repeats with same idempotence key | MCP adapter runs | Response references the same assessment id or documented cached result. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Assessment retry | Happy | same clean bundle twice | Identical ids and hashes. |
| TS-002 | Warning assessment retry | Happy | warning fixture twice | Identical warnings and report. |
| TS-003 | Concurrent output collision | Edge | same output dir | Collision diagnostic or serialized success per policy. |
| TS-004 | Sticky comment race | Edge | fake GitHub interleaving | One final marker comment. |
| TS-005 | MCP duplicate request | Happy | same idempotence key | Same assessment id. |
| TS-006 | Random input order | Load | shuffled findings/gates | Stable output ordering. |

### Happy Path Testing

1. Run the same valid assessment twice with fixed fake clock.
2. Compare validation result, report document, artifact manifest, and witness
   hashes.
3. Run GitHub fake publisher twice and assert one marker comment.
4. Run MCP assessment twice and assert stable assessment id.

### Negative/Edge Case Testing

- Invalid inputs: missing idempotence key where required, conflicting profile
  with same key, output collision, partial write failure, duplicate marker
  comments, stale cached result, and nondeterministic map iteration order.
- Timeouts: race simulations use fake interleaving controls, not wall-clock
  sleeps.
- Concurrent users or retries: tests must cover parallel reads, parallel writes
  to distinct directories, and conflicting writes to the same directory.
- Broken dependencies: GitHub API retry exhaustion yields publisher failure
  without changing assessment verdict.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Idempotence key derivation adds under 10 ms for large reports. | Hash/id benchmark. |
| Load | Sorting 100,000 finding/gate ids remains deterministic and within budget. | Large shuffled fixture. |
| Security | Idempotence keys must not embed secrets or local absolute paths. | Key redaction test. |
| Accessibility | Retry/collision diagnostics include text reason and remediation. | Snapshot diagnostics. |
