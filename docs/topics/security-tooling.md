# Security Tooling

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when evaluating a security scanner, advisory gate, or workflow
hardening change for Wesley.

Wesley is currently a compiler and tooling repository. It does not ship a hosted
HTTP service, browser application, database runtime, or long-lived daemon. The
security tooling posture therefore focuses on the compiler surface:

- dependency and supply-chain advisories,
- generated-source safety,
- artifact and path handling,
- GitHub Actions permissions and egress visibility,
- domain-empty boundary regressions.

Security tooling in this repo should not claim that Wesley has proved
downstream runtime, database, product, or target-module security semantics.
Those claims belong to the owning target module or sibling repository.

## Current Baseline

| Surface                                   | Current Gate                                                                                                 | Status                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| JavaScript and TypeScript static analysis | `.github/workflows/codeql.yml` runs CodeQL with `security-and-quality` queries.                              | Active on `main`, PRs into `main`, and weekly schedule.                    |
| Pull-request dependency changes           | `.github/workflows/dependency-review.yml` runs Dependency Review.                                            | Active on PRs into `main`; fails on high severity.                         |
| Repository supply-chain posture           | `.github/workflows/scorecards.yml` runs OpenSSF Scorecard and uploads SARIF.                                 | Active on `main`, weekly schedule, and manual dispatch.                    |
| Workflow egress visibility                | GitHub Actions jobs use `step-security/harden-runner` in audit mode.                                         | Active as visibility, not a blocking egress policy.                        |
| JavaScript advisory audit                 | Dependabot and `.github/workflows/dependency-review.yml` track JavaScript dependency advisories.             | `pnpm audit` was removed from preflight after npm retired its audit endpoint (HTTP 410). |
| Rust advisory audit                       | `cargo xtask release-guard` and release workflows run `cargo audit`.                                         | Active for release readiness and publication.                              |
| Rust product quality                      | `cargo xtask preflight` runs formatting, Clippy, workspace tests, docs checks, and a native CLI smoke test.  | Active in the strict local gate.                                           |
| Domain-empty regression checks            | `test/domain-empty-boundary.bats` guards core source vocabulary.                                             | Active in repository validation.                                           |
| Emitter source-safety regressions         | Emitter tests parse or compile generated output and include source-level guards where a printer rule exists. | Active for covered emitters and expected to grow with risky printer paths. |

## Evaluation Matrix

| Candidate                     | Decision                           | Rationale                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWASP ZAP or other DAST       | Do not add now.                    | Wesley has no hosted runtime surface to crawl. Add DAST only if a future Wesley-owned web/API surface ships in this repo.                                                                                                             |
| Semgrep with broad auto rules | Do not add as a blocking gate now. | Broad rule packs are likely to create high review cost for a compiler repo. Prefer repo-owned rules with focused fixtures.                                                                                                            |
| Repo-specific Semgrep rules   | Candidate.                         | Useful fits are unsafe source interpolation in emitters, path traversal in artifact readers, and accidental domain semantics in core. Each rule needs a local reproducer and a documented false-positive policy before it blocks PRs. |
| `cargo-deny`                  | Candidate.                         | Useful for license, advisory, duplicate, and ban policy once `deny.toml` exists and ownership is clear. Start advisory or scheduled before making it required.                                                                        |
| Harden-runner blocking egress | Defer.                             | Audit mode provides evidence today. Blocking egress should wait until the workflow egress inventory is stable enough that normal release work is not noisy.                                                                           |

## Gate Admission Rules

A new security gate belongs in Wesley only when all of these are true:

1. It protects a Wesley-owned compiler, CLI, artifact, docs, CI, or release
   surface.
2. It has a local command or focused fixture so contributors can reproduce the
   failure without guessing at GitHub Actions state.
3. It has a clear owner and a documented exception format.
4. It does not duplicate an existing gate without adding a distinct signal.
5. It starts as advisory or scheduled when the false-positive rate is unknown.
6. It documents what the gate proves and what it does not prove.

When a gate fails because of an advisory that is not exploitable in Wesley's
actual product surface, document the package path, exposure analysis, temporary
mitigation, and expiration or revisit date.

## Near-Term Fits

The most useful next gates are narrow and repo-specific:

- emitter printer rules that catch direct interpolation of schema, law, or
  directive strings into generated source,
- artifact-reader rules that reject path escape regressions,
- source-boundary rules that keep database, runtime, and product semantics out
  of `wesley-core`,
- an advisory `cargo-deny` policy once license and ban ownership is written
  down.

Keep DAST and hosted-application scanners out of Wesley until Wesley owns a
hosted application surface.

## Related Authority

- [Security Policy](../../SECURITY.md)
- [CI Workflows](./ci-workflows.md)
- [Validation](./validation.md)
- [Compiler Boundary](./compiler-boundary.md)
- [Release Policy](../governance/RELEASE_POLICY.md)
