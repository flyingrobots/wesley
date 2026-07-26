# Assurance Capability Matrix

<!-- docs-truth: status=current owner=@flyingrobots -->

This page separates shipped Wesley assurance surfaces from transitional,
foundation, and concept-only surfaces.

Wesley emits deterministic evidence inputs: schema hashes, metadata sidecars,
generation provenance, and machine-readable diagnostics. Assurance tooling is
experimental unless a command or workflow is listed here as shipped.

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
| Emitter metadata sidecars             | Shipped native CLI      | `wesley emit ... --metadata-out <path>`                             | Schema hash, generator identity, and emission mode metadata.                                            | That generated source compiles in every downstream project.                        |
| HOLMES PR reports                     | Shipped JS/transitional | `packages/wesley-holmes/`, `.github/workflows/wesley-holmes.yml`    | Pull-request evidence reporting from retained JavaScript tooling.                                       | Native Rust Holmes CLI parity or broad external hosting guarantees.                |
| SHIPME certificate workflow           | Shipped JS/transitional | `.github/workflows/cert-shipme.yml`                                 | Post-merge certificate artifacts for matching path-filtered `main` pushes.                              | That every landed `main` SHA receives a SHIPME artifact.                           |
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
