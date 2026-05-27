---
title: HLAW-031 LawAssurancePolicySchema
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-031 LawAssurancePolicySchema

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance needs a versioned policy schema that defines required
evidence, profiles, thresholds, severity mappings, override eligibility, and
non-overridable checks. Without a typed schema, local and CI policies will drift
into undocumented YAML or JSON conventions that commands, MCP tools, and GitHub
publishers interpret differently.

### Target User/Audience

- Release managers defining `ci-release` law assurance posture.
- Local developers using advisory profiles.
- Holmes policy developers validating policy files.
- QA engineers testing unknown fields, defaults, and profile inheritance.

### Success Metrics

| KPI | Target |
| --- | --- |
| Schema validation | 100% of policy files validate against `holmes.law-assurance-policy/v1`. |
| Profile explicitness | Every assessment identifies exactly one policy profile. |
| Default safety | Unknown fields and implicit environment-derived behavior are rejected unless explicitly allowed. |

## Scope Definition

### In Scope

- Define `holmes.law-assurance-policy/v1` top-level fields: version, profiles,
  defaultProfile, severityMappings, coverageThresholds, requiredEvidence,
  overrideRules, failOn defaults, redaction policy, and schema metadata.
- Define JSON Schema publication requirement for the policy authoring format.
- Define profile inheritance rules and explicit override precedence.
- Define unknown-field behavior, default materialization, and deterministic
  normalized policy representation.
- Define validation diagnostics for malformed policy files.

### Out of Scope

- No policy UI.
- No policy editing command.
- No branch protection configuration.
- No Rego/CEL expression language.
- No environment-variable-driven implicit profiles.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a release manager, I want a versioned policy file so that law assurance gates are explicit and reviewable. |
| US-002 | As a local developer, I want profile inheritance so that local policy can differ from release policy without duplicating every field. |
| US-003 | As a Holmes developer, I want normalized policy output so that CLI and MCP evaluate the same rules. |
| US-004 | As a QA engineer, I want malformed policies rejected with stable diagnostics. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A valid v1 policy file is supplied | Holmes validates policy | Policy is accepted and normalized with version preserved. |
| US-002 | Local profile inherits from base and overrides warning threshold | Holmes normalizes policy | Inherited fields are materialized deterministically with local override applied. |
| US-003 | CLI and MCP load same policy | Holmes normalizes policy | Normalized JSON is identical. |
| US-004 | Policy contains unknown top-level field | Holmes validates policy | Validation fails with `HLAW_POLICY_UNKNOWN_FIELD` unless extension mode is explicitly enabled. |
| US-004 | Policy has no profiles | Holmes validates policy | Validation fails with `HLAW_POLICY_MISSING_PROFILE`. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Valid release policy | Happy | `fixtures/hlaw/policy/release.json` | Accepted normalized policy. |
| TS-002 | Profile inheritance | Happy | base plus local profile | Materialized inherited fields. |
| TS-003 | Unknown field | Negative | unknown top-level field | Unknown-field diagnostic. |
| TS-004 | Missing profiles | Negative | empty profile map | Missing profile diagnostic. |
| TS-005 | Invalid threshold | Negative | threshold 150 | Threshold diagnostic. |
| TS-006 | Large mapping set | Load | 1,000 severity mappings | Deterministic normalization. |

### Happy Path Testing

1. Validate a release policy fixture.
2. Normalize inherited local and release profiles.
3. Validate against JSON Schema.
4. Snapshot normalized policy JSON and diagnostics.

### Negative/Edge Case Testing

- Invalid inputs: malformed JSON, unsupported version, unknown field, missing
  profiles, circular inheritance, invalid threshold, duplicate profile id,
  unknown severity, and implicit environment profile reference.
- Timeouts: policy validation reads only provided policy bytes and uses no
  network calls.
- Concurrent users or retries: normalized policy is immutable and deterministic.
- Broken dependencies: schema file missing in test harness fails policy schema
  validation tests, not runtime policy semantics.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Normalize a 1,000-rule policy in under 100 ms. | Synthetic policy benchmark. |
| Load | Inheritance resolution must detect cycles without recursion overflow. | Deep inheritance fixtures. |
| Security | Redaction policy prevents secret-like values from MCP exposure. | Policy redaction fixture. |
| Accessibility | Policy diagnostics include code, profile, and field path as text. | Snapshot diagnostics. |
