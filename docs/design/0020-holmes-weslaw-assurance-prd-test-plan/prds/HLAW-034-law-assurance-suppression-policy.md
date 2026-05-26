---
title: HLAW-034 LawAssuranceSuppressionPolicy
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-034 LawAssuranceSuppressionPolicy

## Feature Overview & Objectives

### Problem Statement

Some known advisory findings may need temporary suppression so that teams can
ship while tracking debt. Suppression is dangerous: it can hide real risk if it
applies too broadly or if it can suppress invalid evidence. Holmes needs a
policy-bound suppression model that is narrow, expiring, auditable, and unable
to suppress validation errors or non-overridable gates.

### Target User/Audience

- Maintainers managing known advisory law debt.
- Release managers protecting non-overridable checks.
- Reviewers auditing suppressed findings.
- QA engineers testing expiration, abuse prevention, and matching semantics.

### Success Metrics

| KPI | Target |
| --- | --- |
| Suppression precision | Every suppression targets explicit finding id, gate id, or law subject pattern with bounded scope. |
| Expiration safety | Expired suppressions are ignored and reported. |
| Non-overridable protection | Validation failures and required non-overridable gates cannot be suppressed. |

## Scope Definition

### In Scope

- Define suppression policy fields: id, target type, target selector, profile,
  reason, owner, created date, expiration date, allowed severities, and audit
  tags.
- Define matching rules for exact finding id, gate id, law id, subject, and
  category selector.
- Define expiration behavior using injected clock.
- Define diagnostics for broad, expired, malformed, duplicate, and
  non-overridable suppression attempts.
- Define report behavior: suppressed findings remain countable and visible in a
  suppression summary.

### Out of Scope

- No GitHub UI for creating suppressions.
- No database-backed suppression store.
- No suppression of validation errors.
- No suppression of Wesley semantic law facts.
- No permanent waiver workflow.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a maintainer, I want to suppress one known advisory finding with an expiration so that debt is tracked. |
| US-002 | As a release manager, I want invalid evidence and required gate failures to ignore suppression attempts. |
| US-003 | As a reviewer, I want suppressed findings summarized so that risk is still visible. |
| US-004 | As a QA engineer, I want broad wildcard suppressions rejected unless policy explicitly permits them. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Advisory finding matches unexpired suppression | Holmes applies policy | Finding is marked suppressed with suppression id and audit metadata. |
| US-002 | Validation failure matches suppression selector | Holmes applies policy | Suppression is rejected and validation failure remains active. |
| US-002 | Required non-overridable gate matches suppression | Holmes applies policy | Gate remains active and suppression diagnostic is emitted. |
| US-003 | A finding is suppressed | Holmes builds report | Suppression summary includes id, reason, owner, expiration, and target. |
| US-004 | Suppression target is `*` and broad suppressions are disabled | Holmes validates policy | Policy fails with broad suppression diagnostic. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Exact advisory suppression | Happy | finding plus suppression | Finding marked suppressed. |
| TS-002 | Expired suppression | Edge | expired suppression | Ignored and reported expired. |
| TS-003 | Validation failure suppression | Negative | validation error target | Rejected. |
| TS-004 | Required gate suppression | Negative | non-overridable gate | Rejected. |
| TS-005 | Broad wildcard suppression | Negative | wildcard target | Rejected unless enabled. |
| TS-006 | Duplicate suppression ids | Negative | duplicate ids | Policy validation failure. |

### Happy Path Testing

1. Apply suppression policy to a warning-level finding.
2. Verify suppressed state, audit metadata, and report summary.
3. Confirm the underlying finding remains present in machine-readable output.
4. Snapshot suppression summary.

### Negative/Edge Case Testing

- Invalid inputs: missing reason, missing owner, expired suppression, duplicate
  id, broad wildcard, invalid selector syntax, profile mismatch, severity not
  allowed, validation error target, and non-overridable gate target.
- Timeouts: expiration uses fake clock; no wall-clock reads.
- Concurrent users or retries: suppression matching order is deterministic.
- Broken dependencies: invalid policy prevents assessment rather than silently
  ignoring suppressions.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Match 10,000 suppressions against 10,000 findings under 1 second using indexed selectors. | Synthetic suppression benchmark. |
| Load | Suppression summary truncates long reason text safely. | Large reason fixture. |
| Security | Suppression reasons and selectors are untrusted display text. | Injection fixtures. |
| Accessibility | Suppressed state includes text labels and reason references. | Contract test report fields. |
