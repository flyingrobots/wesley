# Project Manifests

<!-- docs-truth: status=current owner=@flyingrobots -->

Use a Wesley project manifest when a checkout needs named schema sets,
changed-schema selection, bundle isolation, dashboard metadata, or generic
target descriptors.

The manifest is domain-free. It says which GraphQL structures and generic
targets are selected; it does not define what a database, renderer, runtime, or
product target means.

## Common Tasks

Validate the current manifest:

```bash
wesley config validate --json
```

Inspect resolved schema paths and targets:

```bash
wesley config inspect --json
```

Select schema sets affected by changed files:

```bash
wesley config changed-schemas \
  --changed test/fixtures/reference/schema.graphql \
  --json
```

Read changed files from a newline-delimited file:

```bash
wesley config changed-schemas --changed-file changed-files.txt --json
```

## Rules Of Thumb

- Single-schema manifests can be discovered by `schema lower`, `schema hash`,
  and `schema operations` when `--schema` is omitted.
- Multi-schema manifests require explicit `--schema` for direct schema
  commands.
- Top-level rebuild globs select every schema set.
- Schema-local rebuild globs select only that schema set.
- Selected multi-schema bundles are isolated under `bundleDir/<schema-id>`.
- `commentMode` controls PR comment behavior for automation:
  `update`, `append`, or `silent`.
- Target names are metadata. External modules own target behavior.

## Related Authority

- [`docs/reference/project-manifest.md`](../reference/project-manifest.md)
- [`docs/reference/cli.md`](../reference/cli.md#config)
- [`docs/topics/compiler-boundary.md`](./compiler-boundary.md)
- [`wesley.config.json`](../../wesley.config.json)
