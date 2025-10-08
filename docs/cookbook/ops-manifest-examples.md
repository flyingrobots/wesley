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

## Explain JSON for parameterized ops

Provide example arguments to run EXPLAIN (FORMAT JSON) for parameterized ops via `--ops-explain-json --ops-dsn`.

```json
{
  "include": ["**/*.op.json"],
  "explainArgs": {
    "products_by_name": ["'Al%'"],
    "orders_by_user": ["'00000000-0000-0000-0000-000000000000'::uuid"]
  }
}
```

Run:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema example/ecommerce.graphql \
  --ops example/ops \
  --ops-manifest example/ops/manifest.json \
  --ops-explain-json \
  --ops-dsn "postgres://wesley:wesley_test@localhost:5432/wesley_test" \
  --out-dir example/out
```

Notes
- Values in `explainArgs` are inserted as raw SQL expressions by position; quote and cast as needed.
- Keys are matched against the sanitized op name (lowercased, non‑alphanumeric → `_`).
