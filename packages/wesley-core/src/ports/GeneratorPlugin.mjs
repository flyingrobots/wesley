// wesley-core/src/ports/GeneratorPlugin.mjs

/**
 * Supported API versions. Core rejects unknown versions with a clear message.
 * @type {Set<string>}
 */
export const SUPPORTED_API_VERSIONS = new Set(['1']);

/**
 * @typedef {Object} ArtifactEntry
 * @property {string} path - Output path for the artifact
 * @property {string} [reason] - Human-readable reason for this artifact
 * @property {boolean} [binary] - Whether the artifact is binary (Uint8Array)
 */

/**
 * @typedef {Object} GenerationPlan
 * @property {ArtifactEntry[]} artifacts - Declared output artifacts
 * @property {Record<string, unknown>} [metadata] - Arbitrary metadata carried to generate()
 */

/**
 * @typedef {Object} PluginContext
 * @property {import('./Logger.mjs').LoggerPort} logger - Scoped child logger
 * @property {{ now(): string }} clock - Clock port
 * @property {Readonly<Record<string, unknown>>} config - Frozen per-run config
 * @property {string} runId - Unique run identifier
 */

/**
 * GeneratorPlugin - Abstract port for code generation plugins.
 *
 * Lifecycle: init → plan → generate (pure data return, no I/O).
 * Plugins return artifacts as Record<string, string|Uint8Array>.
 * The runner's caller handles writing via existing writer.writeFiles().
 */
export class GeneratorPlugin {
  /**
   * API version this plugin conforms to.
   * Must return an exact string from SUPPORTED_API_VERSIONS.
   * @returns {string}
   */
  get apiVersion() {
    throw new Error('GeneratorPlugin.apiVersion must be implemented');
  }

  /**
   * Unique plugin name (non-whitespace string).
   * @returns {string}
   */
  get name() {
    throw new Error('GeneratorPlugin.name must be implemented');
  }

  /**
   * Optional initialization hook. No-op by default.
   * @param {Record<string, unknown>} _config
   * @returns {void|Promise<void>}
   */
  init(_config) {
    // No-op default — plugins override if needed
  }

  /**
   * Produce a generation plan from the schema.
   * @param {object} schema - Schema input (e.g. { sdl: string })
   * @param {PluginContext} context
   * @returns {Promise<GenerationPlan>}
   */
  plan(schema, context) {
    throw new Error('GeneratorPlugin.plan() must be implemented');
  }

  /**
   * Generate artifacts from the plan.
   * @param {GenerationPlan} plan - The plan returned by plan()
   * @param {PluginContext} context
   * @returns {Promise<Record<string, string|Uint8Array>>}
   */
  generate(plan, context) {
    throw new Error('GeneratorPlugin.generate() must be implemented');
  }
}

/**
 * Duck-typing validator for plugin objects. Throws with code WPLY001
 * if the object doesn't conform to the GeneratorPlugin contract.
 *
 * Uses duck typing (no instanceof) so plain objects work too.
 *
 * @param {unknown} plugin
 * @throws {{ message: string, code: string }}
 */
export function validatePlugin(plugin) {
  if (plugin == null || typeof plugin !== 'object') {
    const err = new Error('Plugin must be a non-null object');
    err.code = 'WPLY001';
    throw err;
  }

  // apiVersion — must be a string in SUPPORTED_API_VERSIONS
  const ver = plugin.apiVersion;
  const pluginName = typeof plugin.name === 'string' && plugin.name.trim()
    ? plugin.name.trim()
    : undefined;
  const nameLabel = pluginName ? ` "${pluginName}"` : '';

  if (ver === undefined || ver === null) {
    const err = new Error(`Plugin${nameLabel} is missing required "apiVersion" property`);
    err.code = 'WPLY001';
    throw err;
  }
  if (typeof ver !== 'string') {
    const err = new Error(
      `Plugin${nameLabel} apiVersion must be a string (got ${typeof ver}: ${ver}). ` +
      `Use apiVersion: "${String(ver)}" instead of apiVersion: ${ver}`
    );
    err.code = 'WPLY001';
    throw err;
  }
  if (!SUPPORTED_API_VERSIONS.has(ver)) {
    const err = new Error(
      `Plugin${nameLabel} requires apiVersion "${ver}", ` +
      `but only [${[...SUPPORTED_API_VERSIONS].map(v => `"${v}"`).join(', ')}] are supported`
    );
    err.code = 'WPLY001';
    throw err;
  }

  // name — must be non-empty string after trim
  if (typeof plugin.name !== 'string' || plugin.name.trim().length === 0) {
    const err = new Error(
      'Plugin "name" must be a non-empty string (got ' +
      (typeof plugin.name === 'string' ? 'whitespace-only string' : typeof plugin.name) + ')'
    );
    err.code = 'WPLY001';
    throw err;
  }

  // Methods — must be functions
  for (const method of ['plan', 'generate']) {
    if (typeof plugin[method] !== 'function') {
      const err = new Error(
        `Plugin${nameLabel} is missing required method "${method}" (got ${typeof plugin[method]})`
      );
      err.code = 'WPLY001';
      throw err;
    }
  }

  // init is optional but if present must be a function
  if (plugin.init !== undefined && typeof plugin.init !== 'function') {
    const err = new Error(
      `Plugin${nameLabel} "init" must be a function if provided (got ${typeof plugin.init})`
    );
    err.code = 'WPLY001';
    throw err;
  }
}

/**
 * Validates the return value of plan(). Throws with code WPLY004 if the
 * plan doesn't contain a valid artifacts array.
 *
 * @param {unknown} plan
 * @param {string} [pluginName]
 * @throws {{ message: string, code: string }}
 */
export function validatePlan(plan, pluginName) {
  const label = pluginName ? ` from plugin "${pluginName}"` : '';

  if (plan == null || typeof plan !== 'object') {
    const err = new Error(`Plan${label} must be a non-null object (got ${plan === null ? 'null' : typeof plan})`);
    err.code = 'WPLY004';
    throw err;
  }

  if (!Array.isArray(plan.artifacts)) {
    const err = new Error(`Plan${label} must have an "artifacts" array (got ${typeof plan.artifacts})`);
    err.code = 'WPLY004';
    throw err;
  }

  for (let i = 0; i < plan.artifacts.length; i++) {
    const entry = plan.artifacts[i];
    if (entry == null || typeof entry !== 'object') {
      const err = new Error(`Plan${label} artifacts[${i}] must be a non-null object`);
      err.code = 'WPLY004';
      throw err;
    }
    if (typeof entry.path !== 'string' || entry.path.trim().length === 0) {
      const err = new Error(`Plan${label} artifacts[${i}] must have a non-empty "path" string`);
      err.code = 'WPLY004';
      throw err;
    }
  }
}
