# Assurance Evidence

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when a change touches HOLMES, Watson, Moriarty, BLADE, policy
templates, evidence bundles, or report interpretation.

Assurance tooling judges explicit evidence. It does not replace the compiler,
and it does not create product semantics for GraphQL.

## Current Surfaces

| Surface                               | Use For                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `packages/wesley-holmes/`             | Retained JavaScript assurance reporting tools.            |
| `crates/wesley-holmes/`               | Rust foundation for assurance data models and validation. |
| `docs/holmes-policy/`                 | Policy documentation.                                     |
| `docs/templates/holmes-policy/`       | Policy templates for host contexts.                       |
| `docs/architecture/holmes-*`          | Architecture and integration notes.                       |
| `.github/workflows/wesley-holmes.yml` | Pull request assurance workflow.                          |

## Rules Of Thumb

- Reports should expose unavailable or invalid evidence honestly.
- Missing artifacts should not be hidden behind a passing workflow.
- Policy and report quality are evidence questions, not compiler semantics.
- Domain-specific target facts should be produced by the owning target module.

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
