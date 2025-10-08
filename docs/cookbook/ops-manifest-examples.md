# Ops Manifest Cookbook

This page shows common patterns for `--ops-manifest` discovery.

## Basic include/exclude

```json
{
  "include": ["**/*.op.json"],
  "exclude": ["_drafts/**"],
  "allowEmpty": false
}
```

## Compile a team’s subfolder only

```json
{
  "include": ["team-a/**/*.op.json"],
  "allowEmpty": false
}
```

## Stage-by-stage subsets

```json
{
  "include": ["stage1/**/*.op.json", "stage2/**/*.op.json"],
  "exclude": ["stage2/_hold/**"],
  "allowEmpty": false
}
```

## Tips

- Manifest is validated against `schemas/ops-manifest.schema.json`.
- `allowEmpty` controls whether 0 matches should fail. CLI also honors `--ops-allow-empty`.
- Discovery expands globs relative to the `--ops` directory, subtracts `exclude`, then sorts files deterministically.
- Sanitized-name collisions fail with a clear error listing colliding files. Keep op names unique post-sanitization.

