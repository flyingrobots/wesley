# echo-ir/v2 Specification

Revision: 2026-03-07 (WES-001–005)

## Overview

`echo-ir/v2` is the second iteration of the Echo IR format emitted by
`@wesley/generator-echo`. It extends v1 with hash-chain integrity fields,
per-type identity/layout metadata, and per-field join strategy annotations.

## Top-Level Fields

| Field | Type | Description | New in v2? |
|---|---|---|---|
| `ir_version` | `string` | Always `"echo-ir/v2"` | Changed |
| `codec_id` | `string` | Canonical codec identifier (e.g. `"cbor-canon-v1"`) | No |
| `registry_version` | `number` | Monotonic registry version | No |
| `contract_version` | `string` | Semver contract version (e.g. `"1.0.0"`) | Yes |
| `generated_by` | `{ tool: string, version: string }` | Generator metadata | No |
| `schema_sha256` | `string` (64-char hex) | SHA-256 of the SDL (kept for v1 compat) | No |
| `schema_hash` | `string` (64-char hex) | Same value as `schema_sha256`; canonical v2 name | Yes |
| `registry_hash` | `string \| null` (64-char hex) | Hash of the registry portion of the IR | Yes |
| `hash_chain` | `object \| null` | Full hash-chain object (E1.4) | Yes |
| `types` | `Type[]` | Array of type definitions | No |
| `ops` | `Op[]` | Array of operation definitions | No |

## Type Definition

Each entry in `types` is one of:

### OBJECT Type

| Field | Type | Description | New in v2? |
|---|---|---|---|
| `name` | `string` | Type name | No |
| `kind` | `"OBJECT"` | Type kind | No |
| `type_id` | `string` | Stable type identity (currently same as `name`) | Yes |
| `layout_hash` | `string \| null` | Codec layout hash (`null` until E2a) | Yes |
| `has_join` | `boolean` | Whether any field has a `@wes_join` directive | Yes |
| `fields` | `Field[]` | Array of field definitions | No |

### ENUM Type

| Field | Type | Description | New in v2? |
|---|---|---|---|
| `name` | `string` | Type name | No |
| `kind` | `"ENUM"` | Type kind | No |
| `type_id` | `string` | Stable type identity (currently same as `name`) | Yes |
| `layout_hash` | `string \| null` | Codec layout hash (`null` until E2a) | Yes |
| `values` | `string[]` | Enum variant names | No |

## Field Definition

Each entry in an OBJECT type's `fields`:

| Field | Type | Description | New in v2? |
|---|---|---|---|
| `name` | `string` | Field name | No |
| `type` | `string` | Scalar or named type | No |
| `required` | `boolean` | Whether the field is non-null | No |
| `list` | `boolean` | Whether the field is a list | No |
| `join` | `{ strategy: string } \| null` | Join strategy from `@wes_join` directive | Yes |
| `views` | `Array<{ rule: string, access: string }> \| null` | View rules from `@wes_view` directive | Yes |

### Join Strategies

When a field carries `@wes_join(strategy: "<name>")`, the `join` field is
`{ strategy: "<name>" }`. Valid strategies:

- `"union"` — set-union lattice (list fields only)
- `"max"` — max-wins lattice (Int/Float fields only)
- `"lww"` — last-writer-wins (any field type)

Fields without `@wes_join` have `join: null`.

## Operation Definition

Each entry in `ops` (unchanged from v1):

| Field | Type | Description |
|---|---|---|
| `kind` | `"MUTATION" \| "QUERY"` | Operation kind |
| `name` | `string` | Operation name |
| `op_id` | `number` | Stable 32-bit hash of `namespace:name` |
| `args` | `Arg[]` | Operation arguments |
| `result_type` | `string` | Return type name |
| `result_required` | `boolean` | Whether the result is non-null (`true` for `Type!`) |
| `result_list` | `boolean` | Whether the result is a list (`true` for `[Type]`) |

## Ordering

- `types[]` is sorted alphabetically by `name` for deterministic output independent of SDL declaration order.
- `ops[]` is sorted alphabetically by `name`.
- Fields within each type are emitted in declaration order (codecs sort fields alphabetically independently).

## Contract Version

The `contract_version` field follows semver. The bump policy:

- **Major** (e.g. `1.0.0` → `2.0.0`) — envelope wire format changes, op ID hashing algorithm changes, codec field ordering changes, or IR schema removes/renames required fields.
- **Minor** (e.g. `1.0.0` → `1.1.0`) — new optional IR fields, new artifact files, new metadata in generated TS.
- **Patch** (e.g. `1.0.0` → `1.0.1`) — bug fixes in codegen with no artifact schema change, comment/whitespace changes, internal refactors with identical output.

## Null-field Convention

All v2 fields that are not yet populated use explicit `null`, never absent keys.
This ensures consumers can distinguish "not yet computed" from "field does not exist".

## Backward Compatibility

- `schema_sha256` is retained alongside the new `schema_hash` for v1 consumers.
- `registry_hash` and `hash_chain` are `null` in the raw `generateEcho()` output;
  `EchoPlugin` fills them with computed values when run through the plugin pipeline.

## Example

```json
{
  "ir_version": "echo-ir/v2",
  "codec_id": "cbor-canon-v1",
  "registry_version": 1,
  "contract_version": "1.0.0",
  "generated_by": {
    "tool": "@wesley/generator-echo",
    "version": "0.1.0"
  },
  "schema_sha256": "59e5d47412e882cce17ab8cf9bffd1909b7081675fe04014de778f4a17866714",
  "schema_hash": "59e5d47412e882cce17ab8cf9bffd1909b7081675fe04014de778f4a17866714",
  "registry_hash": null,
  "hash_chain": null,
  "types": [
    {
      "name": "AppState",
      "kind": "OBJECT",
      "type_id": "AppState",
      "layout_hash": null,
      "has_join": false,
      "fields": [
        { "name": "theme", "type": "Theme", "required": true, "list": false, "join": null, "views": null },
        { "name": "navOpen", "type": "Boolean", "required": true, "list": false, "join": null, "views": null },
        { "name": "routePath", "type": "String", "required": true, "list": false, "join": null, "views": null }
      ]
    },
    {
      "name": "Theme",
      "kind": "ENUM",
      "type_id": "Theme",
      "layout_hash": null,
      "values": ["LIGHT", "DARK", "SYSTEM"]
    }
  ],
  "ops": [
    {
      "kind": "QUERY",
      "name": "appState",
      "op_id": 190543078,
      "args": [],
      "result_type": "AppState",
      "result_required": true,
      "result_list": false
    }
  ]
}
```
