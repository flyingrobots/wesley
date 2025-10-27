/**
 * Generate Command - Full Pipeline
 * Uses Commander for parsing + DI for execution
 * Auto-registers on import
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { buildOutputPathMap, materializeArtifacts, resolveFilePath } from '../utils/output-paths.mjs';
import { relative } from 'node:path';
import { buildPlanFromJson, emitFunction, emitView, collectParams } from '@wesley/core/domain/qir';

export class GeneratePipelineCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'generate', 'Generate SQL, tests, and more from GraphQL schema');
    this.requiresSchema = true;
  }
  
  // Configure Commander options
  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--ops <dir>', 'Experimental: directory containing *.op.json files to compile (omit to disable)')
      .option('--ops-schema <name>', 'Schema name for emitted ops SQL (default wes_ops)', 'wes_ops')
      .option('--ops-security <mode>', 'Security for emitted functions: invoker|definer', 'invoker')
      .option('--ops-search-path <list>', 'Comma-separated search_path for ops functions (e.g., "pg_catalog, wes_ops")')
      .option('--ops-explain <mode>', 'Emit EXPLAIN JSON snapshots for ops: mock', '')
      .option('--ops-allow-errors', 'Continue compiling remaining ops even if some fail validation (not allowed in CI without override)')
      .option('--emit-bundle', 'Emit .wesley/ evidence bundle')
      .option('--supabase', 'Enable Supabase features (RLS tests)')
      .option('--out-dir <dir>', 'Output directory', 'out')
      .option('--allow-dirty', 'Allow running with a dirty git working tree (not recommended)')
      .option('--i-know-what-im-doing', 'Acknowledge hazardous flags in CI environments')
      .option('-v, --verbose', 'More logs (level=debug)')
      .option('--debug', 'Debug output with stack traces')
      .option('-q, --quiet', 'Silence logs (level=silent)')
      .option('--json', 'Emit newline-delimited JSON logs')
      .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
      .option('--show-plan', 'Display execution plan before running');
  }

  async executeCore(context) {
    const { schemaContent, schemaPath, options, logger } = context;
    const configPaths = this.ctx?.config?.paths || {};
    const outDir = options.outDir || configPaths.output || 'out';
    options.outDir = outDir;
    const outputPaths = buildOutputPathMap(configPaths, outDir);
    context.outputPaths = outputPaths;

    const isCI = String(this.ctx?.env?.CI || '').toLowerCase() === 'true' || this.ctx?.env?.CI === '1';
    const canAllowErrors = !isCI || options.iKnowWhatImDoing;
    if (options.opsAllowErrors && !canAllowErrors) {
      throw new OpsError('OPS_ALLOW_ERRORS_FORBIDDEN', '--ops-allow-errors is disabled when CI=true; remove the flag or rerun with --i-know-what-im-doing.');
    }
    if (options.opsAllowErrors && isCI && options.iKnowWhatImDoing) {
      logger.warn({ opsAllowErrors: true }, '--ops-allow-errors acknowledged in CI due to override flag');
    }
    options.opsAllowErrors = Boolean(options.opsAllowErrors);

    // Handle --stdin convenience flag
    if (options.stdin) {
      options.schema = '-';
    }
    
    // Safety: require clean git working tree unless explicitly allowed
    const env = this.ctx.env || {};
    if (shouldEnforceClean(env, options) && !options.allowDirty) {
      try { await assertCleanGit(); } catch (e) { e.code = e.code || 'DIRTY_WORKTREE'; throw e; }
    }

    logger.info({ schema: schemaPath }, 'Parsing schema...');

    // Use injected generators and writer
    const { generators, writer, planner, runner } = this.ctx;
    
    // Check if we have what we need
    if (!generators || !generators.sql) {
      const err = new Error('SQL generator not available');
      err.code = 'GENERATION_FAILED';
      throw err;
    }

    // If T.A.S.K.S. and S.L.A.P.S. are available, use them
    if (planner && runner && planner.buildPlan && runner.run) {
      return await this.executeWithTasksAndSlaps(context);
    }

    // Otherwise, simple sequential execution
    const artifacts = [];
    
    // Parse schema to IR
    const ir = this.ctx.parsers.graphql.parse(schemaContent);
    
    // Generate DDL
    const ddlResult = generators.sql.emitDDL(ir);
    artifacts.push(...materializeArtifacts(ddlResult?.files || [], 'ddl', outputPaths));
    
    // Generate RLS if Supabase flag
    if (options.supabase && generators.sql.emitRLS) {
      const rlsResult = generators.sql.emitRLS(ir);
      artifacts.push(...materializeArtifacts(rlsResult?.files || [], 'rls', outputPaths));
    }
    
    // Generate tests
    if (generators.tests && generators.tests.emitPgTap) {
      const testResult = generators.tests.emitPgTap(ir);
      artifacts.push(...materializeArtifacts(testResult?.files || [], 'pgtap', outputPaths));
    }
    
    // Write files
    if (writer && writer.writeFiles) {
      await writer.writeFiles(artifacts);
    }
    
    // Persist snapshot of IR for future diffs
    try {
      if (this.ctx.fs && ir && ir.tables) {
        const snapshotPath = resolveFilePath(outputPaths.bundleDir, 'snapshot.json');
        await this.ctx.fs.write(snapshotPath, JSON.stringify({ irVersion: '1.0.0', tables: ir.tables }, null, 2));
      }
    } catch (e) {
      logger.warn('Could not write IR snapshot: ' + (e?.message || e));
    }
    
    // Optionally emit a minimal evidence bundle for HOLMES sidecar
    if (options.emitBundle) {
      try {
        // Resolve current commit SHA (fallback to env or unknown)
        let sha = process.env.GITHUB_SHA || 'unknown';
        try {
          const out = await (globalThis?.wesleyCtx?.shell?.exec?.('git rev-parse HEAD'));
          const s = out?.stdout?.trim();
          if (s) sha = s;
        } catch {}

        const timestamp = new Date().toISOString();
        // Minimal scoring heuristic (placeholder until full evidence pipeline)
        const scs = Math.min(1, Math.max(0, (artifacts.length > 0 ? 0.6 : 0.3)));
        const tci = artifacts.some(a => a.name?.includes('tests')) ? 0.7 : 0.4;
        const mri = 0.2;
        const readiness = { verdict: (scs > 0.75 && tci > 0.6 ? 'ELEMENTARY' : (scs > 0.4 ? 'REQUIRES INVESTIGATION' : 'YOU SHALL NOT PASS')) };

        const toScore = (value) => Number(value.toFixed(3));
        const makeCoverageEntry = (value, { totalWeight = 1, coveredWeight = value } = {}) => ({
          score: toScore(value),
          totalWeight,
          coveredWeight: toScore(coveredWeight)
        });
        const makeCountEntry = (value, { total = 1, covered = value, components = {} } = {}) => ({
          score: toScore(value),
          total,
          covered: toScore(covered),
          components
        });
        const makeRiskEntry = (value, { points = Math.round(value * 100), contribution = 1 } = {}) => ({
          score: toScore(value),
          points,
          contribution: toScore(contribution)
        });
        const scores = {
          version: '2.0.0',
          timestamp,
          commit: sha,
          thresholds: { scs: 0.8, tci: 0.7, mri: 0.4 },
          scores: {
            scs: Number(scs.toFixed(3)),
            tci: Number(tci.toFixed(3)),
            mri: Number(mri.toFixed(3)),
            breakdown: {
              scs: {
                sql: makeCoverageEntry(scs),
                types: makeCoverageEntry(scs),
                validation: makeCoverageEntry(scs),
                tests: makeCoverageEntry(tci)
              },
              tci: {
                unitConstraints: makeCountEntry(tci),
                rls: makeCountEntry(tci),
                integrationRelations: makeCountEntry(tci),
                e2eOps: makeCountEntry(tci)
              },
              mri: {
                drops: makeRiskEntry(mri),
                renames: makeRiskEntry(0, { points: 0, contribution: 0 }),
                defaults: makeRiskEntry(0, { points: 0, contribution: 0 }),
                typeChanges: makeRiskEntry(0, { points: 0, contribution: 0 }),
                indexes: makeRiskEntry(0, { points: 0, contribution: 0 }),
                other: makeRiskEntry(0, { points: 0, contribution: 0 })
              }
            }
          },
          readiness,
          metadata: { artifacts: artifacts.length }
        };

        // Evidence map: cite generated SQL and tests
        const schemaArtifact = artifacts.find((a) => a.category === 'ddl' && a.name === 'schema.sql');
        const testsArtifact = artifacts.find((a) => a.category === 'pgtap' && a.name === 'tests.sql');
        const sqlFile = schemaArtifact?.path || resolveFilePath(outputPaths.ddl, 'schema.sql');
        const testFile = testsArtifact?.path || resolveFilePath(outputPaths.pgtap, 'tests.sql');
        const evidence = {
          // Use coarse UID until we have fine-grained per-field evidence
          evidence: {
            schema: {
              sql: [{ file: sqlFile, lines: '1-9999', sha }],
              tests: [{ file: testFile, lines: '1-9999', sha }]
            }
          }
        };

        const bundle = { bundleVersion: '2.0.0', sha, timestamp, evidence, scores };
        const scoresPath = resolveFilePath(outputPaths.bundleDir, 'scores.json');
        const bundlePath = resolveFilePath(outputPaths.bundleDir, 'bundle.json');
        await this.ctx.fs.write(scoresPath, JSON.stringify(scores, null, 2));
        await this.ctx.fs.write(bundlePath, JSON.stringify(bundle, null, 2));

        // Append a tiny history for MORIARTY (hydrate from merge-base if available)
        try {
        const history = await loadMoriartyHistory({
          fs: this.ctx.fs,
          shell: globalThis?.wesleyCtx?.shell,
          defaultBase:
            process.env.WESLEY_BASE_REF ||
            process.env.GITHUB_BASE_REF ||
            process.env.WESLEY_DEFAULT_BRANCH ||
            process.env.GITHUB_DEFAULT_BRANCH ||
            'main',
          bundleDir: outputPaths.bundleDir
        });
          const day = Math.floor(Date.now() / 86400000);
          const nextPoints = mergeHistoryPoints(history.points, [{ day, timestamp, scs, tci, mri }]);
          const historyPath = resolveFilePath(outputPaths.bundleDir, 'history.json');
          await this.ctx.fs.write(historyPath, JSON.stringify({ points: nextPoints }, null, 2));
        } catch {}
      } catch (e) {
        logger.warn('Could not emit HOLMES evidence bundle: ' + (e?.message || e));
      }
    }
    
    await this.compileOpsIfRequested(context);

    // Output results
    if (!options.quiet && !options.json) {
      logger.info('');
      logger.info('✨ Generated:');
      for (const file of artifacts) {
        const display = relative(process.cwd(), file.path || file.name || '');
        logger.info(`  ✓ ${display}`);
      }
      logger.info('');
    }
    
    return {
      artifacts: artifacts.length,
      outDir: outputPaths.baseDir
    };
  }

  async executeWithTasksAndSlaps(context) {
    const { schemaContent, options, logger } = context;
    const { planner, runner, generators, writer } = this.ctx;
    const configPaths = this.ctx?.config?.paths || {};
    const outDir = options.outDir || configPaths.output || 'out';
    const outputPaths = buildOutputPathMap(configPaths, outDir);
    context.outputPaths = outputPaths;
    
    // Build task graph
    const nodes = [
      { id: 'parse', op: 'parse_schema', args: { sdl: schemaContent } },
      { id: 'validate', op: 'validate_ir', needs: ['parse'] },
      { id: 'gen_ddl', op: 'emit_ddl', needs: ['validate'] },
      { id: 'gen_rls', op: 'emit_rls', needs: ['validate'], skip: !options.supabase },
      { id: 'gen_tests', op: 'emit_tests', needs: ['validate'] },
      { id: 'write', op: 'write_files', needs: ['gen_ddl', 'gen_rls', 'gen_tests'], args: { out: options.outDir } }
    ].filter(n => !n.skip);
    
    const edges = [];
    for (const node of nodes) {
      if (node.needs) {
        for (const dep of node.needs) {
          edges.push([dep, node.id]);
        }
      }
    }
    
    const plan = planner.buildPlan(nodes, edges, { versions: {} });
    
    if (options.showPlan) {
      logger.info({ plan }, 'Execution plan:');
    }
    
    // Define handlers
    const handlers = {
      parse_schema: async (n) => ({ ir: this.ctx.parsers.graphql.parse(n.args.sdl) }),
      validate_ir: async (n, deps) => ({ ir: deps.parse.ir }), // pass-through for MVP
      emit_ddl: async (n, deps) => generators.sql.emitDDL(deps.validate.ir),
      emit_rls: async (n, deps) => generators.sql.emitRLS(deps.validate.ir),
      emit_tests: async (n, deps) => generators.tests.emitPgTap(deps.validate.ir),
      write_files: async (n, deps) => {
        const artifacts = [
          ...materializeArtifacts(deps.gen_ddl?.files || [], 'ddl', outputPaths),
          ...materializeArtifacts(deps.gen_rls?.files || [], 'rls', outputPaths),
          ...materializeArtifacts(deps.gen_tests?.files || [], 'pgtap', outputPaths)
        ];
        return writer.writeFiles(artifacts);
      }
    };
    
    // Execute with S.L.A.P.S.
    const result = await runner.run(plan, { handlers, logger });

    await this.compileOpsIfRequested(context);
    
    if (!options.quiet && !options.json) {
      logger.info('✨ Generation complete!');
    }
    
    return result;
  }

  async compileOpsIfRequested(context) {
    const { options, logger } = context;
    // Discovery: prefer explicit --ops or --ops-manifest, otherwise auto-detect conventional paths
    let opsDir = options.ops || null;
    let manifestPath = options.opsManifest || null;
    try {
      const fs = this.ctx.fs;
      if (!manifestPath) {
        for (const c of ['ops/ops.manifest.json', 'ops.manifest.json', 'ops-manifest.json']) {
          if (await fs.exists(c)) { manifestPath = c; break; }
        }
      }
      if (!opsDir && !manifestPath) {
        if (await fs.exists('ops')) opsDir = 'ops';
      }
      if (!opsDir && !manifestPath) return;
      // Build PK map from IR so ops emission can derive deterministic tie-breakers from real keys
      let ir = context.ir;
      try {
        if (!ir && context.schemaContent) {
          ir = this.ctx.parsers.graphql.parse(context.schemaContent);
        }
      } catch {}
      const pkMap = new Map();
      if (ir && Array.isArray(ir.tables)) {
        for (const t of ir.tables) {
          if (t?.name && t?.primaryKey) pkMap.set(String(t.name), String(t.primaryKey));
        }
      }
      const pkResolver = (plan) => {
        // Find leftmost base table alias + name
        let r = plan?.root;
        while (r && r.kind === 'Filter') r = r.input;
        while (r && r.kind === 'Join') r = r.left;
        if (r && r.kind === 'Table' && r.alias && r.table) {
          const pk = pkMap.get(String(r.table));
          if (pk) return { kind: 'ColumnRef', table: r.alias, column: pk };
        }
        return null; // fallback handled in lowerToSQL
      };
      let files = [];
      if (manifestPath) {
        const manifest = JSON.parse(await fs.read(manifestPath));
        // Validate manifest
        try {
          const { default: Ajv } = await import('ajv');
          const { default: addFormats } = await import('ajv-formats');
          const ajv = new Ajv({ strict: false, allErrors: true });
          addFormats(ajv);
          const root = process.env.WESLEY_REPO_ROOT || process.cwd();
          const schemaJson = await fs.read(await fs.join(root, 'schemas', 'ops-manifest.schema.json'));
          const validate = ajv.compile(JSON.parse(schemaJson));
          const ok = validate(manifest);
          if (!ok) {
            const err = new OpsError('OPS_MANIFEST_INVALID', 'Ops manifest failed schema validation', { errors: validate.errors, file: manifestPath });
            logger.error(err.meta, err.message);
            throw err;
          }
        } catch (e) {
          if (!e.code) e.code = 'OPS_MANIFEST_INVALID';
          throw e;
        }
        files = await resolveManifestEntries(fs, manifest.include || [], manifest.exclude || [], logger);
        if (files.length === 0 && !(JSON.parse(await fs.read(manifestPath)).allowEmpty)) {
          const err = new OpsError('OPS_EMPTY_SET', 'Ops manifest produced no files and allowEmpty=false', { file: manifestPath });
          logger.error(err.meta, err.message);
          throw err;
        }
      } else {
        files = await findOpFiles(fs, opsDir, logger);
      }
      if (files.length === 0) {
        return;
      }
      const configPaths = this.ctx?.config?.paths || {};
      const outputPaths = context.outputPaths || buildOutputPathMap(configPaths, options.outDir || configPaths.output || 'out');
      const baseOutDir = outputPaths.baseDir;
      const targetSchema = options.opsSchema || 'wes_ops';
      const allowErrors = Boolean(options.opsAllowErrors);
      const compiledOps = [];
      const collisions = new Map();
      const compileErrors = [];
      const skippedErrors = [];
      let fileIndex = 0;
      const workerCount = Math.min(CONCURRENCY_LIMIT, files.length);
      const workers = Array.from({ length: workerCount }, async () => {
        for (;;) {
          const idx = fileIndex++;
          if (idx >= files.length) break;
          const path = files[idx];
          try {
            const compiled = await compileOpFile(fs, path, collisions, logger);
            compiledOps.push({ order: idx, ...compiled });
          } catch (e) {
            if (e?.code === 'OPS_IDENTIFIER_TOO_LONG') {
              logger.error(
                { file: path, sanitized: e?.meta?.sanitized, bytes: e?.meta?.bytes },
                e.message
              );
              throw e;
            }
            if (allowErrors) {
              skippedErrors.push({ file: path, message: e?.message || String(e), code: e?.code });
              logger.warn({ file: path, code: e?.code }, 'Skipping op due to compile error (allowed)');
            } else {
              compileErrors.push({ file: path, message: e?.message || String(e), code: e?.code });
              logger.warn({ file: path, code: e?.code }, 'Failed to compile op: ' + (e?.message || e));
            }
          }
        }
      });
      await Promise.all(workers);

      if (compileErrors.length > 0) {
        const err = new OpsError(
          'OPS_COMPILE_FAILED',
          `Failed to compile ${compileErrors.length} operation(s); see log for details`,
          { failures: compileErrors }
        );
        logger.error(err.meta, err.message);
        throw err;
      }
      if (skippedErrors.length > 0) {
        logger.warn({ count: skippedErrors.length, failures: skippedErrors }, 'Continuing despite compilation errors due to --ops-allow-errors');
      }
      if (compiledOps.length) {
        compiledOps.sort((a, b) => a.order - b.order);
        const orderedOps = compiledOps.map(({ order, ...rest }) => rest);
        const security = String(options.opsSecurity || 'invoker');
        const setSearchPath = options.opsSearchPath
          ? String(options.opsSearchPath).split(',').map(s => s.trim()).filter(Boolean)
          : null;
        const explainMode = (options.opsExplain || '').toLowerCase();
        const outFiles = emitOpArtifacts(orderedOps, targetSchema, logger, pkResolver, { security, setSearchPath, allowErrors: !!options.opsAllowErrors, explainMode });
        const materialized = materializeArtifacts(outFiles, 'ops', outputPaths);
        await this.ctx.writer.writeFiles(materialized);
        const opsOutputDir = outputPaths.ops;
        logger.info({ count: outFiles.length, dir: opsOutputDir }, 'Compiled operations (experimental)');

        // Validate generated registry.json against schema
        try {
          const registryPath = await this.ctx.fs.join(opsOutputDir, 'registry.json');
          if (await this.ctx.fs.exists(registryPath)) {
            const [{ default: Ajv }, { default: addFormats }] = await Promise.all([
              import('ajv'),
              import('ajv-formats')
            ]);
            const ajv = new Ajv({ strict: false, allErrors: true });
            addFormats(ajv);
            const root = process.env.WESLEY_REPO_ROOT || process.cwd();
            const schemaJson = await this.ctx.fs.read(await this.ctx.fs.join(root, 'schemas', 'ops-registry.schema.json'));
            const schema = JSON.parse(schemaJson);
            const reg = JSON.parse((await this.ctx.fs.read(registryPath)).toString('utf8'));
            const validate = ajv.compile(schema);
            if (!validate(reg)) {
              const err = new OpsError('OPS_REGISTRY_INVALID', 'Generated ops registry failed schema validation', { errors: validate.errors, file: registryPath });
              this.ctx.logger.error(err.meta, err.message);
              if (!options.opsAllowErrors) throw err;
            } else {
              this.ctx.logger.info({ file: registryPath }, 'Ops registry validated');
            }
          }
        } catch (ve) {
          this.ctx.logger.warn({ error: ve?.message }, 'Ops registry validation skipped due to error');
          if (!options.opsAllowErrors) throw ve;
        }
      }
    } catch (e) {
      logger.error({ code: e?.code, error: e?.message }, 'Experimental --ops failed');
      throw e;
    }
  }
}

// Export for testing
export default GeneratePipelineCommand;

// Limit concurrent file I/O to balance throughput with resource usage.
const CONCURRENCY_LIMIT = 8;
// PostgreSQL truncates identifiers to 63 bytes (NAMEDATALEN - 1) and counts UTF-8 byte length.
// See: https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
const POSTGRESQL_IDENTIFIER_LIMIT = 63;

class OpsError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = 'OpsError';
    this.code = code;
    this.meta = { code, ...meta };
  }
}

function sanitizeOpIdentifier(name) {
  const normalized = (name ?? 'unnamed').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const raw = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  let sanitized = raw || 'unnamed';
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`;
  return sanitized;
}

function derivePrefixedIdentifier(baseName) {
  const normalized = String(baseName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const effective = normalized || 'op';
  const suffix = effective === 'op' ? 'unnamed' : effective;
  return `op_${suffix}`;
}

async function findOpFiles(fs, opsDir, logger) {
  const exists = await fs.exists(opsDir);
  if (!exists) {
    logger.info({ opsDir }, 'Experimental --ops: directory not found; skipping');
    return [];
  }
  const acc = [];
  const walk = async (dir) => {
    const entries = await fs.readDir?.(dir);
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (e.isDirectory) {
        await walk(e.path);
      } else if (e.isFile && e.name?.endsWith?.('.op.json')) {
        acc.push(e.path || await fs.join(dir, e.name));
      }
    }
  };
  await walk(opsDir);
  acc.sort(); // locale-invariant deterministic ordering
  if (acc.length === 0) {
    logger.info({ opsDir }, 'Experimental --ops: no *.op.json files found; skipping');
  }
  return acc;
}

async function resolveManifestEntries(fs, includes = [], excludes = [], logger) {
  const acc = new Set();
  const addDir = async (dir) => {
    const entries = await fs.readDir(dir);
    for (const e of entries) {
      if (e.isDirectory) await addDir(e.path);
      else if (e.isFile && e.name?.endsWith?.('.op.json')) acc.add(e.path);
    }
  };
  for (const entry of includes) {
    if (!entry) continue;
    const path = entry;
    const isDir = await fs.readDir?.(path).then(()=>true).catch(()=>false);
    if (isDir) await addDir(path);
    else if (await fs.exists(path)) acc.add(path);
  }
  const excluded = (p) => excludes.some(ex => p === ex || p.endsWith(ex));
  const list = Array.from(acc).filter(p => !excluded(p)).sort();
  if (list.length === 0) logger.info({ includes, excludes }, 'ops manifest resolved no files');
  return list;
}

async function compileOpFile(fs, path, collisions, logger) {
  const raw = await fs.read(path);
  const op = JSON.parse(String(raw));
  const plan = buildPlanFromJson(op);
  const baseName = sanitizeOpIdentifier(op.name);
  const byteLength = Buffer.byteLength(baseName, 'utf8');
  if (byteLength > POSTGRESQL_IDENTIFIER_LIMIT) {
    throw new OpsError(
      'OPS_IDENTIFIER_TOO_LONG',
      `Sanitized op name "${baseName}" from ${path} exceeds PostgreSQL identifier limit (bytes=${byteLength}, limit=${POSTGRESQL_IDENTIFIER_LIMIT})`,
      { file: path, sanitized: baseName, bytes: byteLength, limit: POSTGRESQL_IDENTIFIER_LIMIT }
    );
  }
  const emittedIdentifier = derivePrefixedIdentifier(baseName);
  const emittedByteLength = Buffer.byteLength(emittedIdentifier, 'utf8');
  if (emittedByteLength > POSTGRESQL_IDENTIFIER_LIMIT) {
    throw new OpsError(
      'OPS_IDENTIFIER_TOO_LONG',
      `Prefixed op identifier "${emittedIdentifier}" from ${path} exceeds PostgreSQL identifier limit (bytes=${emittedByteLength}, limit=${POSTGRESQL_IDENTIFIER_LIMIT})`,
      {
        file: path,
        sanitized: emittedIdentifier,
        base: baseName,
        bytes: emittedByteLength,
        limit: POSTGRESQL_IDENTIFIER_LIMIT
      }
    );
  }
  const seen = collisions.get(baseName) || [];
  seen.push(path);
  collisions.set(baseName, seen);
  if (seen.length > 1) {
    const err = new OpsError(
      'OPS_COLLISION',
      `Identifier collision detected: "${baseName}" used in ${seen.join(', ')}`,
      { identifier: baseName, paths: [...seen] }
    );
    logger.error(err.meta, err.message);
    throw err;
  }
  const paramCount = (collectParams(plan)?.ordered?.length) || 0;
  return { baseName, plan, isParamless: paramCount === 0, path };
}

function emitOpArtifacts(compiledOps, targetSchema, logger, pkResolver, { security = 'invoker', setSearchPath = null, allowErrors = false, explainMode = '' } = {}) {
  const outFiles = [];
  const total = compiledOps.length;
  let ordinal = 0;
  const deployChunks = [`BEGIN;`, `CREATE SCHEMA IF NOT EXISTS "${targetSchema}";`];
  const registry = { version: '1.0.0', schema: targetSchema, ops: [] };
  for (const entry of compiledOps) {
    ordinal += 1;
    const { baseName, plan, isParamless, path } = entry;
    let emitted = false;
    try {
      const fnSql = emitFunction(baseName, plan, { schema: targetSchema, identPolicy: 'strict', pkResolver, security, setSearchPath });
      if (isParamless) {
        const viewSql = emitView(baseName, plan, { schema: targetSchema, identPolicy: 'strict', pkResolver });
        outFiles.push({ name: `${baseName}.view.sql`, content: `${viewSql}\n` });
        deployChunks.push(viewSql);
      }
      outFiles.push({ name: `${baseName}.fn.sql`, content: `${fnSql}\n` });
      deployChunks.push(fnSql);
      emitted = true;
    } catch (e) {
      if (!allowErrors) throw e;
      logger.warn({ op: baseName, file: path, error: e?.message }, 'Skipping op during emission due to error');
    }
    logger.info(
      { ordinal, total, sanitized: baseName, file: path, schema: targetSchema, code: 'OPS_DISCOVERY' },
      'ops: compiled operation'
    );

    // Build registry entry (deterministic)
    try {
      const params = (collectParams(plan)?.ordered || []).map(p => ({ name: String(p.name), type: p.typeHint || 'text' }));
      const projItems = Array.isArray(plan?.projection?.items) ? plan.projection.items.map(i => String(i?.alias || '')).filter(Boolean) : [];
      const opId = derivePrefixedIdentifier(baseName);
      const entryJson = {
        name: baseName,
        sql: {
          schema: targetSchema,
          function: opId,
          view: isParamless ? opId : null
        },
        params,
        projection: {
          star: projItems.length === 0,
          items: projItems
        },
        files: {
          function: `${baseName}.fn.sql`,
          view: isParamless ? `${baseName}.view.sql` : null
        },
        sourceFile: path
      };
      if (emitted) registry.ops.push(entryJson);
    } catch (e) {
      logger.warn({ file: path, error: e?.message }, 'Failed to record registry entry');
    }

    // Optional EXPLAIN JSON snapshot (mock only for now)
    if (emitted && String(explainMode).toLowerCase() === 'mock') {
      const explain = {
        Plan: { 'Node Type': 'Result', Plans: [] },
        Mock: true,
        Version: 1
      };
      outFiles.push({ name: `explain/${baseName}.explain.json`, content: JSON.stringify(explain, null, 2) + '\n' });
    }
  }
  deployChunks.push('COMMIT;');
  outFiles.push({ name: `ops_deploy.sql`, content: deployChunks.join('\n\n') + '\n' });
  // Emit registry.json next to SQL outputs
  try {
    const registryStr = JSON.stringify({
      version: registry.version,
      schema: registry.schema,
      ops: registry.ops.sort((a, b) => a.name.localeCompare(b.name))
    }, null, 2) + '\n';
    outFiles.push({ name: `registry.json`, content: registryStr });
  } catch (e) {
    logger.warn({ error: e?.message }, 'Failed to emit ops registry');
  }
  return outFiles;
}

// Utilities
function shouldEnforceClean(env, options) {
  const policy = (env?.WESLEY_GIT_POLICY || 'emit').toLowerCase();
  if (policy === 'off') return false;
  if (policy === 'strict') return true;
  // default policy: enforce only when producing bundle/certs
  return !!options.emitBundle;
}
async function assertCleanGit() {
  try {
    await (globalThis?.wesleyCtx?.shell?.execSync?.('git rev-parse --is-inside-work-tree', { stdio: 'ignore' }));
  } catch {
    return; // Not a git repo: skip
  }
  const out = (await globalThis?.wesleyCtx?.shell?.exec?.('git status --porcelain')).stdout.trim();
  if (out.length > 0) {
    const err = new Error('Working tree has uncommitted changes. Commit or stash before running, or pass --allow-dirty.');
    err.code = 'DIRTY_WORKTREE';
    throw err;
  }
}

async function loadMoriartyHistory({ fs, shell, defaultBase, bundleDir = '.wesley' }) {
  let points = [];
  try {
    const bundlePath = resolveFilePath(bundleDir, 'history.json');
    const raw = await fs.read(bundlePath);
    const parsed = JSON.parse(raw.toString('utf8'));
    if (Array.isArray(parsed?.points)) {
      points = mergeHistoryPoints(points, parsed.points);
    }
  } catch (err) {
    console.warn('[Moriarty] Unable to read local history:', err?.message);
  }

  const gitShell = shell?.exec ? shell : null;
  if (!gitShell) {
    return { points };
  }

  try {
    const inside = await gitShell.exec('git rev-parse --is-inside-work-tree');
    if (!inside?.stdout?.trim()) return { points };
  } catch (err) {
    console.warn('[Moriarty] Git repo check failed:', err?.message);
    return { points };
  }

  let mergeBase;
  const fallbackBase =
    defaultBase ||
    process.env.WESLEY_BASE_REF ||
    process.env.GITHUB_BASE_REF ||
    process.env.WESLEY_DEFAULT_BRANCH ||
    process.env.GITHUB_DEFAULT_BRANCH ||
    'main';
  try {
    const mb = await gitShell.exec(`git merge-base HEAD ${fallbackBase}`);
    mergeBase = mb?.stdout?.trim();
  } catch (err) {
    console.warn('[Moriarty] merge-base lookup failed:', err?.message);
    return { points };
  }
  if (!mergeBase) return { points };

  try {
    const show = await gitShell.exec(`git show ${mergeBase}:.wesley/history.json`);
    if (show?.stdout) {
      const parsed = JSON.parse(show.stdout);
      if (Array.isArray(parsed?.points)) {
        points = mergeHistoryPoints(parsed.points, points);
      }
    }
  } catch (err) {
    console.warn('[Moriarty] No history at merge-base:', err?.message);
    // merge-base history missing or unreadable; ignore
  }

  return { points };
}

function mergeHistoryPoints(...pointArrays) {
  const dedupe = new Map();
  for (const arr of pointArrays) {
    if (!Array.isArray(arr)) continue;
    for (const point of arr) {
      const key = point?.timestamp || `${point?.day ?? 'unknown'}-${point?.scs ?? '0'}-${point?.tci ?? '0'}`;
      dedupe.set(key, point);
    }
  }
  return Array.from(dedupe.values()).sort((a, b) => {
    const at = Date.parse(a?.timestamp || 0);
    const bt = Date.parse(b?.timestamp || 0);
    if (!Number.isNaN(at) && !Number.isNaN(bt)) return at - bt;
    return (a?.day ?? 0) - (b?.day ?? 0);
  });
}
