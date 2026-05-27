---
title: HLAW-035 LawAssuranceAuditWitness
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-035 LawAssuranceAuditWitness

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance needs a deterministic witness artifact that records what
inputs were used, what policy was active, what gates were evaluated, what report
was produced, and which hashes identify the evidence. This witness is not a
replacement for Wesley compiler truth; it is Holmes' audit trail for the
judgment it made over published evidence.

### Target User/Audience

- Release auditors reconstructing law assurance decisions.
- CI maintainers archiving deterministic assessment evidence.
- Holmes developers ensuring reproducible assessment outputs.
- QA engineers testing fake-clock and replay behavior.

### Success Metrics

| KPI | Target |
| --- | --- |
| Replayability | Replaying the same witness inputs with the same policy produces the same gate and report hashes. |
| Hash coverage | Witness records bundle, report, policy, validation, and rendered artifact hashes where available. |
| Clock determinism | Witness timestamps come only from injected clock. |

## Scope Definition

### In Scope

- Define `holmes.law-assurance-witness/v1` artifact.
- Include assessment id, command/tool source, input bundle reference, artifact
  hashes, policy hash, profile, validation result hash, report document hash,
  rendered artifact hashes, gate ids and states, finding counts, suppression
  audit records, override audit candidates, and generated-at timestamp.
- Define deterministic serialization and hash calculation.
- Define replay fields needed to compare future assessment output.
- Define fake-clock requirement for tests.

### Out of Scope

- No cryptographic signing.
- No remote attestation.
- No storage or retention backend.
- No recomputation of Wesley law hashes.
- No human approval workflow.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release auditor, I want a witness artifact so that I can reconstruct what Holmes assessed. |
| US-002 | As a CI maintainer, I want hashes for every output artifact so that archived files can be verified later. |
| US-003 | As a QA engineer, I want fake-clock timestamps so that witness snapshots are deterministic. |
| US-004 | As a Holmes developer, I want replay fields so that future regressions can compare assessment results. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Holmes completes assessment | Witness writer runs | Witness includes assessment id, profile, input references, gates, and report hash. |
| US-002 | Artifact writer produced Markdown and JSON files | Witness writer runs | Witness records content hashes for each artifact. |
| US-003 | Fake clock is set to a fixed timestamp | Witness writer runs twice | Witness bytes are identical. |
| US-004 | Witness is replayed with same inputs | Replay comparison runs | Gate state and report hash match. |
| US-004 | Policy hash differs during replay | Replay comparison runs | Replay reports policy mismatch before comparing verdicts. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Passing assessment witness | Happy | passing report and artifacts | Witness written with hashes. |
| TS-002 | Failing assessment witness | Happy | failed gate report | Witness records failed gates. |
| TS-003 | Fake-clock determinism | Happy | fixed timestamp | Byte-identical witnesses. |
| TS-004 | Replay match | Happy | witness plus same inputs | Match result. |
| TS-005 | Replay policy mismatch | Negative | changed policy hash | Policy mismatch diagnostic. |
| TS-006 | Missing rendered artifact hash | Edge | optional artifact absent | Unavailable recorded. |

### Happy Path Testing

1. Generate witness from a complete assessment and artifact manifest.
2. Verify hashes, gate states, finding counts, profile, and timestamp source.
3. Serialize witness twice with fake clock and compare bytes.
4. Run replay comparison against the same normalized assessment output.

### Negative/Edge Case Testing

- Invalid inputs: missing assessment id, missing policy hash, invalid artifact
  hash, duplicate gate ids, inconsistent finding counts, missing clock, and
  replay policy mismatch.
- Timeouts: witness generation uses injected clock and already-written artifact
  metadata; no network calls.
- Concurrent users or retries: witness ids and serialization are deterministic
  when inputs and clock are fixed.
- Broken dependencies: artifact writer failure prevents success witness and may
  emit failure witness only if explicitly designed later.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Write witness for 10,000 gates/findings in under 300 ms after hashes are available. | Synthetic witness benchmark. |
| Load | Witness stores counts and ids without duplicating full report payloads. | Large assessment fixture. |
| Security | Witness excludes secret env vars and local absolute paths by default. | Secret/path redaction fixture. |
| Accessibility | Witness is machine-readable JSON with text status fields for audit tools. | JSON Schema validation and snapshot. |
