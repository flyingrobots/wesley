# Invariants

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when a change might violate a stable Wesley property.

Invariants are durable repo truths. They are not release goals, preferences,
or live planning state.

## Current Invariant Families

| Family                | Protects                                                 |
| --------------------- | -------------------------------------------------------- |
| Schema source truth   | Authored schema remains the source of truth.             |
| Git boundary truth    | Tests and tools do not mutate real git state carelessly. |
| Publication boundary  | Release and publication claims are witnessed.            |
| Evidence truth        | Evidence claims stay scoped and inspectable.             |
| Governance boundaries | Process state stays in the right surface.                |
| Docs runtime honesty  | Docs do not claim runtime behavior falsely.              |

The exact invariant list lives in [Invariants](../invariants/README.md).

## Rules Of Thumb

- Add a new invariant only when the property is stable and cross-cutting.
- Use tests, docs checks, release guards, or Bats guards to preserve invariants
  where practical.
- Do not hide phase-specific contracts inside invariant prose.
- If a current doc contradicts an invariant, fix the doc or the implementation
  before release.

## Related Authority

- [Invariants](../invariants/README.md)
- [Compiler Boundary](./compiler-boundary.md)
- [Docs Maintenance](./docs-maintenance.md)
- [Validation](./validation.md)
