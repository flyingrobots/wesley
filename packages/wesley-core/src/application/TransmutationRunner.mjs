/**
 * TransmutationRunner — Unified orchestration for transmutation pipelines.
 *
 * Merges the responsibilities of GenerationPipeline (evidence + scoring)
 * and PluginRunner (plugin validation + isolation + best-effort) into a
 * single system.
 *
 * Each transmutation is a named compilation unit: sources → generators → evidence.
 * The runner validates plugins, executes them sequentially with error isolation,
 * collects per-element evidence from each generator, and scores the result.
 */

import { validatePlugin, validatePlan } from '../ports/GeneratorPlugin.mjs';
import { EvidenceMap } from './EvidenceMap.mjs';
import { ScoringEngine, BUNDLE_VERSION } from './Scoring.mjs';
import { PluginError } from '../domain/WesleyError.mjs';

/**
 * Deep-freeze an object and all nested objects.
 * @param {T} obj
 * @returns {Readonly<T>}
 * @template T
 */
function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val != null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Generate a simple unique run ID.
 */
function generateRunId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run-${ts}-${rand}`;
}

/**
 * @typedef {Object} TransmutationResult
 * @property {string} transmutation - Transmutation name
 * @property {string} runId
 * @property {boolean} success
 * @property {PluginResult[]} results - Per-plugin results in execution order
 * @property {number} totalArtifacts
 * @property {Object} [scores] - SCS/TCI/MRI scores (if schema supports scoring)
 * @property {Object} [evidence] - Evidence map JSON
 * @property {Object} [bundle] - Full evidence bundle
 */

/**
 * @typedef {Object} PluginResult
 * @property {string} name - Plugin name
 * @property {'ok'|'error'} status
 * @property {Record<string, string|Uint8Array>} [artifacts]
 * @property {Object} [evidence] - Per-element evidence from this plugin
 * @property {number} artifactCount
 * @property {string} [errorCode]
 * @property {string} [errorMessage]
 * @property {'init'|'plan'|'generate'} [phase]
 * @property {number} durationMs
 */

export class TransmutationRunner {
  /**
   * @param {Object} deps
   * @param {import('../ports/Logger.mjs').LoggerPort} deps.logger
   * @param {{ now(): string }} deps.clock
   * @param {Record<string, unknown>} deps.config
   * @param {boolean} [deps.bestEffort=false]
   */
  constructor({ logger, clock, config, bestEffort = false }) {
    if (!logger) throw new TypeError('TransmutationRunner requires a logger');
    if (!clock) throw new TypeError('TransmutationRunner requires a clock');
    if (config == null) throw new TypeError('TransmutationRunner requires a config object');
    this._logger = logger;
    this._clock = clock;
    this._config = config;
    this._bestEffort = bestEffort;
  }

  /**
   * Run a named transmutation: execute all plugins, collect evidence, compute scores.
   *
   * @param {string} name - Transmutation name (e.g. 'backend', 'echo')
   * @param {object[]} plugins - Array of GeneratorPlugin-conforming objects
   * @param {object} schema - Schema input (e.g. { sdl, ir })
   * @param {object} [options]
   * @param {string} [options.sha] - Git commit SHA for evidence tracking
   * @param {object} [options.diff] - Migration diff for MRI scoring
   * @param {object} [options.testResults] - Test results for TCI scoring
   * @returns {Promise<TransmutationResult>}
   */
  async run(name, plugins, schema, options = {}) {
    if (!Array.isArray(plugins)) {
      throw new TypeError("TransmutationRunner.run: 'plugins' must be an array");
    }
    if (schema == null) {
      throw new TypeError("TransmutationRunner.run: 'schema' is required");
    }

    const runId = generateRunId();
    const evidenceMap = new EvidenceMap();
    evidenceMap.setSha(options.sha || 'uncommitted');

    const results = [];
    let totalArtifacts = 0;

    // Execute plugins sequentially (deterministic contract)
    for (const plugin of plugins) {
      const result = await this._executePlugin(plugin, schema, runId, evidenceMap);
      results.push(result);

      if (result.status === 'ok') {
        totalArtifacts += result.artifactCount;
      } else if (!this._bestEffort) {
        // Fail fast unless best-effort mode
        break;
      }
    }

    const hasOk = results.some(r => r.status === 'ok');
    const hasError = results.some(r => r.status === 'error');
    const success = this._bestEffort ? hasOk || results.length === 0 : !hasError;

    // Compute scores from evidence
    const scores = this._computeScores(schema, evidenceMap, options);

    const bundle = {
      bundleVersion: BUNDLE_VERSION,
      transmutation: name,
      sha: options.sha || 'uncommitted',
      timestamp: this._clock.now(),
      evidence: evidenceMap.toJSON(),
      scores,
      artifacts: results
        .filter(r => r.status === 'ok')
        .reduce((acc, r) => {
          acc[r.name] = Object.keys(r.artifacts || {});
          return acc;
        }, {})
    };

    return {
      transmutation: name,
      runId,
      success,
      results,
      totalArtifacts,
      scores,
      evidence: evidenceMap.toJSON(),
      bundle
    };
  }

  /**
   * Build a task graph descriptor for this transmutation.
   * Returns a plain object describing the DAG — no dependency on @wesley/tasks.
   * Hosts can feed this into TaskGraph + TasksSlapsBridge for concurrent execution.
   *
   * @param {string} name - Transmutation name
   * @param {object[]} plugins - Array of GeneratorPlugin-conforming objects
   * @returns {{ nodes: Array<{ id: string, name: string, dependencies: string[], metadata: object }>, edges: Array<[string, string]> }}
   */
  buildTaskGraph(name, plugins) {
    const nodes = [];
    const edges = [];

    // Root node: parse
    nodes.push({
      id: `${name}:parse`,
      name: `Parse ${name} sources`,
      dependencies: [],
      metadata: { type: 'parse', transmutation: name }
    });

    // One node per plugin, all depend on parse
    for (const plugin of plugins) {
      let pluginName;
      try { pluginName = plugin.name; } catch { pluginName = '<unknown>'; }
      const nodeId = `${name}:gen:${pluginName}`;

      nodes.push({
        id: nodeId,
        name: `Generate ${pluginName}`,
        dependencies: [`${name}:parse`],
        metadata: { type: 'generation', transmutation: name, plugin: pluginName }
      });
      edges.push([`${name}:parse`, nodeId]);
    }

    // Evidence collection node: depends on all generators
    const genNodeIds = nodes.filter(n => n.metadata.type === 'generation').map(n => n.id);
    nodes.push({
      id: `${name}:evidence`,
      name: `Collect ${name} evidence`,
      dependencies: genNodeIds,
      metadata: { type: 'evidence', transmutation: name }
    });
    for (const genId of genNodeIds) {
      edges.push([genId, `${name}:evidence`]);
    }

    return { nodes, edges };
  }

  /**
   * Execute a single plugin through its lifecycle: validate → init → plan → generate.
   * Collects evidence from the plugin's output if provided.
   * @private
   */
  async _executePlugin(plugin, schema, runId, evidenceMap) {
    const startMs = Date.now();

    // Phase: validate
    try {
      validatePlugin(plugin);
    } catch (cause) {
      return this._errorResult(plugin, 'init', cause, startMs);
    }

    const pluginName = plugin.name;
    const childLogger = typeof this._logger.child === 'function'
      ? this._logger.child({ plugin: pluginName })
      : this._logger;

    const frozenConfig = deepFreeze(JSON.parse(JSON.stringify(this._config)));
    const context = Object.freeze({
      logger: childLogger,
      clock: this._clock,
      config: frozenConfig,
      runId
    });

    // Phase: init
    try {
      if (typeof plugin.init === 'function') {
        await plugin.init(context.config);
      }
    } catch (cause) {
      return this._errorResult(plugin, 'init', cause, startMs);
    }

    // Phase: plan
    let plan;
    try {
      plan = await plugin.plan(schema, context);
      validatePlan(plan, pluginName);
    } catch (cause) {
      const code = cause.code === 'WPLY004' ? 'WPLY004' : 'WPLY002';
      const result = this._errorResult(plugin, 'plan', cause, startMs);
      result.errorCode = code;
      return result;
    }

    // Phase: generate
    let generateResult;
    try {
      generateResult = await plugin.generate(plan, context);
    } catch (cause) {
      return this._errorResult(plugin, 'generate', cause, startMs);
    }

    // Support both old-style (Record<string, content>) and new-style ({ files, evidence })
    let artifacts;
    let pluginEvidence = null;

    if (generateResult != null && typeof generateResult === 'object' && !Array.isArray(generateResult)) {
      if ('files' in generateResult && 'evidence' in generateResult) {
        // New transmutation-aware return shape — validate files payload
        if (generateResult.files == null || typeof generateResult.files !== 'object') {
          return this._errorResult(
            plugin, 'generate',
            new PluginError('WPLY003', `Plugin "${pluginName}" generate() returned { files, evidence } but files is ${generateResult.files === null ? 'null' : typeof generateResult.files}`, { plugin: pluginName }),
            startMs
          );
        }
        artifacts = generateResult.files;
        pluginEvidence = generateResult.evidence;
      } else {
        // Legacy GeneratorPlugin return shape: plain Record<string, content>
        artifacts = generateResult;
      }
    } else {
      const typeLabel = generateResult === null ? 'null'
        : Array.isArray(generateResult) ? 'Array'
          : typeof generateResult;
      return this._errorResult(
        plugin, 'generate',
        new PluginError('WPLY003', `Plugin "${pluginName}" generate() must return a Record<string, string|Uint8Array> (got ${typeLabel})`, { plugin: pluginName }),
        startMs
      );
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

    // Merge plugin evidence into the transmutation evidence map
    if (pluginEvidence) {
      for (const [uid, entry] of Object.entries(pluginEvidence)) {
        if (entry.artifacts) {
          for (const [kind, location] of Object.entries(entry.artifacts)) {
            evidenceMap.record(uid, kind, location);
          }
        }
      }
    }

    const artifactCount = Object.keys(artifacts).length;
    return {
      name: pluginName,
      status: 'ok',
      artifacts,
      evidence: pluginEvidence,
      artifactCount,
      durationMs: Date.now() - startMs
    };
  }

  /**
   * Compute SCS/TCI/MRI scores from the evidence map.
   * Falls back gracefully when the schema doesn't support domain queries.
   * @private
   */
  _computeScores(schema, evidenceMap, options = {}) {
    const scoringEngine = new ScoringEngine(evidenceMap);

    try {
      if (schema && typeof schema.getTables === 'function') {
        return scoringEngine.exportScores(
          schema,
          options.diff?.steps || [],
          options.testResults || {}
        );
      }
    } catch (err) {
      this._logger.warn?.('[scoring] Failed to compute scores:', err?.message || err);
    }

    // Minimal fallback
    const mri = scoringEngine.calculateMRIDetails(options.diff?.steps || []);
    const zero = 0;
    const readiness = scoringEngine.calculateReadiness(zero, mri.score, zero);

    return {
      version: BUNDLE_VERSION,
      timestamp: this._clock.now(),
      commit: evidenceMap.sha,
      scores: { scs: zero, mri: mri.score, tci: zero },
      breakdown: { scs: {}, mri: mri.breakdown, tci: {} },
      readiness,
      metadata: {
        tables: 0,
        migrationSteps: (options.diff?.steps || []).length,
        testsRun: (options.testResults && options.testResults.total) || 0
      }
    };
  }

  /**
   * Build an error result entry for a plugin.
   * @private
   */
  _errorResult(plugin, phase, cause, startMs) {
    let name = '<unknown>';
    try {
      if (plugin != null && typeof plugin === 'object' && typeof plugin.name === 'string') {
        name = plugin.name;
      }
    } catch {
      // Getter may throw — keep '<unknown>'
    }
    return {
      name,
      status: 'error',
      artifactCount: 0,
      errorCode: cause.code || 'WPLY002',
      errorMessage: cause.message,
      phase,
      durationMs: Date.now() - startMs
    };
  }
}
