---
title: HLAW-040 LawAssurancePerformanceBudget
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-040 LawAssurancePerformanceBudget

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance will process potentially large law diffs, coverage reports,
capability summaries, reports, witnesses, and GitHub/MCP summaries. Without
performance and size budgets, future implementation can become slow, memory
hungry, or timeout-prone while still passing functional tests. Budgets must be
defined before implementation so regressions are measurable.

### Target User/Audience

- Holmes implementers choosing data structures and serialization strategies.
- CI maintainers setting job timeouts.
- QA engineers writing benchmark fixtures.
- Reviewers deciding whether performance regressions are acceptable.

### Success Metrics

| KPI | Target |
| --- | --- |
| Budget coverage | Validation, assessment, report construction, rendering, artifact writing, MCP summary, and GitHub comment rendering each have a named budget. |
| Large-fixture readiness | At least one large valid fixture exercises 10,000 findings and 50,000 coverage subjects. |
| Regression visibility | Benchmarks fail when runtime or memory exceeds documented thresholds by more than allowed tolerance. |

## Scope Definition

### In Scope

- Define performance budgets for evidence validation, law diff ingest, coverage
  ingest, capability ingest, gate evaluation, report construction, rendering,
  artifact writing, MCP response construction, GitHub comment rendering, and
  witness generation.
- Define size budgets for bundle JSON, law diff events, coverage subjects,
  capability summaries, report document JSON, rendered Markdown, and comments.
- Define benchmark fixture sizes, timeout values, memory ceilings, and tolerance
  policy.
- Define drift checkpoint at HLAW-040.
- Define reporting format for benchmark results.

### Out of Scope

- No benchmark implementation in this slice.
- No production timeout mechanism.
- No performance optimization work.
- No cloud-host-specific tuning.
- No live GitHub or MCP latency budget beyond adapter timeout classification.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a CI maintainer, I want documented timeout budgets so that law assurance jobs do not grow without review. |
| US-002 | As a Holmes implementer, I want size limits so that parser and renderer behavior is bounded. |
| US-003 | As a QA engineer, I want large benchmark fixtures so that performance is tested before release. |
| US-004 | As a reviewer, I want benchmark reports to show which budget failed and by how much. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Assessment benchmark exceeds the configured time budget | Benchmark suite runs | Suite fails with component name, budget, actual value, and tolerance. |
| US-002 | Bundle file exceeds max configured bytes | Artifact locator validates input | Validation fails with size-budget diagnostic before parsing. |
| US-003 | Large fixture has 10,000 findings and 50,000 coverage subjects | Benchmark suite runs | Validation, assessment, and rendering budgets are measured separately. |
| US-004 | Markdown rendering exceeds size limit | Renderer budget check runs | Output is truncated or fails according to renderer policy with omitted counts. |
| US-004 | Benchmark platform is slower than baseline | Suite runs | Tolerance policy determines warning versus failure consistently. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Small clean bundle benchmark | Happy | clean release fixture | Under all budgets. |
| TS-002 | Large valid benchmark | Load | 10,000 findings and 50,000 coverage subjects | Under documented large budgets. |
| TS-003 | Oversized bundle | Negative | bundle above max bytes | Size-budget diagnostic. |
| TS-004 | Oversized comment | Edge | report above comment size | Truncation and omitted counts. |
| TS-005 | Slow fake adapter | Edge | injected timeout | Timeout diagnostic. |
| TS-006 | Memory ceiling breach | Load | generated huge capability report | Benchmark failure. |

### Happy Path Testing

1. Run benchmark harness over small and large valid fixtures.
2. Record component-level durations, input sizes, output sizes, and peak memory
   where available.
3. Assert budgets and tolerances.
4. Serialize benchmark report deterministically for CI artifacts.

### Negative/Edge Case Testing

- Invalid inputs: oversized bundle, oversized report, too many findings, too
  many coverage subjects, invalid tolerance, missing benchmark fixture, and fake
  timeout adapter.
- Timeouts: benchmark timeout tests use injected fake adapters where possible;
  production timeout classification is specified but not implemented here.
- Concurrent users or retries: benchmarks should isolate temp directories and
  fake clocks to avoid cross-run interference.
- Broken dependencies: unavailable memory measurement tool downgrades to warning
  only if policy permits.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Component budgets are explicit and measured independently. | Benchmark report assertions. |
| Load | Large fixture covers at least 10,000 findings, 50,000 coverage subjects, and 5,000 capability summaries. | Generated fixture validation. |
| Security | Size limits prevent unbounded artifact parsing and comment rendering. | Oversized input tests. |
| Accessibility | Benchmark failure reports include text component names and values. | Snapshot benchmark report. |
