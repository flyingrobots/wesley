# Artifacts And Cache

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this topic when generated files, cache directories, evidence bundles, or
report artifacts appear in the checkout.

Generated outputs are disposable unless a specific release or audit process
says otherwise. Source files, manifests, docs, tests, and checked-in fixtures
remain the durable repo truth.

## Common Locations

| Location                          | Meaning                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `.wesley-cache/`                  | Default generated evidence/cache location for Wesley workflows. |
| `out/`                            | Default output root for explicit native emit commands.          |
| `test/fixtures/**/out/`           | Fixture-generated artifacts.                                    |
| `test/fixtures/**/.wesley-cache/` | Fixture-generated evidence bundles.                             |
| `coverage/`                       | Test coverage output.                                           |
| `dist/`                           | Package build output where retained packages emit bundles.      |
| `reports-by-schema/`              | HOLMES workflow staging layout for schema-scoped reports.       |

## Rules Of Thumb

- If a generated path is gitignored, assume it can be deleted and regenerated.
- Do not make generated files an authority over authored GraphQL.
- External targets own their own cache and output layouts.
- HOLMES report artifacts are evidence surfaces, not source inputs.

## Related Authority

- [Build Artifacts Reference](../build-artifacts.md)
- [Project Manifests](./project-manifests.md)
- [HOLMES CI](./holmes-ci.md)
- [Validation](./validation.md)
