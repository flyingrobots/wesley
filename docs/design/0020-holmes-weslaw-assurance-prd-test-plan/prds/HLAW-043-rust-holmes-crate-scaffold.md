---
title: HLAW-043 RustHolmesCrateScaffold
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# HLAW-043 RustHolmesCrateScaffold

## Feature Overview & Objectives

### Problem Statement

The Rust Holmes rewrite needs crate and module boundaries that enforce the
assurance hexagon before code lands. Domain logic must stay independent from
GitHub, MCP, filesystem, CLI, and renderer adapters. `weslaw` law evidence must
enter through ports, and Holmes must not import compiler internals in a way that
turns assurance into law authorship.

### Target User/Audience

- Rust Holmes implementers.
- Architecture reviewers enforcing hexagonal boundaries.
- QA engineers writing compile-time guard tests.
- Future adapter authors for CLI, API, MCP, and GitHub.

### Success Metrics

| KPI | Target |
| --- | --- |
| Boundary enforcement | Domain crate has no GitHub, MCP, CLI, filesystem, or network dependencies. |
| Port clarity | All external effects enter through named ports/adapters. |
| Compile-time guard coverage | Dependency direction tests fail on forbidden imports. |

## Scope Definition

### In Scope

- Define planned crate/module layout: domain, application, ports, adapters-cli,
  adapters-github, adapters-mcp, reporting, fixtures, and test-support.
- Define public API boundaries for evidence validation, assessment, report
  construction, policy evaluation, and witness generation.
- Define dependency rules and forbidden imports.
- Define compile-time guard tests for no-GitHub-in-domain,
  no-filesystem-in-domain, no-wall-clock-in-domain, and no-Wesley-compiler-
  internals-as-authority.
- Define fixture crate responsibilities.

### Out of Scope

- No Rust crate files are created in this slice.
- No implementation code.
- No package publishing.
- No async runtime selection.
- No replacement of existing workflows.

## Detailed User Stories

| ID | User Story |
| --- | --- |
| US-001 | As a Rust implementer, I want crate boundaries so that domain code can be built and tested without adapters. |
| US-002 | As an architecture reviewer, I want compile-time guard tests so that forbidden dependencies cannot creep in. |
| US-003 | As an adapter author, I want ports defined before adapters so that CLI, GitHub, and MCP reuse application services. |
| US-004 | As a QA engineer, I want fixture/test-support boundaries so that tests do not depend on production side effects. |

## Acceptance Criteria (BDD Format)

| Story | Given | When | Then |
| --- | --- | --- | --- |
| US-001 | Domain crate compiles alone | Dependency audit runs | It has no GitHub, MCP, CLI, filesystem, network, or wall-clock dependencies. |
| US-002 | Adapter dependency is added to domain | Guard test runs | Test fails with forbidden dependency diagnostic. |
| US-003 | CLI adapter needs assessment | It calls application service | Adapter passes bundle and policy through ports, not by reimplementing domain logic. |
| US-004 | Test-support crate provides fake clock | Domain tests run | Tests use fake clock and in-memory ports. |
| US-004 | Domain tries to call Wesley CLI | Guard test runs | Test fails because Holmes consumes artifacts, not compiler commands. |

## Detailed Test Plan

### Test Scenarios

| ID | Scenario | Type | Fixture/Input | Expected Result |
| --- | --- | --- | --- | --- |
| TS-001 | Domain-only compile | Happy | planned crate graph | Domain compiles without adapters. |
| TS-002 | Forbidden GitHub import | Negative | test fixture import | Guard fails. |
| TS-003 | Forbidden filesystem import | Negative | test fixture import | Guard fails. |
| TS-004 | Application uses ports | Happy | application service fixture | Ports injected. |
| TS-005 | Adapter calls domain directly bypassing app | Negative | architecture fixture | Guard warns or fails. |
| TS-006 | Fixture crate dependency direction | Happy | test-support graph | Test-support may depend inward, not vice versa. |

### Happy Path Testing

1. Validate planned crate graph against allowed dependency matrix.
2. Compile domain and application units with fake ports.
3. Compile adapters against ports/application services.
4. Run guard tests and ensure allowed graph passes.

### Negative/Edge Case Testing

- Invalid inputs: domain imports GitHub, domain imports filesystem, domain reads
  wall-clock, domain invokes Wesley CLI, reporting imports GitHub publisher, and
  fixture crate leaks into production dependencies.
- Timeouts: compile-time guards do not use wall-clock sleeps.
- Concurrent users or retries: dependency audits are deterministic over the
  crate graph.
- Broken dependencies: missing optional adapter dependency fails only adapter
  crate, not domain crate.

### Non-Functional Testing

| Category | Requirement | Test Method |
| --- | --- | --- |
| Performance | Workspace compile remains within CI budget after scaffold. | Cargo check benchmark. |
| Load | Dependency graph audit handles at least 50 crates/modules. | Synthetic graph test. |
| Security | Secret-bearing adapters cannot be depended on by domain/application core. | Dependency matrix guard. |
| Accessibility | Architecture diagnostics name forbidden dependency and owning crate. | Guard output snapshot. |
