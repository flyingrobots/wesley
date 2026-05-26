---
title: HLAW-038 LawAssuranceFakeClockAndPorts
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-038 LawAssuranceFakeClockAndPorts

## Feature Overview & Objectives

### Problem Statement

Holmes law assurance outputs include timestamps, timeouts, artifact metadata,
publisher attempts, resource reads, and witness generation. Tests will become
non-deterministic if implementations read wall-clock time, global filesystem
state, or live GitHub/MCP services directly. The architecture needs
dependency-injected clocks and ports before any implementation begins.

### Target User/Audience

- Holmes Rust implementers building domain and application services.
- QA engineers requiring deterministic snapshots.
- CI maintainers diagnosing flaky tests.
- Reviewers verifying that wall-clock and external-service behavior is isolated.

### Success Metrics

| KPI | Target |
| --- | --- |
| No wall-clock dependency | Domain and application tests can run with a fake clock and zero direct system-time calls. |
| Port isolation | Filesystem, GitHub, MCP, artifact writer, and policy readers are replaceable with in-memory fakes. |
| Snapshot stability | Timestamped reports and witnesses are byte-identical under the same fake clock. |

## Scope Definition

### In Scope

- Define `ClockPort` with fixed, advancing, and timeout-injection fake
  implementations.
- Define planned ports for artifact loading, artifact writing, GitHub
  publishing, MCP resource registry, policy loading, report rendering, and
  command IO.
- Define test-only in-memory adapters with deterministic ordering and failure
  injection.
- Define rules forbidding domain services from using wall-clock time, process
  current directory, network clients, or ambient environment variables directly.
- Define concurrency-safe fake behavior.

### Out of Scope

- No production adapter implementation in this slice.
- No real GitHub or MCP server integration.
- No async runtime selection.
- No mocking framework choice beyond port contracts.
- No test code generation.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a QA engineer, I want fake clocks so that audit witness timestamps are deterministic. |
| US-002 | As a Holmes implementer, I want in-memory ports so that domain tests do not depend on filesystem or GitHub state. |
| US-003 | As a CI maintainer, I want timeout behavior injected deterministically instead of using real sleeps. |
| US-004 | As a reviewer, I want tests that fail if domain code reads wall-clock time directly. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Fake clock is set to `2026-01-01T00:00:00Z` | Report and witness are generated twice | Serialized timestamps are identical. |
| US-002 | In-memory artifact loader contains law diff bytes | Ingest service runs | Service reads through the port and never touches filesystem. |
| US-003 | Fake artifact loader is configured to timeout | Validation runs | Validation returns infrastructure timeout diagnostic without sleeping. |
| US-004 | Domain code attempts to import system clock API | Architecture guard runs | Guard fails with direct-clock-use diagnostic. |
| US-004 | Concurrent tests share fake adapters | Tests run | Adapter state remains deterministic or explicitly isolated per test. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Fixed fake clock | Happy | fixed timestamp | Identical timestamps in outputs. |
| TS-002 | Advancing fake clock | Happy | configured increments | Predictable sequence. |
| TS-003 | Artifact read timeout | Edge | fake loader timeout | Timeout diagnostic, no sleep. |
| TS-004 | GitHub publish failure | Edge | fake publisher error | Publisher failure separated. |
| TS-005 | Direct clock import guard | Negative | domain module with forbidden import | Architecture guard fails. |
| TS-006 | Concurrent fake adapter use | Load | parallel assessment tests | No nondeterministic ordering. |

### Happy Path Testing

1. Build assessment services with fake clock and in-memory ports.
2. Generate validation, report, artifact writer manifest, and witness outputs.
3. Assert byte equality across repeated runs.
4. Confirm all side effects are visible through fake adapter state.

### Negative/Edge Case Testing

- Invalid inputs: missing fake clock, adapter not registered, fake port state
  reused without reset, direct wall-clock call, direct filesystem call in domain
  service, and real sleep in timeout test.
- Timeouts: timeout behavior is injected through ports and never waits on real
  elapsed time.
- Concurrent users or retries: fake adapters must either be immutable or guard
  mutable state with deterministic ordering.
- Broken dependencies: fake adapter failure modes map to the same diagnostics as
  production ports.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Fake-port tests add less than 10 ms overhead per small assessment fixture. | Test harness benchmark. |
| Load | In-memory ports can hold 100 MB synthetic artifact bytes for load tests without global state. | Large fake artifact fixture. |
| Security | Fakes must enforce the same path and URL policy as production adapters unless a test explicitly disables it. | Policy parity tests. |
| Accessibility | Fake-rendered text snapshots include the same status labels as production renderers. | Snapshot comparison. |
