---
title: HLAW-048 LawAssuranceEndToEndWorkflow
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-048 LawAssuranceEndToEndWorkflow

## Feature Overview & Objectives

### Problem Statement

The preceding slices define individual Holmes law assurance inputs, policies,
reports, adapters, fixtures, and operator surfaces. The implementation still
needs one end-to-end workflow contract that ties GraphQL SDL and `weslaw`
authoring to Wesley law artifacts, Holmes assessment, report publication, PR
review output, and release gate decisions. Without a full workflow PRD, future
implementation can pass isolated unit tests while failing the operator journey.

### Target User/Audience

- Holmes implementation leads planning the first Rust engineering branch.
- QA engineers building fixture repositories and integration tests.
- CI maintainers wiring Wesley and Holmes commands together.
- Reviewers verifying PR comments and gate outcomes.
- Release managers requiring auditable evidence from authoring to merge.

### Success Metrics

| KPI | Target |
| --- | --- |
| Golden path coverage | One fixture repository proves SDL plus `weslaw` authoring through Holmes PR output. |
| Failure path coverage | At least five named failure paths are tested end to end with stable diagnostics. |
| Gate traceability | Final gate decision links back to schema hash, law hash, policy hash, and audit witness id. |

## Scope Definition

### In Scope

- Define complete golden path from authored GraphQL SDL and `weslaw` documents
  through Wesley `law validate`, `law diff`, `law coverage`, `law capabilities`,
  bundle manifest assembly, Holmes validation, assessment, rendering, artifact
  writing, GitHub publication, and audit witness output.
- Define fixture repository layout for happy path, semantic-law warning,
  required gate failure, invalid evidence, stale hash, and publisher-unavailable
  paths.
- Define required command order and artifact handoff contract between Wesley
  and Holmes.
- Define end-to-end assertions for report content, gate decision, exit code,
  artifact files, PR comment, MCP parity, and audit witness.
- Define what the end-to-end workflow proves and what remains out of scope.

### Out of Scope

- No implementation of the Rust Holmes end-to-end runner.
- No changes to Wesley law command semantics.
- No live GitHub API dependency in deterministic end-to-end tests.
- No external Echo, Continuum, jedit, warp-ttd, git-warp, or
  `wesley-postgres` repo edits.
- No release certification beyond law assurance gate behavior.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a developer, I want one documented command chain from SDL and `weslaw` changes to a Holmes law assurance report so that I can reproduce CI locally. |
| US-002 | As a QA engineer, I want fixture repositories for golden and failure paths so that the whole workflow is tested instead of isolated parsers. |
| US-003 | As a reviewer, I want PR output to summarize semantic law changes, coverage gates, provenance, and required actions. |
| US-004 | As a release manager, I want final gate decisions to cite hashes and audit witness ids so that merge decisions are traceable. |
| US-005 | As an MCP client, I want the end-to-end assessment result to match CLI and GitHub summaries. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Developer has SDL, `weslaw`, policy, and base refs | They run the documented local workflow | Wesley artifacts are produced and Holmes emits validation, assessment, report, artifacts, and witness outputs. |
| US-002 | Golden fixture repository is checked out | End-to-end suite runs | Report is advisory-clean, exit code is success, and audit witness contains schema, law, policy, and bundle hashes. |
| US-002 | Required gate failure fixture is checked out | End-to-end suite runs | Exit code is required-gate failure and the PR summary names the blocking law finding. |
| US-003 | Semantic law diff includes strengthening and weakening events | PR renderer runs | Comment groups events by severity and includes omitted-count metadata if truncated. |
| US-004 | Release gate decision is required | Audit witness is written | Witness records exact evidence ids and policy gates evaluated. |
| US-005 | CLI, MCP, and GitHub summaries are generated from one assessment | Parity check runs | Shared finding ids and gate decisions match across all three surfaces. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Full golden path | Happy | fixture repo with valid SDL and `weslaw` | Success exit, report, comment, artifacts, witness. |
| TS-002 | Semantic warning path | Happy | law strengthening advisory fixture | Warning finding, non-blocking gate. |
| TS-003 | Required gate failure | Negative | weakened variant or coverage gap fixture | Required failure exit and blocking finding. |
| TS-004 | Invalid evidence | Negative | malformed law diff JSON | Validation failure before assessment. |
| TS-005 | Stale hash | Negative | bundle hash mismatch | Traceability gate failure. |
| TS-006 | Publisher unavailable | Edge | fake GitHub timeout | Local artifacts and witness succeed, publish diagnostic emitted. |
| TS-007 | MCP parity | Happy | assessment result fixture | MCP response matches CLI report model. |

### Happy Path Testing

1. Prepare fixture repository with base SDL, head SDL, base `weslaw`, head
   `weslaw`, policy, and expected artifact manifest.
2. Run Wesley law commands to create validation, diff, coverage, capabilities,
   and bundle manifest artifacts.
3. Assemble Holmes law evidence bundle from those artifacts.
4. Run Holmes validate, assess, report, and artifact writer.
5. Render GitHub comment through fake publisher and MCP summary through in-memory
   adapter.
6. Assert all surfaces share finding ids, gate decisions, hashes, and witness id.

### Negative/Edge Case Testing

- Invalid inputs: malformed SDL, malformed `weslaw`, unsupported artifact
  version, stale schema hash, missing policy, missing coverage, invalid bundle
  manifest, weakened required law, and unknown report field.
- Timeouts: fake GitHub publisher, fake artifact upload, and fake clock
  deadline tests classify timeout without changing assessment result.
- Concurrent users or retries: repeated end-to-end runs with same commit context
  are idempotent and update the same fake PR comment.
- Broken dependencies: unavailable Wesley artifact, unavailable publisher,
  read-only artifact directory, and missing MCP resource are separate
  diagnostics.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Golden end-to-end local fixture completes in under 10 seconds excluding Rust compile time. | Integration benchmark. |
| Load | Large fixture with 10,000 findings still emits truncated GitHub comment and full local report. | Load integration fixture. |
| Security | No test path requires live secrets or network access; fake adapters enforce token absence. | Environment scrub and fake adapter tests. |
| Accessibility | Rendered Markdown summary uses headings, tables, and text labels for all gate states. | Snapshot review and Markdown lint. |
