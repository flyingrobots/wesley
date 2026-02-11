// wesley-core/src/application/PluginRunner.mjs

import { validatePlugin, validatePlan } from '../ports/GeneratorPlugin.mjs';

/**
 * @typedef {Object} PluginResult
 * @property {string} name - Plugin name
 * @property {'ok'|'error'} status
 * @property {Record<string, string|Uint8Array>} [artifacts]
 * @property {number} artifactCount
 * @property {string} [errorCode]
 * @property {string} [errorMessage]
 * @property {'init'|'plan'|'generate'} [phase]
 * @property {number} durationMs
 */

/**
 * @typedef {Object} RunResult
 * @property {PluginResult[]} results - Per-plugin results in input order
 * @property {boolean} success
 * @property {number} totalArtifacts
 * @property {string} runId
 */

/**
 * PluginRunner - Orchestrates plugin execution with error isolation.
 *
 * Plugins run sequentially in input order (deterministic contract).
 * Each plugin goes through: validate → init → plan → generate.
 * Context is frozen to prevent mutation side-effects.
 */
export class PluginRunner {
  /**
   * @param {Object} deps
   * @param {import('../ports/Logger.mjs').LoggerPort} deps.logger
   * @param {{ now(): string }} deps.clock
   * @param {Record<string, unknown>} deps.config
   * @param {boolean} [deps.bestEffort=false]
   */
  constructor({ logger, clock, config, bestEffort = false }) {
    this._logger = logger;
    this._clock = clock;
    this._config = config;
    this._bestEffort = bestEffort;
  }

  /**
   * Run all plugins against the given schema.
   * @param {object[]} plugins - Array of GeneratorPlugin-conforming objects
   * @param {object} schema - Schema input (e.g. { sdl: string })
   * @returns {Promise<RunResult>}
   */
  async run(plugins, schema) {
    const runId = _generateRunId();
    const results = [];
    let totalArtifacts = 0;

    for (const plugin of plugins) {
      const startMs = Date.now();

      // Phase: validate
      try {
        validatePlugin(plugin);
      } catch (cause) {
        const result = _errorResult(plugin, 'init', cause, startMs);
        results.push(result);
        if (!this._bestEffort) {
          _throwRunError(cause.message, cause.code || 'WPLY001', plugin, 'init', results, startMs, cause);
        }
        continue;
      }

      const pluginName = plugin.name;
      const childLogger = typeof this._logger.child === 'function'
        ? this._logger.child({ plugin: pluginName })
        : this._logger;

      const context = Object.freeze({
        logger: childLogger,
        clock: this._clock,
        config: Object.freeze({ ...this._config }),
        runId,
      });

      // Phase: init
      try {
        if (typeof plugin.init === 'function') {
          await plugin.init(context.config);
        }
      } catch (cause) {
        const result = _errorResult(plugin, 'init', cause, startMs);
        results.push(result);
        if (!this._bestEffort) {
          _throwRunError(cause.message, 'WPLY002', plugin, 'init', results, startMs, cause);
        }
        continue;
      }

      // Phase: plan
      let plan;
      try {
        plan = await plugin.plan(schema, context);
        validatePlan(plan, pluginName);
      } catch (cause) {
        const code = cause.code === 'WPLY004' ? 'WPLY004' : 'WPLY002';
        const result = _errorResult(plugin, 'plan', cause, startMs);
        result.errorCode = code;
        results.push(result);
        if (!this._bestEffort) {
          _throwRunError(cause.message, code, plugin, 'plan', results, startMs, cause);
        }
        continue;
      }

      // Phase: generate
      let artifacts;
      try {
        artifacts = await plugin.generate(plan, context);
      } catch (cause) {
        const result = _errorResult(plugin, 'generate', cause, startMs);
        results.push(result);
        if (!this._bestEffort) {
          _throwRunError(cause.message, 'WPLY002', plugin, 'generate', results, startMs, cause);
        }
        continue;
      }

      // Validate generate() return type
      if (artifacts == null || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
        const msg = `Plugin "${pluginName}" generate() must return a Record<string, string|Uint8Array> (got ${Array.isArray(artifacts) ? 'Array' : typeof artifacts})`;
        const cause = new Error(msg);
        cause.code = 'WPLY003';
        const result = _errorResult(plugin, 'generate', cause, startMs);
        result.errorCode = 'WPLY003';
        results.push(result);
        if (!this._bestEffort) {
          _throwRunError(msg, 'WPLY003', plugin, 'generate', results, startMs, cause);
        }
        continue;
      }

      // Warn on undeclared artifact paths
      const declaredPaths = new Set(plan.artifacts.map(a => a.path));
      for (const key of Object.keys(artifacts)) {
        if (!declaredPaths.has(key)) {
          childLogger.warn(
            { plugin: pluginName, path: key },
            `Plugin "${pluginName}" generated undeclared artifact path "${key}" not in plan.artifacts`
          );
        }
      }

      const artifactCount = Object.keys(artifacts).length;
      totalArtifacts += artifactCount;
      results.push({
        name: pluginName,
        status: 'ok',
        artifacts,
        artifactCount,
        durationMs: Date.now() - startMs,
      });
    }

    const hasOk = results.some(r => r.status === 'ok');
    const hasError = results.some(r => r.status === 'error');
    const success = this._bestEffort ? hasOk : !hasError;

    return { results, success, totalArtifacts, runId };
  }
}

/**
 * Generate a simple unique run ID.
 * Uses timestamp + random suffix for uniqueness without crypto dependency.
 */
function _generateRunId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run-${ts}-${rand}`;
}

/**
 * Build an error result entry for a plugin.
 */
function _errorResult(plugin, phase, cause, startMs) {
  return {
    name: typeof plugin.name === 'string' ? plugin.name : '<unknown>',
    status: 'error',
    artifactCount: 0,
    errorCode: cause.code || 'WPLY002',
    errorMessage: cause.message,
    phase,
    durationMs: Date.now() - startMs,
  };
}

/**
 * Throw a run error with pluginResults attached for CLI summary.
 */
function _throwRunError(message, code, plugin, phase, pluginResults, startMs, cause) {
  const pluginName = typeof plugin.name === 'string' ? plugin.name : '<unknown>';
  const err = new Error(`Plugin "${pluginName}" failed in ${phase}: ${message}`);
  err.code = code;
  err.plugin = pluginName;
  err.phase = phase;
  err.pluginResults = pluginResults;
  err.durationMs = Date.now() - startMs;
  if (cause) err.cause = cause;
  throw err;
}
