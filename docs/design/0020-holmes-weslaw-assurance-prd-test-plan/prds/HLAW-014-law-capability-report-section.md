---
title: HLAW-014 LawCapabilityReportSection
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-014 LawCapabilityReportSection

## Feature Overview & Objectives

### Problem Statement

Footprint capability summaries explain which operations are declared to read,
write, create, or forbid resources. Holmes must report that posture without
claiming runtime enforcement unless evidence explicitly supports enforcement.
The section needs consistent wording, grouping, truncation, and empty-state
behavior so reviewers can understand operation boundaries without being misled.

### Target User/Audience

- Runtime maintainers reviewing operation footprint posture.
- PR reviewers checking whether semantic law changes widened access.
- Renderer authors building tables for CLI, Markdown, and GitHub.
- QA engineers testing report-only disclaimers and large footprint lists.

### Success Metrics

| KPI | Target |
| --- | --- |
| Disclaimer correctness | 100% of report-only rows include explicit report-only posture. |
| Resource readability | Reads, writes, creates, and forbids are grouped separately for every operation. |
| Empty-state safety | Absent capabilities are never rendered as unrestricted or enforced access. |

## Scope Definition

### In Scope

- Define `LawCapabilityReportSection` rows by operation subject and law id.
- Include report-only/runtime-enforcement posture, reads, writes, creates,
  forbids, slots, closures, empty-state marker, and source artifact reference.
- Define resource grouping and deterministic truncation for large lists.
- Define wording constraints: report-only footprint summaries must not say
  "enforced", "blocked", or "prevented" without enforcement evidence.
- Define unavailable, intentionally-empty, and malformed-input states.

### Out of Scope

- No runtime enforcement verification.
- No handler code inspection.
- No capability API generation.
- No GitHub annotation mapping.
- No final renderer-specific output.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a reviewer, I want each operation's declared reads/writes/creates/forbids grouped so that access posture is scannable. |
| US-002 | As a runtime maintainer, I want report-only summaries labeled clearly so that no one confuses declaration with enforcement. |
| US-003 | As a renderer author, I want truncation metadata so that large footprints remain readable. |
| US-004 | As a QA engineer, I want absent and intentionally-empty capability states distinguished. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A capability summary lists reads, writes, creates, and forbids | Holmes builds the section | The row contains separate arrays for each resource posture. |
| US-002 | `reportOnly` is true and runtime enforcement is false | Holmes builds the row | The row includes a required report-only disclaimer field. |
| US-002 | Runtime enforcement evidence is present | Holmes builds the row | The row may include enforcement wording only with the evidence reference. |
| US-003 | A resource list exceeds the display limit | Holmes builds the section | The row includes truncated resources and omitted counts per group. |
| US-004 | Capability evidence lacks an operation | Holmes builds the section | The operation is unavailable, not intentionally empty. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Normal report-only operation | Happy | jedit replace capability summary | Grouped row with disclaimer. |
| TS-002 | Runtime-enforced operation | Happy | future enforced summary | Enforcement reference preserved. |
| TS-003 | Missing operation | Edge | absent capability entry | Unavailable state. |
| TS-004 | Intentionally empty operation | Edge | explicit empty summary | Empty state, not unavailable. |
| TS-005 | Large resource groups | Load | generated footprint summary | Truncation per group. |
| TS-006 | Forbidden wording regression | Negative | renderer text fixture | Report data forces non-enforcement wording. |

### Happy Path Testing

1. Build section from normalized capability summaries.
2. Assert each row contains operation subject, law id, posture labels, grouped
   resources, and artifact reference.
3. Verify report-only disclaimer data is present.
4. Snapshot sorted rows and truncation metadata.

### Negative/Edge Case Testing

- Invalid inputs: missing posture, contradictory posture, duplicate resource in
  mutually exclusive groups, slot reference missing after ingest bypass, invalid
  display limit, and missing artifact reference.
- Timeouts: section construction performs no IO and uses no clock.
- Concurrent users or retries: resource sorting and truncation must be stable.
- Broken dependencies: invalid capability evidence prevents section creation;
  unavailable evidence produces unavailable rows only if assessment policy asks
  for them.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Build 5,000 operation rows in under 500 ms. | Synthetic capability benchmark. |
| Load | Truncation must avoid duplicating full resource lists into summaries. | Large footprint fixture. |
| Security | Resource names are untrusted display data. | Markdown/HTML/resource-name injection fixtures. |
| Accessibility | Every posture and resource group has a text label. | Contract test row labels and disclaimer field. |
