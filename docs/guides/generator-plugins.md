# Legacy Generator Plugins

Wesley's current extension direction is Rust-first core APIs plus external
modules for domain targets. This page documents the legacy Node generator plugin
contract that still exists while the older package surfaces are being retired or
extracted.

For new work, start with [Extending Wesley](./extending.md). Add generic
compiler facts in Rust, and put domain targets in external modules or crates.

---

## Quick Start

The smallest possible generator plugin:

```mjs
// my-plugin.mjs
import { GeneratorPlugin } from '@wesley/core';

export class HelloPlugin extends GeneratorPlugin {
  get apiVersion() { return '1'; }
  get name() { return 'hello'; }

  async plan(schema, context) {
    return {
      artifacts: [
        { path: 'hello.txt', reason: 'Greeting file' },
      ],
      metadata: {
        sdlLength: schema.sdl.length,
        outDir: context.emission.outDir ?? 'out',
      },
    };
  }

  async generate(plan, context) {
    return {
      'hello.txt': `Hello from Wesley! Schema has ${plan.metadata.sdlLength} chars.`,
    };
  }
}

export default HelloPlugin;
```

Expose it from a Wesley module and register that module in `wesley.config.mjs`:

```mjs
// my-wesley-module.mjs
import HelloPlugin from './my-plugin.mjs';

export default {
  name: 'hello-module',
  capabilities: {
    wesley: {
      generators: [
        {
          name: 'hello',
          plugin: new HelloPlugin(),
        },
      ],
    },
  },
};
```

```mjs
// wesley.config.mjs
export default {
  modules: [
    { specifier: './my-wesley-module.mjs' },
  ],
};
```

---

## Data Flow

```
SDL string
  |
  v
parse (core)
  |
  v
schema object  ──────>  plugin.plan(schema, context)
                              |
                              v
                        GenerationPlan { artifacts, metadata }
                              |
                              v
                        plugin.generate(plan, context)
                              |
                              v
                        Record<path, string | Uint8Array>
                              |
                              v
                        ArtifactWriter  ──>  disk
```

Plugins never touch the filesystem. They receive data and return data.

---

## The GeneratorPlugin Interface

Extend `GeneratorPlugin` from `@wesley/core`, or supply a plain object with the same shape (duck-typed).

### `apiVersion` (required, getter)

Must return an exact string from `SUPPORTED_API_VERSIONS`. Currently the only supported version is `"1"`.

```mjs
get apiVersion() { return '1'; }
```

### `name` (required, getter)

A unique, non-empty string identifier for this plugin. Used in logs, error messages, and conflict reports.

```mjs
get name() { return 'my-generator'; }
```

### `init(config)` (optional)

Called once before `plan()` with the per-plugin `config` object from `wesley.config.mjs`. Use it to store configuration. May be sync or async.

```mjs
init(config) {
  this.outputFormat = config.format ?? 'json';
}
```

### `plan(schema, context)` (required, async)

Receives the lowered schema envelope and a `PluginContext`. The schema may expose `sdl`, `ir`, and domain helpers such as `getTables()`, but output routing lives in `context.emission`. Must return a `GenerationPlan`:

```mjs
/**
 * @typedef {Object} GenerationPlan
 * @property {ArtifactEntry[]} artifacts - Declared output artifacts
 * @property {Record<string, unknown>} [metadata] - Carried to generate()
 */

/**
 * @typedef {Object} ArtifactEntry
 * @property {string} path - Output path for the artifact
 * @property {string} [reason] - Human-readable description
 * @property {boolean} [binary] - Whether the artifact is binary
 */
```

The `metadata` field is your scratchpad -- anything you compute during planning that `generate()` will need. The runner passes the entire plan object to `generate()` untouched.

### `generate(plan, context)` (required, async)

Receives the plan returned by `plan()` and the same `PluginContext`. Must return `Record<string, string | Uint8Array>` where each key is an artifact path and the value is its content.

```mjs
async generate(plan, context) {
  const output = doWork(plan.metadata);
  return {
    'schema.sql': output.sql,
    'types.ts': output.types,
  };
}
```

Every key returned should correspond to a path declared in `plan.artifacts`. Undeclared paths trigger a warning but are still written.

---

## PluginContext

Every call to `plan()` and `generate()` receives a frozen context object:

| Field    | Type                          | Description                                      |
|----------|-------------------------------|--------------------------------------------------|
| `logger` | `LoggerPort`                  | Scoped child logger (has `.info()`, `.warn()`, `.error()`, `.debug()`) |
| `clock`  | `{ now(): string }`           | Clock port returning ISO-8601 timestamps         |
| `config` | `Readonly<Record<string, unknown>>` | Deep-frozen copy of the run config          |
| `runId`  | `string`                      | Unique identifier for this run (e.g. `run-m3x7k-a1b2c3`) |
| `emission` | `Readonly<{ outDir?: string }>` | Explicit runtime emission context such as the target output directory |

The context is immutable. Attempting to modify it will throw in strict mode.

---

## Error Handling

Wesley uses coded errors to give clear diagnostics at every lifecycle phase.

| Code     | Phase      | Meaning                                              |
|----------|------------|------------------------------------------------------|
| `WPLY001` | validate  | Plugin does not conform to the GeneratorPlugin contract (missing `apiVersion`, `name`, `plan`, or `generate`) |
| `WPLY002` | init / plan / generate | Plugin threw an exception during execution  |
| `WPLY003` | generate   | `generate()` returned an invalid type (must be `Record<string, string\|Uint8Array>`) |
| `WPLY004` | plan       | `plan()` returned an invalid plan (missing or malformed `artifacts` array) |

**What to throw vs. what to return:**

- Throw errors for unrecoverable problems (bad input, missing dependencies). Wesley catches them and reports the phase and error code.
- Return data for normal operation. Never throw to signal "no artifacts to produce" -- return an empty record `{}` with an empty artifacts array instead.

### Best-effort mode

When `PluginRunner` is created with `bestEffort: true`, a failing plugin is skipped and the remaining plugins still run. In default (strict) mode, the first failure aborts the entire run.

---

## Testing Your Plugin

Wesley ships a test harness that runs the full lifecycle (init, plan, generate) in memory with no filesystem, no real clock, and no logger output.

```mjs
// my-plugin.test.mjs
import { describe, it, expect } from 'vitest';
import { testGenerator, testGeneratorPlan, expectArtifact } from '@wesley/core/testing';
import { HelloPlugin } from './my-plugin.mjs';

const sdl = `type User @wes_table { id: ID! @wes_pk }`;

describe('HelloPlugin', () => {
  it('generates hello.txt', async () => {
    const artifacts = await testGenerator(new HelloPlugin(), sdl);
    expectArtifact(artifacts, 'hello.txt').toExist();
    expectArtifact(artifacts, 'hello.txt').toContain('Hello from Wesley');
  });

  it('declares artifacts in plan', async () => {
    const plan = await testGeneratorPlan(new HelloPlugin(), sdl);
    expect(plan.artifacts).toHaveLength(1);
    expect(plan.artifacts[0].path).toBe('hello.txt');
  });

  it('passes config to init', async () => {
    const artifacts = await testGenerator(new HelloPlugin(), sdl, {
      format: 'yaml',
    });
    expectArtifact(artifacts, 'hello.txt').toExist();
  });
});
```

### Harness API

| Function | Signature | Description |
|----------|-----------|-------------|
| `testGenerator` | `(plugin, sdl, config?) => Promise<Record<string, string\|Uint8Array>>` | Runs full lifecycle, returns artifacts |
| `testGeneratorPlan` | `(plugin, sdl, config?) => Promise<GenerationPlan>` | Runs init + plan only, returns the plan |
| `expectArtifact` | `(artifacts, path) => { toExist(), toContain(str), toMatchJSON(obj) }` | Fluent assertions on a single artifact |

The harness uses a deterministic clock (`2020-01-01T00:00:00.000Z`), a null logger, and a fixed `runId` of `test-run-0` for snapshot-friendly output.

---

## Configuration

Register plugins through module capabilities. Do not use the obsolete top-level
`generators` array for new code.

```mjs
// my-wesley-module.mjs
import { MyPlugin } from './my-plugin.mjs';
import { ExperimentalPlugin } from './experimental-plugin.mjs';

export default {
  name: 'my-generators',
  capabilities: {
    wesley: {
      generators: [
        {
          name: 'my-generator',
          plugin: new MyPlugin(),
          config: { format: 'yaml', verbose: true },
        },
        {
          name: 'experimental',
          plugin: new ExperimentalPlugin(),
          enabled: false,
        },
      ],
    },
  },
};
```

```mjs
// wesley.config.mjs
export default {
  modules: [
    { specifier: './my-wesley-module.mjs' },
  ],
};
```

Each generator capability supports:

| Field     | Type      | Required | Description                              |
|-----------|-----------|----------|------------------------------------------|
| `name`    | `string`  | yes      | Unique generator name within the module  |
| `plugin`  | `object`  | yes      | GeneratorPlugin instance or duck-typed object |
| `config`  | `object`  | no       | Passed to `plugin.init(config)`          |
| `enabled` | `boolean` | no       | Set to `false` to skip (default: `true`) |

Module discovery resolves each configured module specifier, reads its
`capabilities.wesley.generators` entries, validates each plugin contract, and
calls `init()` with the entry's `config` if provided.

---

## Real-World Example: VuePlugin

The `VuePlugin` in `packages/wesley-generator-vue/src/VuePlugin.mjs` is a simpler example that wraps the `generateVue()` function:

```mjs
import { VuePlugin } from '@wesley/generator-vue/plugin';

const plugin = new VuePlugin();
plugin.init({ outPath: 'custom/types.ts' }); // optional
```

See the full source at [`packages/wesley-generator-vue/src/VuePlugin.mjs`](../../packages/wesley-generator-vue/src/VuePlugin.mjs).
