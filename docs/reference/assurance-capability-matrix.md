# Assurance Capability Matrix

<!-- docs-truth: status=current owner=@flyingrobots -->

This page separates shipped Wesley assurance surfaces from transitional,
foundation, and concept-only surfaces.

Wesley emits deterministic evidence inputs: schema hashes, metadata sidecars,
law hashes, bundle manifests, coverage reports, and machine-readable
diagnostics. Assurance tooling is experimental unless a command or workflow is
listed here as shipped.

## Status States

| State                   | Meaning                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| Shipped native CLI      | Executable through the Rust `wesley` binary in the current release.   |
| Shipped JS/transitional | Executable through retained JavaScript tooling or GitHub workflows.   |
| Internal foundation     | Rust library code and tests exist, but there is no public native CLI. |
| Concept/design only     | Design vocabulary exists, but no repo-local command is shipped.       |

## Matrix

| Capability                            | State                   | Executable Surface                                                  | What It Proves Or Produces                                                                              | What It Does Not Prove                                                             |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Schema lowering and schema hash       | Shipped native CLI      | `wesley schema lower`, `wesley schema hash`                         | Deterministic compiler view of GraphQL structure and its hash.                                          | Runtime behavior, database correctness, deployment safety.                         |
| Operation catalog and selection facts | Shipped native CLI      | `wesley schema operations`, `wesley operation selections`           | Root operation facts and selected response paths from GraphQL input.                                    | Application authorization, runtime footprints, live query execution.               |
| Directive argument extraction         | Shipped native CLI      | `wesley operation directive-args`                                   | Generic directive payload data from operation documents.                                                | The meaning or safety of those directive payloads.                                 |
| `weslaw/v1` validation and hashes     | Shipped native CLI      | `wesley law validate`, `wesley law lint`, `wesley law rebind`       | Law document structure, schema binding, hashes, and diagnostics.                                        | That a downstream runtime obeys the law.                                           |
| `weslaw/v1` diff and explanation      | Shipped native CLI      | `wesley law diff`, `wesley law explain`                             | Semantic law deltas and subject-oriented explanations.                                                  | Product policy approval or deployment readiness.                                   |
| Law capability and coverage reports   | Shipped native CLI      | `wesley law capabilities`, `wesley law coverage`                    | Report-only footprint summaries and profile/category coverage facts.                                    | Runtime enforcement, admission control, or authorization guarantees.               |
| Emitter metadata sidecars             | Shipped native CLI      | `wesley emit ... --metadata-out <path>`                             | Schema/law hashes, generator identity, and emission mode metadata.                                      | That generated source compiles in every downstream project.                        |
| HOLMES PR reports                     | Shipped JS/transitional | `packages/wesley-holmes/`, `.github/workflows/wesley-holmes.yml`    | Pull-request evidence reporting from retained JavaScript tooling.                                       | Native Rust Holmes CLI parity or broad external hosting guarantees.                |
| SHIPME certificate workflow           | Shipped JS/transitional | `.github/workflows/cert-shipme.yml`                                 | Post-merge certificate artifacts for matching path-filtered `main` pushes.                              | That every landed `main` SHA receives a SHIPME artifact.                           |
| Rust Holmes law-assurance foundation  | Internal foundation     | `crates/wesley-holmes/` Rust APIs and tests                         | Artifact-family version envelopes, evidence bundle models, gates, diagnostics, and deterministic ports. | A public `wesley holmes ...` command.                                              |
| Rust Holmes MVP CLI                   | Concept/design only     | Not shipped                                                         | Deferred candidate: validate contract bundle and law evidence files, then emit JSON diagnostics.        | GitHub integration, policy approval, or release certification.                     |
| Watson verification                   | Shipped JS/transitional | `holmes verify`, `.github/workflows/wesley-holmes.yml`              | Independent verification reports for Holmes evidence artifacts and citations.                           | Native Rust Watson CLI parity, runtime enforcement, or broad assurance guarantees. |
| Moriarty prediction                   | Shipped JS/transitional | `moriarty`, `holmes predict`, `.github/workflows/wesley-holmes.yml` | Advisory readiness and trend forecasts from retained JavaScript tooling.                                | Native Rust Moriarty CLI parity, policy approval, or release certification.        |
| BLADE                                 | Concept/design only     | Not shipped as a repo-local command or workflow                     | Design vocabulary for release-readiness certification.                                                  | A native release-certification command in this repository.                         |

## Public Claim Rule

Use this wording for current public docs:

> Wesley emits deterministic evidence inputs and ships experimental assurance
> tooling around them. A capability is shipped only when this matrix lists an
> executable command or workflow.

Avoid broad claims that Wesley provides cryptographic assurance by itself. The
compiler provides deterministic inputs. Assurance commands and workflows prove
bounded properties named by their command, policy, artifact, or workflow.

## Rust Holmes MVP Status

The Rust Holmes MVP command is explicitly deferred. The likely first native
command should stay narrow:

```text
validate a contract bundle manifest and law evidence bundle from files,
emit JSON diagnostics, and avoid GitHub integration
```

Until that command exists with examples, tests, and release evidence, Rust
Holmes remains an internal foundation rather than a shipped user-facing CLI.

## End-To-End Evidence Examples

Schema evidence:

- Command: `wesley schema hash --schema schema.graphql`
- Proves: the normalized compiler view of `schema.graphql` has a stable hash.
- Does not prove: the application deployed that schema or used it safely.

Emitter metadata:

- Command: `wesley emit rust --schema schema.graphql --out generated.rs --metadata-out generated.metadata.json`
- Proves: the generated artifact records schema hash, generator identity, and
  emission mode metadata.
- Does not prove: the generated artifact was integrated, compiled, or deployed
  by a downstream project.

Law coverage:

- Command: `wesley law coverage --schema schema.graphql --law contract.weslaw --profile release --json`
- Proves: the authored law bundle has the reported category/profile coverage
  against the active schema.
- Does not prove: a runtime enforced those laws.
