/**
 * QirPlugin — GeneratorPlugin wrapper for the QIR ops pipeline.
 *
 * Wraps the existing ops compilation flow (translate → lower → emit) as a
 * first-class transmutation participant. This plugin can participate in the
 * TransmutationRunner pipeline, returning evidence (per-op, per-field
 * citations) alongside file artifacts.
 *
 * The plugin does NOT replace the CLI's compileOpsIfRequested() — it exists
 * alongside it. CLI migration to use QirPlugin is a separate step.
 */

import { GeneratorPlugin } from '../../ports/GeneratorPlugin.mjs';
import { emitView, emitFunction } from './emit.mjs';
import { collectParams } from './ParamCollector.mjs';
import { PostgresDialect } from './dialects/PostgresDialect.mjs';
import { assertSafeOpName, sanitizeOpName } from './validateOpName.mjs';

export class QirPlugin extends GeneratorPlugin {
  /**
   * @param {Object} [options]
   * @param {import('./dialects/SqlDialect.mjs').SqlDialect} [options.dialect]
   * @param {string} [options.schema] - Target SQL schema (default: 'wes_ops')
   * @param {'invoker'|'definer'} [options.security] - Function security mode
   * @param {string[]|null} [options.setSearchPath] - SET search_path entries
   * @param {Function|null} [options.pkResolver] - Custom PK resolver
   */
  constructor(options = {}) {
    super();
    this._dialect = options.dialect || new PostgresDialect();
    this._schema = options.schema || 'wes_ops';
    this._security = options.security || 'invoker';
    this._setSearchPath = options.setSearchPath || null;
    this._pkResolver = options.pkResolver || null;
  }

  get apiVersion() {
    return '1';
  }

  get name() {
    return 'qir';
  }

  /**
   * Plan phase: enumerate operations to compile.
   *
   * Expects schema.ops to be an array of { name, plan } objects, where each
   * plan is a QIR QueryPlan. The caller is responsible for parsing .op.json
   * or .graphql files into plans before passing them here.
   *
   * @param {Object} schema
   * @param {Array<{name: string, plan: import('./Nodes.mjs').QueryPlan}>} schema.ops
   * @param {import('../../ports/GeneratorPlugin.mjs').PluginContext} _context
   * @returns {Promise<import('../../ports/GeneratorPlugin.mjs').GenerationPlan>}
   */
  async plan(schema, _context) {
    const ops = schema?.ops;
    if (!Array.isArray(ops) || ops.length === 0) {
      return { artifacts: [], metadata: { ops: [] } };
    }

    const artifacts = [];
    const opsMeta = [];
    const seenNames = new Set();

    for (const op of ops) {
      assertSafeOpName(op.name);
      const name = sanitizeOpName(op.name);

      if (seenNames.has(name)) {
        throw new Error(`QirPlugin: duplicate op name "${name}"`);
      }
      seenNames.add(name);

      const paramEnv = collectParams(op.plan);
      const isParamless = paramEnv.ordered.length === 0;

      artifacts.push({ path: `ops/${name}.fn.sql`, reason: `SQL function for op "${name}"` });

      if (isParamless) {
        artifacts.push({ path: `ops/${name}.view.sql`, reason: `SQL view for parameterless op "${name}"` });
      }

      opsMeta.push({ name, plan: op.plan, isParamless });
    }

    return { artifacts, metadata: { ops: opsMeta } };
  }

  /**
   * Generate phase: compile each op into SQL artifacts.
   *
   * @param {import('../../ports/GeneratorPlugin.mjs').GenerationPlan} plan
   * @param {import('../../ports/GeneratorPlugin.mjs').PluginContext} _context
   * @returns {Promise<{files: Record<string, string>, evidence: Record<string, object>}>}
   */
  async generate(plan, _context) {
    const ops = plan.metadata?.ops || [];
    const files = {};
    const evidence = {};

    const emitOpts = {
      schema: this._schema,
      identPolicy: 'strict',
      pkResolver: this._pkResolver,
      security: this._security,
      setSearchPath: this._setSearchPath,
      dialect: this._dialect
    };

    for (const op of ops) {
      const fnSql = emitFunction(op.name, op.plan, emitOpts);
      const fnPath = `ops/${op.name}.fn.sql`;
      files[fnPath] = `${fnSql}\n`;

      const evidenceEntry = {
        artifacts: {
          sql: { file: fnPath, lines: '1-*' }
        }
      };

      if (op.isParamless) {
        const viewSql = emitView(op.name, op.plan, emitOpts);
        const viewPath = `ops/${op.name}.view.sql`;
        files[viewPath] = `${viewSql}\n`;
        evidenceEntry.artifacts.view = { file: viewPath, lines: '1-*' };
      }

      evidence[`op:${op.name}`] = evidenceEntry;
    }

    return { files, evidence };
  }
}
