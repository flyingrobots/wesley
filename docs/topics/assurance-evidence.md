# Assurance Evidence

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when a change touches HOLMES, Watson, Moriarty, BLADE, policy
templates, evidence bundles, or report interpretation.

Assurance tooling judges explicit evidence. It does not replace the compiler,
and it does not create product semantics for GraphQL.

Use the [Assurance Capability Matrix](../reference/assurance-capability-matrix.md)
to distinguish shipped native CLI capabilities, transitional JavaScript tooling,
Rust foundation code, and concept/design-only vocabulary.

## Current Surfaces

| Surface                               | State                   | Use For                                                                                         |
| ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| Native `wesley law ...` commands      | Shipped native CLI      | Law validation, diffing, explanation, capability, and coverage facts.                           |
| `packages/wesley-holmes/`             | Shipped JS/transitional | Retained JavaScript assurance reporting tools.                                                  |
| `crates/wesley-holmes/`               | Internal foundation     | Rust assurance data models, validation, ports, and diagnostics without public CLI commands yet. |
| `docs/holmes-policy/`                 | Documentation           | Policy documentation.                                                                           |
| `docs/templates/holmes-policy/`       | Documentation           | Policy templates for host contexts.                                                             |
| `docs/architecture/holmes-*`          | Design/reference        | Architecture and integration notes.                                                             |
| `.github/workflows/wesley-holmes.yml` | Shipped JS/transitional | Pull request assurance workflow.                                                                |
| `.github/workflows/cert-shipme.yml`   | Shipped JS/transitional | Post-merge SHIPME certificate workflow.                                                         |

## Rules Of Thumb

- Reports should expose unavailable or invalid evidence honestly.
- Missing artifacts should not be hidden behind a passing workflow.
- Policy and report quality are evidence questions, not compiler semantics.
- PR-time HOLMES evidence and post-merge SHIPME certification are distinct
  gates. SHIPME records the landed `main` SHA, not the temporary PR merge SHA.
- Domain-specific target facts should be produced by the owning target module.
- Watson, Moriarty, and BLADE follow the Assurance Capability Matrix. Treat a
  surface as shipped only when the matrix marks it shipped.

## Useful Checks

```bash
node --test packages/wesley-holmes/test/pr-comment.test.mjs
BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats
cargo test -p wesley-holmes
```

## Related Authority

- [HOLMES CI](./holmes-ci.md)
- [HOLMES Architecture](../architecture/holmes-architecture.md)
- [HOLMES Integration](../architecture/holmes-integration.md)
- [HOLMES Policy Spec](../holmes-policy-spec.md)
- [Policy Templates](../templates/holmes-policy/README.md)
- [Assurance Capability Matrix](../reference/assurance-capability-matrix.md)
