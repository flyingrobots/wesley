// wesley-core/src/ports/GeneratorPlugin.mjs

/**
 * Supported API versions. Core rejects unknown versions with a clear message.
 * Frozen array — use .includes() to check membership.
 * @type {ReadonlyArray<string>}
 */
export const SUPPORTED_API_VERSIONS = Object.freeze(['1']);

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
  plan(_schema, _context) {
    throw new Error('GeneratorPlugin.plan() must be implemented');
  }

  /**
   * Generate artifacts from the plan.
   * @param {GenerationPlan} plan - The plan returned by plan()
   * @param {PluginContext} context
   * @returns {Promise<Record<string, string|Uint8Array>>}
   */
  generate(_plan, _context) {
    throw new Error('GeneratorPlugin.generate() must be implemented');
  }
}

/** @internal Throw a coded validation error. */
function fail(msg, code) {
  const err = new Error(msg);
  err.code = code;
  throw err;
}

/**
 * Safely read a property that might be a throwing getter.
 * Returns { ok: true, value } or { ok: false, error }.
 * @internal
 */
function safeGet(obj, prop) {
  try {
    return { ok: true, value: obj[prop] };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/**
 * Duck-typing validator for plugin objects. Throws with code WPLY001
 * if the object doesn't conform to the GeneratorPlugin contract.
 *
 * Uses duck typing (no instanceof) so plain objects work too.
 * Safely handles throwing getters (e.g. raw GeneratorPlugin base class).
 *
 * @param {unknown} plugin
 * @throws {{ message: string, code: string }}
 */
export function validatePlugin(plugin) {
  if (plugin == null || typeof plugin !== 'object') {
    fail('Plugin must be a non-null object', 'WPLY001');
  }

  // Safely read apiVersion and name — these may be throwing getters
  const verResult = safeGet(plugin, 'apiVersion');
  const nameResult = safeGet(plugin, 'name');

  if (!verResult.ok) {
    fail(
      `Plugin apiVersion getter threw: ${verResult.error.message}`,
      'WPLY001'
    );
  }
  if (!nameResult.ok) {
    fail(
      `Plugin name getter threw: ${nameResult.error.message}`,
      'WPLY001'
    );
  }

  const ver = verResult.value;
  const pluginName = typeof nameResult.value === 'string' && nameResult.value.trim()
    ? nameResult.value.trim()
    : undefined;
  const nameLabel = pluginName ? ` "${pluginName}"` : '';

  // apiVersion — must be a string in SUPPORTED_API_VERSIONS
  if (ver === undefined || ver === null) {
    fail(`Plugin${nameLabel} is missing required "apiVersion" property`, 'WPLY001');
  }
  if (typeof ver !== 'string') {
    fail(
      `Plugin${nameLabel} apiVersion must be a string (got ${typeof ver}: ${ver}). ` +
      `Use apiVersion: "${String(ver)}" instead of apiVersion: ${ver}`,
      'WPLY001'
    );
  }
  if (!SUPPORTED_API_VERSIONS.includes(ver)) {
    fail(
      `Plugin${nameLabel} requires apiVersion "${ver}", ` +
      `but only [${[...SUPPORTED_API_VERSIONS].map(v => `"${v}"`).join(', ')}] are supported`,
      'WPLY001'
    );
  }

  // name — must be non-empty string after trim
  if (typeof nameResult.value !== 'string' || nameResult.value.trim().length === 0) {
    fail(
      'Plugin "name" must be a non-empty string (got ' +
      (typeof nameResult.value === 'string' ? 'whitespace-only string' : typeof nameResult.value) + ')',
      'WPLY001'
    );
  }

  // Methods — must be functions
  for (const method of ['plan', 'generate']) {
    if (typeof plugin[method] !== 'function') {
      fail(
        `Plugin${nameLabel} is missing required method "${method}" (got ${typeof plugin[method]})`,
        'WPLY001'
      );
    }
  }

  // init is optional but if present must be a function
  if (plugin.init !== undefined && typeof plugin.init !== 'function') {
    fail(
      `Plugin${nameLabel} "init" must be a function if provided (got ${typeof plugin.init})`,
      'WPLY001'
    );
  }
}

/**
 * @typedef {Object} NormalizedGenerateResult
 * @property {Record<string, string|Uint8Array>} artifacts - File artifacts
 * @property {Record<string, object>|null} evidence - Per-element evidence (null for legacy shape)
 */

/**
 * Validates and normalizes the return value of generate(). Throws with
 * code WPLY003 if the result is not a valid shape.
 *
 * Supports two shapes:
 *   - Legacy: Record<string, string|Uint8Array> (plain file map)
 *   - Transmutation-aware: { files: Record, evidence: Record }
 *
 * Returns a normalized `{ artifacts, evidence }` object regardless of
 * which shape was provided.
 *
 * @param {unknown} result
 * @param {string} [pluginName]
 * @returns {NormalizedGenerateResult}
 * @throws {{ message: string, code: string }}
 */
export function validateGenerateResult(result, pluginName) {
  const label = pluginName ? ` "${pluginName}"` : '';

  // Top-level: must be non-null, non-array object
  if (result == null || typeof result !== 'object' || Array.isArray(result)) {
    const typeLabel = result === null ? 'null'
      : Array.isArray(result) ? 'Array'
        : typeof result;
    fail(
      `Plugin${label} generate() must return a Record<string, string|Uint8Array> (got ${typeLabel})`,
      'WPLY003'
    );
  }

  // New transmutation-aware shape: { files, evidence }
  if ('files' in result && 'evidence' in result) {
    if (result.files == null || typeof result.files !== 'object' || Array.isArray(result.files)) {
      const filesLabel = result.files === null ? 'null'
        : Array.isArray(result.files) ? 'Array'
          : typeof result.files;
      fail(
        `Plugin${label} generate() returned { files, evidence } but files is ${filesLabel} (expected Record<string, string|Uint8Array>)`,
        'WPLY003'
      );
    }
    if (result.evidence == null || typeof result.evidence !== 'object' || Array.isArray(result.evidence)) {
      const evLabel = result.evidence === null ? 'null'
        : Array.isArray(result.evidence) ? 'Array'
          : typeof result.evidence;
      fail(
        `Plugin${label} generate() returned { files, evidence } but evidence is ${evLabel} (expected Record<string, object>)`,
        'WPLY003'
      );
    }
    return { artifacts: result.files, evidence: result.evidence };
  }

  // Legacy shape: plain Record<string, content>
  return { artifacts: result, evidence: null };
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
    fail(`Plan${label} must be a non-null object (got ${plan === null ? 'null' : typeof plan})`, 'WPLY004');
  }

  if (!Array.isArray(plan.artifacts)) {
    fail(`Plan${label} must have an "artifacts" array (got ${typeof plan.artifacts})`, 'WPLY004');
  }

  for (let i = 0; i < plan.artifacts.length; i++) {
    const entry = plan.artifacts[i];
    if (entry == null || typeof entry !== 'object') {
      fail(`Plan${label} artifacts[${i}] must be a non-null object`, 'WPLY004');
    }
    if (typeof entry.path !== 'string' || entry.path.trim().length === 0) {
      fail(`Plan${label} artifacts[${i}] must have a non-empty "path" string`, 'WPLY004');
    }
  }
}
