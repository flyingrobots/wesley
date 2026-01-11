<!-- SPDX-License-Identifier: LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# @wesley/generator-echo

Wesley generator for **Echo/WARP** artifacts.

This package turns GraphQL SDL into a small, deterministic “Echo IR” (`echo-ir/v1`) suitable for:

- Rust-side generation via `echo-wesley-gen` (in the Echo repo)
- Host-side TypeScript constants (op IDs, registry metadata)

## Input

`generateEcho({ sdl })` requires a **GraphQL SDL string**.

Notes:
- `ir` can be provided, but `sdl` is still required because the op catalog is derived from SDL.
- The generator throws if `sdl` is missing/empty.

## Output

Returns:

```js
{
  files: [
    { path: "ir.json", content: "{ ... }" },
    { path: "ops.generated.ts", content: "..." },
    { path: "schemas.generated.ts", content: "..." },
    { path: "client.generated.ts", content: "..." }
  ]
}
```

### Op ID derivation (frozen rule)

Each operation gets a persisted numeric ID:

- `op_id = sha256("${namespace}:${opName}").readUInt32LE(0)`

Namespaces default to:
- `Mutation` for mutations
- `Query` for queries

The `ops[]` list is sorted by `(op_id, name)` to guarantee stable output even if SDL field order changes.

## Dev

Run tests:

```bash
pnpm --filter @wesley/generator-echo test
```

