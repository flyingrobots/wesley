---
title: HLAW-041 LegacyHolmesLawEvidenceMapping
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-041 LegacyHolmesLawEvidenceMapping

## Feature Overview & Objectives

### Problem Statement

The current Holmes workflow already emits PR comments, investigation reports,
Watson verification output, and CI artifacts. A Rust Holmes `weslaw` assurance
path must not blindly port legacy behavior or revive retired Node authority. It
needs an explicit mapping that identifies which legacy report concepts are
retained, which are rejected, and which migration gaps require new Rust-native
contracts.

### Target User/Audience

- Holmes migration implementers.
- Maintainers reviewing legacy workflow compatibility.
- CI owners avoiding breakage during cutover.
- QA engineers building compatibility fixtures.

### Success Metrics

| KPI | Target |
| --- | --- |
| Mapping completeness | Every legacy Holmes law-relevant artifact has a retain, adapt, or reject decision. |
| No authority regression | No rejected legacy field becomes part of the new law assurance source of truth. |
| Compatibility coverage | Retained fields have fixture-backed migration expectations. |

## Scope Definition

### In Scope

- Inventory legacy Holmes PR comment fields, investigation report fields,
  Watson verification fields, Moriarty forecast fields, CI artifact links, and
  workflow status fields that overlap with law assurance.
- Classify each field as retain, adapt, reject, or defer.
- Define compatibility fixture names for retained/adapted fields.
- Define rejected-field rationale for Node-only authority, vague citation
  quality, non-law-specific readiness language, and runtime assumptions.
- Define migration gap list for fields that need new Rust Holmes contracts.

### Out of Scope

- No legacy Node code modification.
- No implementation of Rust mapping code.
- No migration execution.
- No deletion of legacy workflow files.
- No new Holmes readiness scoring model.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a Holmes implementer, I want a field-by-field legacy mapping so that Rust law assurance preserves only intentional behavior. |
| US-002 | As a maintainer, I want rejected legacy fields documented so that old Node authority does not sneak back in. |
| US-003 | As a CI owner, I want adapted fields identified so that workflow comments can change without surprise. |
| US-004 | As a QA engineer, I want compatibility fixtures for retained fields. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A legacy Holmes report field is law-relevant | Mapping is reviewed | Field has retain, adapt, reject, or defer classification. |
| US-002 | A field claims broad ship readiness from non-law evidence | Mapping is reviewed | Field is rejected or adapted so it cannot become law assurance truth. |
| US-003 | A legacy PR comment link maps to evidence link behavior | Mapping is reviewed | Field is marked adapt and tied to `GitHubLawEvidenceLinks`. |
| US-004 | A retained field is named | Fixture plan is generated | At least one compatibility fixture is listed for that field. |
| US-004 | A rejected field is named | Fixture plan is generated | No compatibility fixture is required except a negative assertion that it is absent. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Retain evidence link field | Happy | legacy PR comment fixture | Maps to new evidence link contract. |
| TS-002 | Adapt verdict summary | Happy | legacy Holmes verdict text | Maps to law-specific verdict summary only. |
| TS-003 | Reject broad readiness score | Negative | legacy weighted completion | Not included in law assurance truth. |
| TS-004 | Reject Node-only artifact path | Negative | legacy cache path | Not retained as source of truth. |
| TS-005 | Defer forecast output | Edge | Moriarty insufficient-data output | Deferred outside law assurance v1. |
| TS-006 | Missing mapping row | Negative | unmapped legacy field | Mapping audit fails. |

### Happy Path Testing

1. Parse a representative legacy PR comment fixture.
2. Apply mapping classifications manually or through future tooling.
3. Assert retained/adapted fields land in planned law assurance contracts.
4. Assert rejected fields are absent from the new report document expectations.

### Negative/Edge Case Testing

- Invalid inputs: unmapped legacy field, retained field without target contract,
  adapted field without rationale, rejected field still present in new output,
  and defer field used by release gate.
- Timeouts: mapping tests are static and use no network or wall-clock time.
- Concurrent users or retries: mapping fixture evaluation is read-only and
  deterministic.
- Broken dependencies: missing legacy fixture fails mapping coverage, not new
  law assurance behavior.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Mapping coverage audit completes in under 100 ms for 500 fields. | Synthetic mapping table benchmark. |
| Load | Mapping table remains readable when legacy inventory grows. | Field inventory size check. |
| Security | Rejected local paths and cache paths are not emitted in new public reports. | Negative fixture assertions. |
| Accessibility | Adapted comment fields retain text headings and status labels. | Snapshot mapped comment output. |
