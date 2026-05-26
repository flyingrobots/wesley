---
title: HLAW-030 AgentSafeLawSummary
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-030 AgentSafeLawSummary

## Feature Overview & Objectives

### Problem Statement

Agents need compact law assurance summaries that fit token budgets while
preserving enough structure to avoid hallucinated conclusions. A full report
document can be too large for routine context, and a Markdown comment can be
too presentation-oriented. `AgentSafeLawSummary` provides a bounded, structured
summary with omitted-detail accounting and artifact references.

### Target User/Audience

- Agents summarizing PR law assurance state.
- MCP tool clients requesting compact responses.
- CLI users asking for `--summary agent`.
- QA engineers testing token budgets and omitted-detail accounting.

### Success Metrics

| KPI | Target |
| --- | --- |
| Budget adherence | Summary respects configured max findings, max gates, and text byte budget. |
| No hidden omission | Every omitted category reports omitted count and resource reference. |
| Decision clarity | Summary includes validation status, verdict, top blockers, warnings, and next artifact references. |

## Scope Definition

### In Scope

- Define `AgentSafeLawSummary` schema for CLI and MCP use.
- Include compact fields: status, verdict, profile, bundle hash, top blockers,
  warning count, finding count, gate count, evidence links/resources, omitted
  counts, and recommended next inspection resource.
- Define severity grouping and deterministic selection of top findings/gates.
- Define token/byte budget controls and fallback when budget is too small.
- Define parity requirements between CLI and MCP summary output.

### Out of Scope

- No natural-language generation as source of truth.
- No replacement for full report document.
- No GitHub comment formatting.
- No agent autonomy or automatic fixing.
- No cross-repo summary aggregation.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As an agent, I want a compact structured summary so that I can brief a user without loading the full report. |
| US-002 | As a reviewer, I want omitted-detail counts so that I know when to open the full report. |
| US-003 | As an MCP client, I want the same summary shape as the CLI so that tool behavior is predictable. |
| US-004 | As a QA engineer, I want deterministic top-blocker selection under tight budgets. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A failing report has multiple gates and findings | Holmes builds summary | Summary includes verdict, top blockers, counts, and report resource reference. |
| US-002 | Findings exceed max summary count | Holmes builds summary | Summary includes omitted finding count and full report reference. |
| US-003 | CLI and MCP request same budget | Holmes builds summaries | Structured fields match except transport metadata. |
| US-004 | Budget permits only one blocker | Holmes builds summary | Highest-priority blocker is selected by documented sort key. |
| US-004 | Budget is too small for required fields | Holmes builds summary | Summary returns minimal status plus budget-exceeded diagnostic. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Passing compact summary | Happy | passing report | Status, counts, resource refs. |
| TS-002 | Failing compact summary | Happy | failed report | Top blockers and counts. |
| TS-003 | Tight budget | Edge | budget one blocker | Deterministic top blocker. |
| TS-004 | Tiny impossible budget | Negative | budget below minimum | Minimal diagnostic summary. |
| TS-005 | CLI/MCP parity | Happy | same report and budget | Matching fields. |
| TS-006 | Large report | Load | 100,000 findings | Bounded summary time and size. |

### Happy Path Testing

1. Build summary from passing and failing report fixtures.
2. Verify status, verdict, profile, bundle hash, counts, blockers, warnings,
   omitted counts, and artifact references.
3. Compare CLI and MCP summary output for parity.
4. Snapshot deterministic ordering under multiple budgets.

### Negative/Edge Case Testing

- Invalid inputs: missing report id, no resource references, invalid budget,
  unsupported summary version, inconsistent counts after report bypass, and
  missing verdict.
- Timeouts: summary construction is CPU-only and uses no wall-clock time.
- Concurrent users or retries: summary selection must be pure and deterministic.
- Broken dependencies: missing full report resource yields warning in summary,
  not invented detail.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Summarize 100,000 findings in under 500 ms using precomputed counts. | Large report benchmark. |
| Load | Summary output must stay below configured byte budget. | Budget fixture tests. |
| Security | All strings remain untrusted data for callers/renderers. | Injection fixture. |
| Accessibility | Summary uses explicit text status and next-inspection labels. | Schema contract test. |
