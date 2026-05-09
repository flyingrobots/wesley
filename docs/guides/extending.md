# Extending Wesley

This guide explains how to extend Wesley safely by adding new generators and adapters without breaking the core's purity or public APIs.

- Core stays pure (no node:*). Add pure utilities under `packages/wesley-core/src/util/` when needed.
- Add adapters (filesystem, shell, network) in `@wesley/host-node` and inject via the CLI.
- For new outputs (e.g., additional SQL dialects), create a generator plugin and cover with snapshot tests.

See also: docs/README.md → Implementation and CI boundaries.

---

## Generator Plugins (E0.1+)

Wesley provides a stable `GeneratorPlugin` contract for code generation. All generators conform to one lifecycle: **init → plan → generate** (pure data return, no I/O).

### The GeneratorPlugin Contract

```js
import { GeneratorPlugin } from '@wesley/core';

class MyPlugin extends GeneratorPlugin {
  get apiVersion() { return '1'; }       // Must match a supported version
  get name()       { return 'my-gen'; }  // Unique, non-empty identifier

  init(config) {
    // Optional setup from wesley.config.mjs (no-op by default)
  }

  async plan(schema, context) {
    // Declare what artifacts you will produce
    return {
      artifacts: [
        { path: 'output.ts', reason: 'Generated types' },
      ],
    };
  }

  async generate(plan, context) {
    // Return artifacts as Record<string, string|Uint8Array>
    // NO filesystem I/O — the runner handles writing
    return {
      'output.ts': `// Generated from ${plan.metadata?.name ?? 'schema'}\n`,
    };
  }
}
```

### Key Rules

1. **Pure generate()** — Return `Record<string, string|Uint8Array>`. The runner's caller writes files.
2. **Plan is enforced** — `plan()` must return an `artifacts` array with `path` strings. Undeclared artifact paths in generate output trigger a warning.
3. **Duck typing** — You can use a plain object instead of extending the class. `validatePlugin()` checks shape, not `instanceof`.
4. **Frozen context** — The `PluginContext` passed to `plan()` and `generate()` is `Object.freeze()`'d. It contains `{ logger, clock, config, runId, emission }`, and `emission.outDir` is the explicit place to read output routing.
5. **apiVersion** — Must be an exact string from `SUPPORTED_API_VERSIONS` (currently `"1"`). Numbers and semver strings are rejected with actionable error messages.

### Running Plugins

```js
import { PluginRunner } from '@wesley/core';

const runner = new PluginRunner({ logger, clock, config, bestEffort: false });
const { results, success, totalArtifacts, runId } = await runner.run([plugin], schema);
```

- Plugins run sequentially in input order (deterministic).
- Default mode throws after first failure, attaching `pluginResults` to the error.
- `bestEffort: true` continues through all plugins; success = at least one `'ok'`.

### Error Codes

| Code | When |
|---|---|
| `WPLY001` | Plugin doesn't conform to contract (shape/version/name/methods) |
| `WPLY002` | Plugin threw during init(), plan(), or generate() |
| `WPLY003` | generate() returned wrong type (not Record/object) |
| `WPLY004` | plan() returned invalid shape (missing/malformed artifacts) |

### Example: VuePlugin

See `packages/wesley-generator-vue/src/VuePlugin.mjs` for a real-world adapter
that wraps the existing `generateVue()` function in the plugin contract.
