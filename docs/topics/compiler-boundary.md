# Compiler Boundary

<!-- docs-truth: status=current owner=@flyingrobots -->

Wesley's core job is narrow:

```text
GraphQL SDL -> deterministic Wesley IR -> external owners assign meaning.
```

Use this topic when deciding whether a proposed change belongs in Wesley core,
an emitter, an external target module, or a sibling repo.

## Ownership Rule

| Change Type                                              | Home                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| GraphQL parsing, normalization, L1 IR shape, hashes      | `wesley-core`                                                |
| Generic schema diff, operation facts, directive data     | `wesley-core` and `wesley-cli`                               |
| Generic Rust or TypeScript projection behavior           | `crates/wesley-emit-rust` or `crates/wesley-emit-typescript` |
| Project schema-set metadata and changed-schema selection | Wesley project manifest APIs and CLI                         |
| Target semantics, runtime policy, renderer behavior      | External module or sibling repo                              |
| Postgres, migrations, Supabase, DDL, pgTAP               | `wesley-postgres` or another database-owned repo             |
| Echo, Continuum, Geordi, Edict, product-specific law     | The owning product or protocol repo                          |

Wesley may carry hermetic fixtures that prove compiler behavior. Those fixtures
must not make the fixture's domain a Wesley product responsibility.

## Before Editing

Ask these questions:

1. Does the change alter how GraphQL structure is lowered, hashed, diffed, or
   exposed as generic compiler facts?
2. Does it add target-specific meaning that a downstream module should own?
3. Does it require a product, database, renderer, runtime, scheduler, or
   deployment assumption?
4. Can the behavior be tested with domain-empty or descriptor-only fixtures?

If the answer to question 3 is yes, stop before adding it to Wesley core and
move the behavior to an owning extension or repo.

## Related Authority

- [`docs/design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md`](../design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)
- [`docs/guides/module-authoring.md`](../guides/module-authoring.md)
- [`docs/reference/project-manifest.md`](../reference/project-manifest.md)
- [`docs/GUIDE.md`](../GUIDE.md)
