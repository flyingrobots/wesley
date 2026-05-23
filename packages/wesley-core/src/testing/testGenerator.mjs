// wesley-core/src/testing/testGenerator.mjs

import { validatePlugin, validatePlan } from '../ports/GeneratorPlugin.mjs';

/**
 * Null logger — satisfies LoggerPort, discards everything.
 * @type {import('../ports/Logger.mjs').LoggerPort}
 */
const nullLogger = Object.freeze({
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return nullLogger;
  },
  setLevel() {},
  async flush() {}
});

/** Deterministic fake clock for snapshot-friendly output. */
const fakeClock = Object.freeze({
  now() {
    return '2020-01-01T00:00:00.000Z';
  }
});

/**
 * Build a frozen PluginContext with sensible defaults.
 * @param {Record<string, unknown>} config
 * @returns {import('../ports/GeneratorPlugin.mjs').PluginContext}
 */
function buildContext(config) {
  return Object.freeze({
    logger: nullLogger,
    clock: fakeClock,
    config: Object.freeze(structuredClone(config)),
    runId: 'test-run-0'
  });
}

/**
 * Run the full generator lifecycle (init -> plan -> generate) in-memory.
 *
 * @param {import('../ports/GeneratorPlugin.mjs').GeneratorPlugin} plugin
 * @param {string} sdl - Raw SDL string (passed as `{ sdl }` schema object)
 * @param {Record<string, unknown>} [config={}] - Forwarded to plugin.init()
 * @returns {Promise<Record<string, string|Uint8Array>>} Generated artifacts
 */
export async function testGenerator(plugin, sdl, config = {}) {
  validatePlugin(plugin);

  const context = buildContext(config);

  if (typeof plugin.init === 'function') {
    await plugin.init(context.config);
  }

  const schema = { sdl };
  const plan = await plugin.plan(schema, context);
  validatePlan(plan, plugin.name);

  const artifacts = await plugin.generate(plan, context);

  if (artifacts == null || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
    const label =
      artifacts === null ? 'null' : Array.isArray(artifacts) ? 'Array' : typeof artifacts;
    throw new Error(
      `Plugin "${plugin.name}" generate() must return Record<string, string|Uint8Array> (got ${label})`
    );
  }

  return artifacts;
}

/**
 * Run only the plan phase (init -> plan) for focused plan testing.
 *
 * @param {import('../ports/GeneratorPlugin.mjs').GeneratorPlugin} plugin
 * @param {string} sdl
 * @param {Record<string, unknown>} [config={}]
 * @returns {Promise<import('../ports/GeneratorPlugin.mjs').GenerationPlan>}
 */
export async function testGeneratorPlan(plugin, sdl, config = {}) {
  validatePlugin(plugin);

  const context = buildContext(config);

  if (typeof plugin.init === 'function') {
    await plugin.init(context.config);
  }

  const schema = { sdl };
  const plan = await plugin.plan(schema, context);
  validatePlan(plan, plugin.name);

  return plan;
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Fluent assertion chain for a single artifact.
 *
 * @param {Record<string, string|Uint8Array>} artifacts
 * @param {string} path
 * @returns {{ toExist(): void, toContain(str: string): void, toMatchJSON(expected: unknown): void }}
 */
export function expectArtifact(artifacts, path) {
  return {
    /** Assert the path exists in the artifacts map. */
    toExist() {
      if (!(path in artifacts)) {
        throw new Error(
          `Expected artifact "${path}" to exist. Keys: [${Object.keys(artifacts).join(', ')}]`
        );
      }
    },

    /** Assert the artifact content (decoded if Uint8Array) contains the given string. */
    toContain(str) {
      this.toExist();
      const raw = artifacts[path];
      const content = raw instanceof Uint8Array ? new TextDecoder().decode(raw) : raw;
      if (!content.includes(str)) {
        throw new Error(
          `Expected artifact "${path}" to contain "${str}".\nActual (first 200 chars): ${String(content).slice(0, 200)}`
        );
      }
    },

    /** Parse artifact as JSON and deep-equal against expected object. */
    toMatchJSON(expected) {
      this.toExist();
      const raw = artifacts[path];
      const content = raw instanceof Uint8Array ? new TextDecoder().decode(raw) : raw;
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (cause) {
        throw new Error(
          `Expected artifact "${path}" to be valid JSON.\nParse error: ${cause.message}`,
          {
            cause
          }
        );
      }
      const expectedJson = JSON.stringify(expected, null, 2);
      const actualJson = JSON.stringify(parsed, null, 2);
      if (actualJson !== expectedJson) {
        throw new Error(
          `Artifact "${path}" JSON mismatch.\nExpected:\n${expectedJson}\nActual:\n${actualJson}`
        );
      }
    }
  };
}
