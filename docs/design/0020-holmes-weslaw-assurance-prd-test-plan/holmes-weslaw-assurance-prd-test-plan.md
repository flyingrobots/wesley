---
title: Holmes weslaw Assurance PRD And Test Plan Campaign
legend: SPEC
packet: 0020-holmes-weslaw-assurance-prd-test-plan
status: superseded
release: v0.0.8
---

# Holmes `weslaw` Assurance PRD And Test Plan Campaign

> [!IMPORTANT]
> This packet is historical. Design packet
> [0023](../0023-remove-weslaw/SOURCE_remove-weslaw.md) removed Weslaw and its
> Rust assurance foundation. Nothing below describes supported or planned
> product work.

This packet is superseded planning evidence. It is not a live implementation
tracker.

Live Holmes and `weslaw` implementation work belongs in GitHub Issues,
goalpost milestones, release-gate issues, and the
[Wesley Roadmap Project](https://github.com/users/flyingrobots/projects/18).

## Question

How should Wesley shape Holmes-facing `weslaw` assurance so Holmes can consume
Wesley outputs as evidence without taking ownership of semantic law truth?

## Hill

The campaign was a product-management and QA planning campaign, not a code-first
campaign.

Each artifact under `prds/` defines one Holmes-facing `weslaw` assurance feature
with measurable behavior, non-goals, BDD acceptance criteria, and
negative/non-functional testing before Rust crates, CLI commands, MCP tools, or
GitHub publishers are built.

## Product Boundary

Wesley owns compiler truth and `weslaw` law artifacts. Holmes owns assurance
judgment over evidence. Holmes may ingest `weslaw` outputs and produce findings,
gates, reports, and recommendations. Holmes must not reinterpret GraphQL shape,
mutate law, rebind law, invent semantic diffs, or become the source of truth for
contract bundles.

## Artifact Contract

Every PRD/test-plan artifact under `prds/` uses this section contract:

1. `Feature Overview & Objectives`
2. `Scope Definition`
3. `Detailed User Stories`
4. `Acceptance Criteria (BDD Format)`
5. `Detailed Test Plan`

The canonical artifact template is [prds/README.md](./prds/README.md).

Each artifact was written from two roles at once:

- Expert Technical Product Manager: define user value, scope, metrics, and
  acceptance criteria.
- Lead QA Engineer: define deterministic validation, fixture strategy, failure
  modes, and non-functional test coverage.

The artifact set names command surfaces, artifact shapes, expected fields,
policy decisions, failure behavior, and test fixtures where known. It does not
stand in for the live implementation backlog.

## Artifact Groups

The PRD/test-plan artifacts are grouped by assurance concern:

| Group                                          | Scope                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence intake and typed domain contracts     | Evidence bundles, law diff ingest, law coverage ingest, law capability ingest, bundle manifests, artifact location, validation results, semantic findings, coverage gates, and traceability gates.          |
| Report model, CLI, and local artifacts         | Report document shape, report sections, local validation/assessment/report commands, exit codes, and local artifact writing.                                                                                |
| GitHub and MCP interfaces                      | GitHub comments/checks/annotations/evidence links/override controls plus MCP tools and resources over the same assurance model.                                                                             |
| Policy, QA harnesses, determinism, and budgets | Agent-safe summaries, policy schemas, severity mapping, coverage thresholds, suppression policy, audit witnesses, golden/negative fixtures, fake clocks, idempotence, and performance budgets.              |
| Migration, release gates, docs, and closeout   | Legacy mapping, workflow integration, Rust crate scaffold boundaries, transitional aliases, operator docs, schema versioning, retention, end-to-end workflows, release-gate rollout, and closeout evidence. |

The individual artifacts remain under [prds/](./prds/).

## Checkpoint Evidence

Historical checkpoints were used to verify that the campaign stayed inside the
intended boundary:

- Evidence intake confirmed that Holmes consumes Wesley-published law artifacts
  and does not recompute semantic law truth.
- Report, CLI, local artifact, GitHub, MCP, policy, and audit slices kept the
  same evidence/judgment separation.
- QA planning pinned fixture corpora, fake clocks, port seams,
  concurrency/idempotence behavior, and performance budgets before
  implementation.
- Migration and operator-readiness planning described how existing JavaScript
  Holmes artifacts map into the future Rust law assurance bundle without
  reviving legacy Node compiler authority.
- Closeout confirmed deferred scope: Law Matrix, LSP support, hosted dashboards,
  external repo adoption, live branch-protection rollout, and Rust Holmes
  implementation require separate GitHub-tracked work.

## Implementation Recommendation

Engineering work should proceed from evidence contracts outward:

1. Implement `HolmesLawEvidenceBundle`, artifact locators, and version
   validation.
2. Implement law diff, coverage, capability, and manifest ingest ports.
3. Implement validation result, semantic finding, coverage gate, provenance
   gate, and audit witness models.
4. Add golden and negative fixture corpora.
5. Add CLI, report, publisher, and MCP surfaces only after the evidence core is
   stable.

Track those implementation slices in GitHub, not in this packet.

## Non-Goals

- Do not implement Rust Holmes crates in this planning packet.
- Do not replace the current GitHub workflow in this planning packet.
- Do not change `weslaw` semantics, hashes, or law diff classifications.
- Do not edit Echo, jedit, Continuum, warp-ttd, git-warp, or
  `wesley-postgres` from this packet.
- Do not make Holmes a law compiler.
- Do not build the Law Matrix static site in this packet.
