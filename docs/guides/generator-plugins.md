# Generator Plugins

Wesley uses a plugin system to turn parsed GraphQL schemas into output artifacts (SQL, TypeScript, Zod schemas, IR files, etc.). Each generator plugin receives a schema, declares what it will produce, then generates the artifacts as pure data. Wesley handles all file I/O.

This guide will get you writing your own generator plugin in under 30 minutes.

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
    };
  }

  async generate(plan, context) {
    return {
      'hello.txt': `Hello from Wesley! Schema has ${schema.sdl.length} chars.`,
    };
  }
}

export default HelloPlugin;
```

Register it in `wesley.config.mjs` and you are done:

```mjs
export default {
  generators: [
    { package: './my-plugin.mjs' },
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

Receives the schema object (currently `{ sdl: string }`) and a `PluginContext`. Must return a `GenerationPlan`:

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

Register plugins in `wesley.config.mjs` under the `generators` array:

```mjs
// wesley.config.mjs
export default {
  generators: [
    // Minimal: just a package specifier
    { package: '@wesley/generator-echo' },

    // With per-plugin config passed to init()
    {
      package: './my-plugin.mjs',
      config: { format: 'yaml', verbose: true },
    },

    // Disabled (skipped during discovery)
    {
      package: '@wesley/generator-experimental',
      enabled: false,
    },
  ],
};
```

Each entry in the `generators` array supports:

| Field     | Type      | Required | Description                              |
|-----------|-----------|----------|------------------------------------------|
| `package` | `string`  | yes      | npm package name or relative file path   |
| `config`  | `object`  | no       | Passed to `plugin.init(config)`          |
| `enabled` | `boolean` | no       | Set to `false` to skip (default: `true`) |

Plugin discovery resolves each package, looks for a `default`, `plugin`, or `Plugin` export, instantiates it if it is a class, validates the contract, and calls `init()` with the entry's `config` if provided.

---

## Real-World Example: EchoPlugin

The `EchoPlugin` in `packages/wesley-generator-echo/src/EchoPlugin.mjs` is a production generator that compiles GraphQL SDL into Echo IR and TypeScript client code. Key patterns to learn from:

- **Private fields** for configuration state (`#mutationIdNamespace`, `#queryNamespace`)
- **`init()`** to accept config overrides
- **`plan()`** declares four artifacts and stores SDL + config in `metadata`
- **`generate()`** delegates to the existing `generateEcho()` function and reshapes the output into `Record<string, string>`
- **Adapter pattern**: wraps a legacy `{ files: [{path, content}] }` API into the plugin contract without breaking backward compatibility

```mjs
import { GeneratorPlugin } from '@wesley/core';

export class EchoPlugin extends GeneratorPlugin {
  get apiVersion() { return '1'; }
  get name() { return 'echo'; }

  async plan(schema, context) {
    return {
      artifacts: [
        { path: 'ir.json', reason: 'Echo IR (echo-ir/v1)' },
        { path: 'ops.generated.ts', reason: 'Operation IDs and metadata' },
        // ...
      ],
      metadata: { sdl: schema.sdl },
    };
  }

  async generate(plan, context) {
    // Delegate to existing function, reshape output
    const result = await generateEcho(plan.metadata);
    const artifacts = Object.create(null);
    for (const file of result.files) {
      artifacts[file.path] = file.content;
    }
    return artifacts;
  }
}
```

See the full source at [`packages/wesley-generator-echo/src/EchoPlugin.mjs`](../../packages/wesley-generator-echo/src/EchoPlugin.mjs).
