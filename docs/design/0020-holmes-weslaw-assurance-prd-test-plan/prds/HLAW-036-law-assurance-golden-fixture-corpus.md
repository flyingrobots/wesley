---
title: HLAW-036 LawAssuranceGoldenFixtureCorpus
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-036 LawAssuranceGoldenFixtureCorpus

## Feature Overview & Objectives

### Problem Statement

Holmes `weslaw` assurance needs a golden fixture corpus before implementation
starts. The corpus must define clean, warning, failing, stale, missing, and
large-but-valid evidence bundles with expected validation, assessment, report,
and witness outputs. Without named golden fixtures, future Rust, CLI, GitHub,
and MCP implementations will drift while still claiming to implement the same
PRDs.

### Target User/Audience

- Holmes implementers building the Rust domain and adapter tests.
- QA engineers maintaining cross-platform snapshot fixtures.
- CI maintainers running deterministic regression suites.
- Reviewers checking whether a future implementation is faithful to this design
  packet.

### Success Metrics

| KPI | Target |
| --- | --- |
| Fixture coverage | Golden corpus contains at least one clean, warning, failing, stale, missing-optional, and large valid bundle. |
| Snapshot determinism | Golden outputs are byte-identical across repeated local and CI runs with a fake clock. |
| Interface parity | CLI, API, GitHub, and MCP tests reuse the same corpus names and expected outcomes. |

## Scope Definition

### In Scope

- Define `fixtures/hlaw/golden/` as the planned corpus root.
- Define fixture families for clean release, clean local, advisory warnings,
  failed coverage, failed traceability, stale evidence, missing optional
  evidence, and large valid evidence.
- Define expected outputs for validation result, assessment report document,
  rendered Markdown summary, agent-safe summary, audit witness, and exit
  category.
- Define fixture naming conventions, metadata file shape, fake-clock timestamp,
  bundle hash placeholders, and snapshot regeneration policy.
- Define cross-platform stability requirements for paths, sorting, timestamps,
  and newlines.

### Out of Scope

- No fixture files are generated in this PRD slice.
- No implementation test harness is written in this slice.
- No runtime execution witness is required.
- No GitHub API fixture is required beyond renderer/publisher input snapshots.
- No source-of-truth recomputation of Wesley law artifacts by Holmes.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a Holmes implementer, I want named golden fixtures so that each domain service has shared expected inputs and outputs. |
| US-002 | As a QA engineer, I want deterministic snapshots so that report drift is caught during review. |
| US-003 | As a CI maintainer, I want fixture metadata to identify which commands and adapters each fixture exercises. |
| US-004 | As a reviewer, I want golden failures and golden warnings represented separately so that risk posture is not ambiguous. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | A future test references `golden/clean-release` | The harness loads metadata | It finds bundle, policy, expected validation, expected assessment, expected report, and witness expectations. |
| US-002 | The same fixture is evaluated twice with fake clock `2026-01-01T00:00:00Z` | Outputs are serialized | Snapshot bytes are identical. |
| US-003 | A fixture is marked `surfaces: [cli, mcp, github]` | Test selection runs | CLI, MCP, and GitHub tests can include the fixture without copying inputs. |
| US-004 | A warning-only fixture is assessed with `--fail-on fail` | Assessment runs | Expected exit category is success-with-warnings, not assurance failure. |
| US-004 | A failed traceability fixture is assessed | Assessment runs | Expected gate state is fail and provenance mismatch details are present. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Clean release fixture | Happy | `fixtures/hlaw/golden/clean-release` | Valid evidence, pass verdict, success exit. |
| TS-002 | Clean local fixture | Happy | `fixtures/hlaw/golden/clean-local` | Valid evidence, local profile, advisory policy. |
| TS-003 | Warning-only fixture | Happy | `fixtures/hlaw/golden/warning-advisory` | Warning verdict and deterministic warning summary. |
| TS-004 | Failing coverage fixture | Negative | `fixtures/hlaw/golden/fail-coverage` | Failed coverage gate with missing subjects. |
| TS-005 | Stale traceability fixture | Negative | `fixtures/hlaw/golden/fail-traceability-stale` | Failed traceability gate with stale artifact role. |
| TS-006 | Large valid fixture | Load | `fixtures/hlaw/golden/large-valid` | Outputs remain deterministic within performance budget. |

### Happy Path Testing

1. Define metadata schema for each golden fixture directory.
2. Load clean release and clean local fixtures through the planned artifact
   locator.
3. Assert expected validation, assessment, report document, summary, and witness
   outputs.
4. Re-run with the same fake clock and compare bytes.

### Negative/Edge Case Testing

- Invalid inputs: fixture metadata missing expected output, duplicate fixture
  id, unsupported fixture schema version, absent fake-clock timestamp, invalid
  profile name, and output snapshot not matching declared media type.
- Timeouts: fixture evaluation uses fake clocks and in-memory adapters where
  possible; slow filesystem reads are surfaced by the harness.
- Concurrent users or retries: two test processes reading the corpus must not
  mutate fixture directories or regenerate snapshots implicitly.
- Broken dependencies: if a fixture references a missing artifact, the corpus
  validation fails before implementation tests run.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Corpus metadata validation completes in under 500 ms for 100 fixtures. | Synthetic fixture index benchmark. |
| Load | Large fixture outputs may be stored as compressed test assets only if snapshot comparison remains deterministic. | Large fixture storage review. |
| Security | Fixture paths are workspace-relative and must not include local absolute paths. | Path lint over fixture metadata. |
| Accessibility | Golden Markdown snapshots include headings and text statuses for screen-reader-friendly review. | Markdown snapshot assertions. |
