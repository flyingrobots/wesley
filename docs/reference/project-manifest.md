# Wesley Project Manifest

<!-- docs-truth: status=current owner=@flyingrobots -->

The Wesley project manifest is a domain-free JSON or YAML file that names
GraphQL schema sets, output/evidence locations, changed-file rebuild rules, PR
comment behavior, dashboard artifacts, and generic target descriptors.

It does not define database behavior, runtime law, product semantics, renderer
semantics, or external module execution. Wesley reads the manifest to decide
which GraphQL structure to lower and which generic target metadata is selected;
extensions and sibling repos decide what those targets mean.

## File Names

The native CLI discovers the first manifest it finds while walking upward from
the current directory:

- `wesley.config.json`
- `wesley.config.yaml`
- `wesley.config.yml`
- `.wesley/config.json`

The retired JavaScript `wesley.config.mjs` loader is not the active config
surface for Wesley core. Use JSON or YAML for current project manifests.

## Commands

```bash
wesley config validate --config wesley.config.json --json
wesley config inspect --config wesley.config.json --json
wesley config changed-schemas \
  --config wesley.config.json \
  --changed test/fixtures/examples/ecommerce.graphql \
  --json
```

`schema lower`, `schema hash`, and `schema operations` can omit `--schema` only
when the discovered manifest has exactly one schema path. Multi-schema
manifests require an explicit `--schema` for those commands.

## Minimal Manifest

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": ["schema.graphql"]
}
```

Defaults:

| Field         | Default                      |
| ------------- | ---------------------------- |
| `apiVersion`  | `wesley.project-manifest/v1` |
| `bundleDir`   | `.wesley-cache`              |
| `commentMode` | `update`                     |
| `dashboard`   | disabled                     |
| `targets`     | empty                        |

## Multi-Schema Manifest

```json
{
  "apiVersion": "wesley.project-manifest/v1",
  "schemaPaths": [
    {
      "id": "core",
      "path": "schemas/core/schema.graphql",
      "rebuildOnGlobs": ["schemas/core/**"]
    },
    {
      "id": "audit",
      "path": "schemas/audit/schema.graphql",
      "rebuildOnGlobs": ["schemas/audit/**"]
    }
  ],
  "bundleDir": ".wesley-cache",
  "rebuildOnGlobs": ["wesley.config.json"],
  "commentMode": "update",
  "dashboard": {
    "enabled": true,
    "artifactPath": "docs/holmes-dashboard"
  }
}
```

`wesley config changed-schemas` selects schema sets deterministically:

- no changed files: every schema set is selected
- changed file equals a schema path: that schema set is selected
- changed file matches a schema's `rebuildOnGlobs`: that schema set is selected
- changed file matches top-level `rebuildOnGlobs`: every schema set is selected
- no match: no schema set is selected

For multi-schema manifests, selected schemas receive isolated bundle
directories under `bundleDir`:

```json
{
  "selectedSchemaPaths": [
    {
      "id": "core",
      "path": "schemas/core/schema.graphql",
      "bundleDir": ".wesley-cache/core",
      "reason": "matched schema rebuild glob `schemas/core/**`"
    }
  ]
}
```

Schema IDs must be path-safe because workflow artifacts and bundle directories
use them. IDs may contain only ASCII letters, digits, `.`, `_`, and `-`.

## Target Compatibility

Targets are selected metadata, not built-in domain behavior.

```json
{
  "targets": [
    {
      "name": "rust-models",
      "module": "wesley.emit.rust",
      "default": true,
      "outputDir": "generated/rust"
    },
    {
      "name": "typescript-declarations",
      "module": "wesley.emit.typescript",
      "outputDir": "generated/typescript"
    }
  ]
}
```

Compatibility is expressed with generic fields:

| Field            | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `name`           | Stable target name. Must be unique.                                |
| `module`         | Optional module identity that owns target behavior.                |
| `default`        | Marks the single default target. More than one default is invalid. |
| `outputDir`      | Optional target output directory.                                  |
| `exclusiveGroup` | Targets in the same selected group are mutually exclusive.         |
| `conflictsWith`  | Explicit target names this target cannot be selected with.         |

Example invalid selection:

```json
{
  "targets": [
    { "name": "alpha-models", "exclusiveGroup": "model-emitter" },
    { "name": "beta-models", "exclusiveGroup": "model-emitter" }
  ]
}
```

The validator reports:

```text
exclusive group 'model-emitter' selects multiple targets: alpha-models, beta-models
```

Wesley does not ship a Prisma, Drizzle, Postgres, Continuum, Echo, Vite, Vue, or
product-specific compatibility matrix. Those matrices belong to the owning
external target modules or sibling repos.

## Validation Rules

`wesley config validate` rejects:

- unsupported `apiVersion`
- unknown top-level fields
- unknown fields inside detailed `schemaPaths` entries
- blank schema IDs or paths
- schema IDs that are not path-safe
- duplicate schema IDs
- duplicate schema paths
- blank `bundleDir`
- blank target names
- duplicate target names
- multiple default targets
- multiple selected targets in one `exclusiveGroup`
- `conflictsWith` references that point at another selected target

The manifest schema is intentionally small so Wesley can remain a compiler
front door rather than a domain platform.
