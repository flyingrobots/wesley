<!-- SPDX-License-Identifier: LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# @wesley/generator-vue

Wesley generator for Vue-facing artifacts.

Today this package focuses on the smallest reliable slice: **emit TypeScript types from Wesley IR** (enums + interfaces). The long-term goal is to also emit Vue composables and dispatch wrappers.

## Input

`generateVue(ir)` expects a Wesley IR object with:

- `types: Array<{ name: string, kind: "ENUM"|"OBJECT", ... }>`

This generator is intentionally strict: it will throw if `ir` is missing or `ir.types` is not an array.

## Output

Returns:

```js
{
  files: [
    { path: "types.generated.ts", content: "..." }
  ]
}
```

### Type mapping

- `Boolean` → `boolean`
- `String` / `ID` → `string`
- `Int` / `Float` → `number`
- Known custom types (enums/objects in `ir.types`) → emitted by name
- Unknown types → `any` (prevents generation from breaking on incomplete IR)

## Dev

Run tests:

```bash
pnpm --filter @wesley/generator-vue test
```

