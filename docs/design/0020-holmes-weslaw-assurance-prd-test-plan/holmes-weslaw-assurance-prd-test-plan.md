---
title: Holmes weslaw Assurance PRD And Test Plan Campaign
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: complete
release: v0.0.8
---

# Holmes `weslaw` Assurance PRD And Test Plan Campaign

## Status

Planning packet complete. Slices `HLAW-001` through `HLAW-050` are complete.

## Question

How should Wesley spend the next 50 slices after `weslaw` v1 so Holmes can
consume `weslaw` outputs as assurance evidence without taking ownership of
semantic law truth?

## Hill

The next chunk is a product-management and QA campaign, not a code-first
campaign.

Each slice produces one PRD and test plan for a concrete Holmes-facing
`weslaw` assurance feature. The campaign exists to force the next engineering
work to have measurable behavior, non-goals, BDD acceptance criteria, and
negative/non-functional testing before Rust crates, CLI commands, MCP tools, or
GitHub publishers are built.

## Product Boundary

Wesley owns compiler truth and `weslaw` law artifacts. Holmes owns assurance
judgment over evidence. Holmes may ingest `weslaw` outputs and produce
findings, gates, reports, and recommendations. Holmes must not reinterpret
GraphQL shape, mutate law, rebind law, invent semantic diffs, or become the
source of truth for contract bundles.

## Slice Output Contract

Every `HLAW` slice creates one Markdown PRD/test-plan artifact under this
packet, using the filename:

```text
prds/HLAW-XXX-<slug>.md
```

Every slice artifact must contain these sections, with these headings:

1. `Feature Overview & Objectives`
2. `Scope Definition`
3. `Detailed User Stories`
4. `Acceptance Criteria (BDD Format)`
5. `Detailed Test Plan`

The canonical artifact template is
[prds/README.md](./prds/README.md). Future slice artifacts should copy that
structure before adding feature-specific requirements.

The slice artifact must be written from two roles at once:

- Expert Technical Product Manager: define user value, scope, metrics, and
  acceptance criteria.
- Lead QA Engineer: define deterministic validation, fixture strategy,
  failure modes, and non-functional test coverage.

The artifact must not contain generic implementation filler. Each PRD must name
exact command surfaces, artifact shapes, expected fields, policy decisions,
failure behavior, and test fixtures where known.

## Campaign KPIs

| KPI | Target |
| --- | --- |
| PRD completeness | 50 / 50 slice artifacts include all five required sections. |
| Testability | 50 / 50 slice artifacts include happy-path, negative/edge, and non-functional test coverage. |
| Boundary clarity | 50 / 50 slice artifacts explicitly state what Holmes must not own. |
| Implementation readiness | At least 40 / 50 slice artifacts name concrete commands, ports, schemas, fixtures, or reports. |
| Drift control | Drift checks at slices 10, 25, 40, and 50 update this packet and `BEARING`. |

## Chunking

| Chunk | Slices | Status | Purpose |
| --- | --- | --- | --- |
| 1 | HLAW-001..HLAW-010 | Complete | Evidence intake and typed domain contracts. |
| 2 | HLAW-011..HLAW-020 | Complete | Report model, CLI operator flows, and local artifacts. |
| 3 | HLAW-021..HLAW-030 | Complete | GitHub and MCP interfaces over the same assurance use cases. |
| 4 | HLAW-031..HLAW-040 | Complete | Policy, QA harnesses, determinism, concurrency, and budgets. |
| 5 | HLAW-041..HLAW-050 | Complete | Migration, release gates, documentation, and campaign closeout. |

Drift checks happen after HLAW-010, HLAW-025, HLAW-040, and HLAW-050.

## Slice Checklist

### Evidence Intake And Typed Domain Contracts

- [x] HLAW-001 `HolmesLawEvidenceBundle` PRD and test plan.
  - Feature/product: A typed bundle contract that groups `wesley law diff`,
    `law coverage`, `law capabilities`, and contract bundle manifest outputs
    into one Holmes-readable evidence input.
  - Required output: PRD for schema fields, versioning, required/optional
    artifact references, unsupported-version diagnostics, and fixture layout.
- [x] HLAW-002 `LawDiffIngestPort` PRD and test plan.
  - Feature/product: A Holmes input port that reads `wesley.law-diff/v1` JSON
    and normalizes it into assurance findings without reclassifying semantic
    law changes.
  - Required output: PRD for event-kind mapping, malformed JSON handling,
    duplicate law ids, unknown event kinds, and stable finding ids.
- [x] HLAW-003 `LawCoverageIngestPort` PRD and test plan.
  - Feature/product: A Holmes input port that reads profile/category-aware law
    coverage reports and turns missing release-required subjects into gates.
  - Required output: PRD for release/local profile behavior, threshold
    handling, missing-subject rendering, and coverage fixture matrices.
- [x] HLAW-004 `LawCapabilityIngestPort` PRD and test plan.
  - Feature/product: A Holmes input port that reads report-only footprint
    capability summaries and reports boundary posture without claiming runtime
    enforcement.
  - Required output: PRD for `reportOnly`, `runtimeEnforcement`, reads/writes/
    creates/forbids, empty-footprint behavior, and wording constraints.
- [x] HLAW-005 `ContractBundleManifestIngestPort` PRD and test plan.
  - Feature/product: A Holmes input port that reads contract bundle manifests
    and verifies schema, law, profile, bundle, compiler, and codec hashes are
    present and consistently referenced by other artifacts.
  - Required output: PRD for hash validation, absent optional hashes, mismatch
    errors, and bundle traceability reporting.
- [x] HLAW-006 `WeslawArtifactLocator` PRD and test plan.
  - Feature/product: A local adapter that resolves law evidence artifact paths
    from CLI flags, workflow artifacts, and explicit bundle metadata.
  - Required output: PRD for path resolution precedence, missing files,
    symlink/path traversal policy, and deterministic diagnostics.
- [x] HLAW-007 `LawEvidenceValidationResult` PRD and test plan.
  - Feature/product: A typed validation result that separates input contract
    errors from assurance findings so bad evidence fails before judgment.
  - Required output: PRD for error taxonomy, JSON shape, CLI exit mapping, and
    test fixtures for invalid artifacts.
- [x] HLAW-008 `SemanticChangeFinding` PRD and test plan.
  - Feature/product: A domain finding model for law diff events with severity,
    posture, law id, subject, change fields, and source artifact references.
  - Required output: PRD for stable finding IDs, severity defaults, markdown
    snippets, JSON rendering, and sort order.
- [x] HLAW-009 `LawCoverageGateDecision` PRD and test plan.
  - Feature/product: A gate model that evaluates law coverage against policy
    profiles and reports pass/warn/fail/unavailable outcomes.
  - Required output: PRD for gate states, profile-specific required categories,
    missing-subject evidence, and fallback behavior when coverage is absent.
- [x] HLAW-010 `BundleTraceabilityGateDecision` PRD and test plan.
  - Feature/product: A gate model that checks every ingested law artifact links
    back to the same expected contract bundle hash family.
  - Required output: PRD for cross-artifact consistency, hash mismatch
    findings, unsupported manifest versions, and checkpoint playback.

### Report Model, CLI, And Local Artifacts

- [x] HLAW-011 `LawAssuranceReportDocument` PRD and test plan.
  - Feature/product: A structured report section family for semantic changes,
    coverage, capabilities, and bundle traceability inside the Holmes
    `ReportDocument`.
  - Required output: PRD for section ids, tables, summary metrics, attachments,
    stable ordering, and renderer-neutral semantics.
- [x] HLAW-012 `LawDiffReportSection` PRD and test plan.
  - Feature/product: A report section that presents semantic law diff events in
    review order while preserving machine-readable event kinds.
  - Required output: PRD for field columns, grouped summaries, high-risk event
    highlighting, truncation policy, and no-change behavior.
- [x] HLAW-013 `LawCoverageReportSection` PRD and test plan.
  - Feature/product: A report section that presents law coverage by profile,
    category, required status, covered count, and missing subjects.
  - Required output: PRD for thresholds, empty categories, required versus
    advisory categories, and accessibility of table output.
- [x] HLAW-014 `LawCapabilityReportSection` PRD and test plan.
  - Feature/product: A report section that presents footprint capability
    summaries while explicitly labeling them report-only.
  - Required output: PRD for wording, resource grouping, empty lists, large
    footprint truncation, and runtime-enforcement disclaimers.
- [x] HLAW-015 `BundleProvenanceReportSection` PRD and test plan.
  - Feature/product: A report section that shows schemaHash, lawHash,
    profileHash, bundleHash, law codec, compiler identity, and generator
    provenance.
  - Required output: PRD for required fields, partial manifests, hash display,
    copy/paste safety, and mismatch callouts.
- [x] HLAW-016 `holmes weslaw validate` CLI PRD and test plan.
  - Feature/product: A Holmes CLI command that validates a `HolmesLawEvidence`
    input bundle without making readiness judgments.
  - Required output: PRD for flags, JSON/text output, exit codes, invalid
    bundle diagnostics, and fixture golden outputs.
- [x] HLAW-017 `holmes weslaw assess` CLI PRD and test plan.
  - Feature/product: A Holmes CLI command that evaluates validated law evidence
    into gates, findings, verdict, and a structured report document.
  - Required output: PRD for flags, policy selection, `--fail-on` behavior,
    terminal output, JSON output, and missing optional artifact behavior.
- [x] HLAW-018 `holmes weslaw report` CLI PRD and test plan.
  - Feature/product: A Holmes CLI command that renders a `ReportDocument` as
    Markdown, JSON, terminal text, or file output without publishing anywhere.
  - Required output: PRD for renderer selection, output paths, stdout behavior,
    overwrite policy, and snapshot tests.
- [x] HLAW-019 `LawAssuranceArtifactWriter` PRD and test plan.
  - Feature/product: A local output adapter that writes normalized validation,
    assessment, and rendered report artifacts for CI and later review.
  - Required output: PRD for artifact names, deterministic bytes, directory
    creation, collision policy, and reproducible hash checks.
- [x] HLAW-020 `LawAssuranceExitCodePolicy` PRD and test plan.
  - Feature/product: A CLI exit-code policy for validation errors, assurance
    failures, warnings, publisher failures, and internal errors.
  - Required output: PRD for exit-code table, `--fail-on` gates, CI defaults,
    and negative tests for each category.

### GitHub And MCP Interfaces

- [x] HLAW-021 `GitHubLawAssuranceComment` PRD and test plan.
  - Feature/product: A GitHub PR comment renderer/publisher for law diff,
    coverage, capability, and bundle provenance summaries.
  - Required output: PRD for sticky comment markers, update behavior, markdown
    constraints, truncation, links, and idempotent publishing.
- [x] HLAW-022 `GitHubLawGateCheckSummary` PRD and test plan.
  - Feature/product: A GitHub-facing gate summary that tells reviewers whether
    law evidence is pass, warn, fail, or unavailable.
  - Required output: PRD for review wording, blocked-merge posture, required
    versus advisory gates, and stale evidence detection.
- [x] HLAW-023 `GitHubLawFindingAnnotations` PRD and test plan.
  - Feature/product: A mapping from law findings to PR annotations or comment
    bullets where file/line context exists.
  - Required output: PRD for annotation eligibility, no-line findings,
    deduplication, rate limits, and fallback rendering.
- [x] HLAW-024 `GitHubLawEvidenceLinks` PRD and test plan.
  - Feature/product: A link model that connects PR comments to law artifacts,
    CI runs, bundle manifests, and rendered reports.
  - Required output: PRD for artifact URLs, missing artifact behavior,
    expiration notes, and markdown link safety.
- [x] HLAW-025 `GitHubLawOverrideControls` PRD and test plan.
  - Feature/product: A policy-controlled override surface for maintainers to
    acknowledge advisory law warnings without hiding failed validation.
  - Required output: PRD for labels/checkboxes, audit records, non-overridable
    failures, and drift checkpoint criteria.
- [x] HLAW-026 `McpAssessWeslawBundleTool` PRD and test plan.
  - Feature/product: An MCP tool that assesses a law evidence bundle and
    returns structured gates, findings, and rendered report references.
  - Required output: PRD for request/response schema, workspace authorization,
    error mapping, and deterministic examples.
- [x] HLAW-027 `McpLawEvidenceResources` PRD and test plan.
  - Feature/product: MCP resources exposing law diff, coverage, capability,
    bundle manifest, and rendered law report data.
  - Required output: PRD for resource URIs, caching, access control, invalid
    bundle references, and schema examples.
- [x] HLAW-028 `McpExplainLawFindingTool` PRD and test plan.
  - Feature/product: An MCP tool that explains one Holmes law finding with
    source artifact references and suggested next action.
  - Required output: PRD for finding ids, explanation shape, citation fallback,
    and missing finding behavior.
- [x] HLAW-029 `McpLawPolicyTool` PRD and test plan.
  - Feature/product: An MCP tool that returns active law assurance policy,
    thresholds, required gates, and non-overridable checks.
  - Required output: PRD for policy redaction, profile selection, unknown
    profile errors, and stale policy detection.
- [x] HLAW-030 `AgentSafeLawSummary` PRD and test plan.
  - Feature/product: A compact, structured summary format optimized for agents
    that need law evidence without long Markdown comments.
  - Required output: PRD for token budgets, severity grouping, artifact refs,
    omitted-detail accounting, and MCP/CLI parity.

### Policy, QA Harnesses, Determinism, And Budgets

- [x] HLAW-031 `LawAssurancePolicySchema` PRD and test plan.
  - Feature/product: A versioned policy schema defining required law evidence,
    thresholds, severity mappings, and override rules.
  - Required output: PRD for schema versioning, defaults, profile inheritance,
    unknown fields, and JSON Schema validation.
- [x] HLAW-032 `LawSeverityMappingPolicy` PRD and test plan.
  - Feature/product: A policy layer that maps law diff event kinds and coverage
    gaps to Holmes severities without changing Wesley's semantic classifications.
  - Required output: PRD for mapping table, unmapped event behavior,
    release/local differences, and fixture coverage.
- [x] HLAW-033 `LawCoverageThresholdPolicy` PRD and test plan.
  - Feature/product: A policy layer that sets required coverage floors by
    category and profile.
  - Required output: PRD for pass/warn/fail thresholds, category absences,
    percentage rounding, and boundary-value tests.
- [x] HLAW-034 `LawAssuranceSuppressionPolicy` PRD and test plan.
  - Feature/product: A suppression/audit model for known advisory findings that
    must not suppress invalid evidence or failed binding.
  - Required output: PRD for suppression ids, expiration, reason text, audit
    output, and abuse-prevention tests.
- [x] HLAW-035 `LawAssuranceAuditWitness` PRD and test plan.
  - Feature/product: A deterministic witness artifact recording inputs, policy,
    outputs, hashes, and the exact gates evaluated by Holmes.
  - Required output: PRD for witness schema, hash coverage, replay fields,
    clock injection, and reproducibility tests.
- [x] HLAW-036 `LawAssuranceGoldenFixtureCorpus` PRD and test plan.
  - Feature/product: A fixture corpus covering clean, warning, failing,
    malformed, stale, and missing law evidence bundles.
  - Required output: PRD for fixture naming, expected outputs, snapshot
    regeneration policy, and cross-platform stability.
- [x] HLAW-037 `LawAssuranceNegativeFixtureCorpus` PRD and test plan.
  - Feature/product: A negative fixture set for invalid JSON, unsupported
    versions, hash mismatches, missing artifacts, unknown profiles, and malformed
    policies.
  - Required output: PRD for diagnostic codes, exit behavior, fixture
    isolation, and panic-free guarantees.
- [x] HLAW-038 `LawAssuranceFakeClockAndPorts` PRD and test plan.
  - Feature/product: Dependency-injected clock and in-memory ports for
    deterministic tests across CLI, API, MCP, and GitHub adapters.
  - Required output: PRD for fake-clock API, no-wall-clock assertions, adapter
    contracts, and concurrency-safe tests.
- [x] HLAW-039 `LawAssuranceConcurrencyAndIdempotence` PRD and test plan.
  - Feature/product: Test requirements for repeated, concurrent, and retried
    assessment/publish operations.
  - Required output: PRD for idempotent comment updates, artifact overwrite
    policy, race simulation, and lock-free domain behavior.
- [x] HLAW-040 `LawAssurancePerformanceBudget` PRD and test plan.
  - Feature/product: Performance and size budgets for law evidence validation,
    assessment, rendering, and publishing.
  - Required output: PRD for benchmark fixtures, large report limits, timeout
    seams, memory ceilings, and drift checkpoint criteria.

### Migration, Release Gates, Docs, And Closeout

- [x] HLAW-041 `LegacyHolmesLawEvidenceMapping` PRD and test plan.
  - Feature/product: A mapping from current JavaScript Holmes workflow artifacts
    to the future Rust Holmes law assurance bundle.
  - Required output: PRD for retained fields, rejected fields, migration gaps,
    and compatibility fixtures.
- [x] HLAW-042 `HolmesWorkflowWeslawIntegration` PRD and test plan.
  - Feature/product: CI workflow integration that runs Wesley law commands,
    assembles law evidence, and invokes Holmes assessment.
  - Required output: PRD for job dependencies, artifact paths, failure
    propagation, retry behavior, and branch/fork permissions.
- [x] HLAW-043 `RustHolmesCrateScaffold` PRD and test plan.
  - Feature/product: The initial Rust crate/module structure needed to host
    law assurance domain, application, reporting, and adapters.
  - Required output: PRD for crate boundaries, public API, dependency rules,
    compile-time guard tests, and no-GitHub-in-domain enforcement.
- [x] HLAW-044 `TransitionalHolmesCliAliases` PRD and test plan.
  - Feature/product: Transitional CLI aliases or wrapper behavior that lets
    existing workflows call the new law assurance path without reviving legacy
    Node authority.
  - Required output: PRD for supported aliases, deprecation messages, exit
    parity, and removal gates.
- [x] HLAW-045 `LawAssuranceOperatorDocs` PRD and test plan.
  - Feature/product: Operator documentation for generating law evidence,
    running Holmes law assessment, reading findings, and resolving failures.
  - Required output: PRD for docs locations, command examples, troubleshooting
    matrix, docs command checks, and accessibility of examples.
- [x] HLAW-046 `LawAssuranceSchemaVersioning` PRD and test plan.
  - Feature/product: Versioning and compatibility rules for Holmes law evidence
    bundle schemas, policy schemas, report schemas, and witness schemas.
  - Required output: PRD for semver-like compatibility, unsupported-version
    diagnostics, migration notices, and schema validation tests.
- [x] HLAW-047 `LawAssuranceArtifactRetention` PRD and test plan.
  - Feature/product: Artifact retention rules for local runs, CI runs, PR
    comments, and future dashboard links.
  - Required output: PRD for retention names, overwrite policy, cleanup
    behavior, stale link warnings, and fork-safe behavior.
- [x] HLAW-048 `LawAssuranceEndToEndWorkflow` PRD and test plan.
  - Feature/product: End-to-end workflow from GraphQL SDL and `weslaw` authoring
    through Wesley law artifacts to Holmes findings and PR review output.
  - Required output: PRD for full golden path, failure-path sequence, fixture
    repository layout, and release-gate assertions.
- [x] HLAW-049 `LawAssuranceReleaseGateRollout` PRD and test plan.
  - Feature/product: A staged rollout plan for advisory, required, and
    non-overridable law assurance gates in CI.
  - Required output: PRD for rollout phases, branch protection interaction,
    opt-in/opt-out policy, false-positive handling, and rollback tests.
- [x] HLAW-050 `HolmesWeslawAssuranceCloseout` PRD and test plan.
  - Feature/product: Campaign closeout artifact summarizing completed PRDs,
    open decisions, implementation-ready slices, deferred scope, and next
    engineering branch.
  - Required output: PRD for closeout acceptance, retrospective questions,
    evidence index, backlog suggestions, and BEARING update requirements.

## Initial Recommendation

The first PR spends `HLAW-001` through `HLAW-010`.

Reasoning:

- These slices define the evidence contracts and domain objects that every
  interface depends on.
- They prevent premature CLI/GitHub/MCP design from hardcoding report shape
  before the input contract is stable.
- They give QA a fixture vocabulary early: clean bundle, invalid bundle,
  mismatched hashes, missing coverage, empty capabilities, unsupported versions,
  and stale manifests.
- They preserve Wesley's ownership boundary because Holmes ingests published
  law artifacts instead of recalculating semantic truth.

## Drift Check: HLAW-010

Date: 2026-05-26.

Status: **10 / 50 slices closed**.

Decision: continue with `HLAW-011` through `HLAW-020` next. The evidence intake
chunk confirmed the intended boundary: Holmes consumes Wesley-published law
artifacts, validates their shape and provenance, converts them into findings
and gate decisions, and does not recompute semantic law truth.

No scope correction is needed. Implementation remains out of scope for this
campaign. The next chunk can safely define report sections, CLI operator flows,
artifact writing, and exit-code behavior on top of the evidence contracts
specified here.

## Drift Check: HLAW-025

Date: 2026-05-26.

Status: **25 / 50 slices closed**.

Decision: continue. The report, CLI, local artifact, and GitHub slices still
fit the campaign boundary. Holmes is being specified as an assurance layer that
validates, assesses, reports, publishes, and audits Wesley-produced evidence.
The GitHub override slice deliberately keeps invalid evidence and
non-overridable required gates outside waiver scope.

No scope correction is needed. The next surfaces should be MCP and agent-safe
interfaces over the same domain model, not new law semantics.

## Progress Check: HLAW-035

Date: 2026-05-26.

Status: **35 / 50 slices closed**.

Decision: continue with `HLAW-036` through `HLAW-040` next. The first five
policy/audit slices establish the policy schema, severity mapping, coverage
thresholds, suppression boundaries, and audit witness requirements. The
remaining policy/QA harness work should now pin fixture corpora, fake-clock and
port requirements, concurrency/idempotence, and performance budgets before the
campaign moves into migration and closeout.

## Drift Check: HLAW-040

Date: 2026-05-26.

Status: **40 / 50 slices closed**.

Decision: continue. The policy and QA harness chunk stayed inside the planning
campaign boundary. The golden and negative fixture corpus slices define
repeatable evidence inputs; the fake-clock and port slice prevents wall-clock
or network nondeterminism from entering the future Rust Holmes assurance core;
the concurrency/idempotence slice keeps repeated assessment and publishing
operations boring; and the performance budget slice defines measurable limits
without making Holmes a law compiler or benchmark framework.

No scope correction is needed. The next work should finish migration, workflow,
crate boundary, alias, and operator-documentation planning before the campaign
closes on schema versioning, retention, end-to-end workflow, release gate
rollout, and final closeout.

## Progress Check: HLAW-045

Date: 2026-05-26.

Status: **45 / 50 slices closed**.

Decision: continue with `HLAW-046` through `HLAW-050` next. The migration and
operator-readiness slices now specify how existing JavaScript Holmes artifacts
map into the future Rust law assurance bundle, how CI assembles and invokes the
evidence path, where the Rust crate boundaries must sit, which transitional CLI
aliases are allowed, and what operator documentation must prove. The final five
slices should close schema compatibility, artifact retention, end-to-end
workflow, release-gate rollout, and campaign closeout.

## Drift Check: HLAW-050

Date: 2026-05-26.

Status: **50 / 50 slices closed**.

Decision: close the planning campaign. The final schema-versioning, artifact
retention, end-to-end workflow, release-gate rollout, and closeout slices keep
Holmes on the intended side of the boundary: Holmes validates and judges
Wesley-published law evidence, but it does not compile law, mutate shape,
invent semantic diffs, or reach into external repos for product truth.

No scope correction is needed before PR review. The recommended next
engineering branch should start with the evidence and validation core before
publishers or branch-protection gates:

1. Implement `HolmesLawEvidenceBundle`, artifact locators, and version
   validation from `HLAW-001`, `HLAW-006`, `HLAW-007`, and `HLAW-046`.
2. Implement law diff, coverage, capability, and manifest ingest ports from
   `HLAW-002` through `HLAW-005`.
3. Implement validation result, semantic finding, coverage gate, provenance
   gate, and audit witness models from `HLAW-007` through `HLAW-010` and
   `HLAW-035`.
4. Add golden and negative fixture corpora from `HLAW-036` and `HLAW-037`.
5. Only then add CLI/report/publisher surfaces from later HLAW slices.

Deferred scope remains explicit: Law Matrix, LSP support, hosted dashboards,
external repo adoption, live branch-protection rollout, and Rust Holmes
implementation are outside this planning packet and need their own execution
branches.

## Non-Goals For The 50-Slice Planning Campaign

- Do not implement Rust Holmes crates yet.
- Do not replace the current GitHub workflow yet.
- Do not change `weslaw` semantics, hashes, or law diff classifications.
- Do not edit Echo, jedit, Continuum, warp-ttd, git-warp, or
  `wesley-postgres` from this branch.
- Do not make Holmes a law compiler.
- Do not build the Law Matrix static site in this campaign.
