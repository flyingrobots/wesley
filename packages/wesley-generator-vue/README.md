<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# @wesley/generator-vue

Wesley generator for Vue-facing artifacts.

Today this package focuses on the smallest reliable slice: **emit TypeScript types from Wesley IR** (enums + interfaces). The long-term goal is to also emit Vue composables and dispatch wrappers.

## Unified Entrypoint

The canonical way to use this generator is via the `VuePlugin` class, which implements the `GeneratorPlugin` contract:

```js
import { VuePlugin } from '@wesley/generator-vue/plugin';

const plugin = new VuePlugin();
plugin.init({ outPath: 'types.generated.ts' }); // optional config

const plan = await plugin.plan({ ir }, context);
const artifacts = await plugin.generate(plan, context);
// artifacts['types.generated.ts'] → generated TypeScript content
```

This integrates with the `PluginRunner` and CLI discovery infrastructure.

### Legacy function API

The direct `generateVue()` function remains available for backward compatibility but is not the primary invocation path:

```js
import { generateVue } from '@wesley/generator-vue';

const result = await generateVue(ir, { outPath: 'types.generated.ts' });
```

## Input

Both `VuePlugin` and `generateVue()` expect a Wesley IR object with:

- `types: Array<{ name: string, kind: "ENUM"|"OBJECT", ... }>`

The generator is intentionally strict: it will throw if `ir` is missing or `ir.types` is not an array.

## Output

**`VuePlugin.generate()`** returns an artifacts map:

```js
{
  "types.generated.ts": "// AUTO-GENERATED...\nexport enum Theme { ... }"
}
```

**`generateVue()`** (legacy) returns the original file-array shape:

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
