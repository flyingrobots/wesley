/**
 * Generate Command - Full Pipeline
 * Uses Commander for parsing + DI for execution
 * Auto-registers on import
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { buildPlanFromJson, emitFunction, emitView, collectParams, opJsonSchema } from '@wesley/core/domain/qir';

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
      .option('--ops <dir>', 'Experimental: directory with GraphQL operation documents (queries) to validate', 'ops')
      .option('--emit-bundle', 'Emit .wesley/ evidence bundle')
      .option('--supabase', 'Enable Supabase features (RLS tests)')
      .option('--out-dir <dir>', 'Output directory', 'out')
      .option('--allow-dirty', 'Allow running with a dirty git working tree (not recommended)')
      .option('-v, --verbose', 'More logs (level=debug)')
      .option('--debug', 'Debug output with stack traces')
      .option('-q, --quiet', 'Silence logs (level=silent)')
      .option('--json', 'Emit newline-delimited JSON logs')
      .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
      .option('--show-plan', 'Display execution plan before running');
  }

  async executeCore(context) {
    const { schemaContent, schemaPath, options, logger } = context;
    const outDir = options.outDir || this.ctx?.config?.paths?.output || 'out';
    options.outDir = outDir;
    
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

    // Experimental ops: validate presence of operation documents if --ops provided
    if (options.ops) {
      try {
        const opsDir = options.ops;
        const fs = this.ctx.fs;
        const exists = await fs.exists(opsDir);
        if (!exists) {
          logger.warn({ opsDir }, 'Experimental --ops: directory not found; skipping ops validation');
        } else {
          // naive scan for .graphql files
          // We avoid Node-specific APIs: rely on adapter for a minimal read attempt
          // Try common filenames
          const candidates = ['queries.graphql', 'operations.graphql'];
          let found = false;
          for (const c of candidates) {
            const p = await fs.join(opsDir, c);
            if (await fs.exists(p)) { found = true; break; }
          }
          if (!found) {
            logger.info({ opsDir }, 'Experimental --ops: no known op files found; continue (no-op)');
          } else {
            logger.info({ opsDir }, 'Experimental --ops detected; future versions will compile operations to SQL (QIR).');
          }
        }
      } catch (e) {
        logger.warn('Experimental --ops validation failed: ' + (e?.message || e));
      }
    }

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
    if (ddlResult && ddlResult.files) {
      artifacts.push(...ddlResult.files);
    }
    
    // Generate RLS if Supabase flag
    if (options.supabase && generators.sql.emitRLS) {
      const rlsResult = generators.sql.emitRLS(ir);
      if (rlsResult && rlsResult.files) {
        artifacts.push(...rlsResult.files);
      }
    }
    
    // Generate tests
    if (generators.tests && generators.tests.emitPgTap) {
      const testResult = generators.tests.emitPgTap(ir);
      if (testResult && testResult.files) {
        artifacts.push(...testResult.files);
      }
    }
    
    // Write files
    if (writer && writer.writeFiles) {
      await writer.writeFiles(artifacts, options.outDir);
    }
    
    // Persist snapshot of IR for future diffs
    try {
      if (this.ctx.fs && ir && ir.tables) {
        await this.ctx.fs.write('.wesley/snapshot.json', JSON.stringify({ irVersion: '1.0.0', tables: ir.tables }, null, 2));
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

        const scores = { scores: { scs, tci, mri }, readiness };

        // Evidence map: cite generated SQL and tests
        const sqlFile = `${outDir}/schema.sql`;
        const testFile = `${outDir}/tests.sql`;
        const evidence = {
          // Use coarse UID until we have fine-grained per-field evidence
          evidence: {
            schema: {
              sql: [{ file: sqlFile, lines: '1-9999', sha }],
              tests: [{ file: testFile, lines: '1-9999', sha }]
            }
          }
        };

        const bundle = { sha, timestamp, evidence, scores };
        await this.ctx.fs.write('.wesley/scores.json', JSON.stringify(scores, null, 2));
        await this.ctx.fs.write('.wesley/bundle.json', JSON.stringify(bundle, null, 2));

        // Append a tiny history for MORIARTY
        try {
          let history = { points: [] };
          try {
            const raw = await this.ctx.fs.read('.wesley/history.json');
            history = JSON.parse(raw.toString('utf8')) || history;
          } catch {}
          const day = Math.floor(Date.now() / 86400000);
          history.points.push({ day, timestamp, scs, tci, mri });
          await this.ctx.fs.write('.wesley/history.json', JSON.stringify(history, null, 2));
        } catch {}
      } catch (e) {
        logger.warn('Could not emit HOLMES evidence bundle: ' + (e?.message || e));
      }
    }
    
    // Compile operations behind --ops (experimental)
    await this.compileOpsIfRequested(context);

    // Output results
    if (!options.quiet && !options.json) {
      logger.info('');
      logger.info('✨ Generated:');
      for (const file of artifacts) {
        logger.info(`  ✓ ${file.name}`);
      }
      logger.info('');
    }
    
    return {
      artifacts: artifacts.length,
      outDir: options.outDir
    };
  }

  async executeWithTasksAndSlaps(context) {
    const { schemaContent, options, logger } = context;
    const { planner, runner, generators, writer } = this.ctx;
    
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
          ...(deps.gen_ddl?.files || []),
          ...(deps.gen_rls?.files || []),
          ...(deps.gen_tests?.files || [])
        ];
        return writer.writeFiles(artifacts, n.args.out);
      }
    };
    
    // Execute with S.L.A.P.S.
    const result = await runner.run(plan, { handlers, logger });

    // After main generation, compile operations if requested
    await this.compileOpsIfRequested(context);
    
    if (!options.quiet && !options.json) {
      logger.info('✨ Generation complete!');
    }
    
    return result;
  }

  async compileOpsIfRequested(context) {
    const { options, logger } = context;
    const opsDir = options.ops;
    if (!opsDir) return;
    try {
      const fs = this.ctx.fs;
      const exists = await fs.exists(opsDir);
      if (!exists) {
        logger.info({ opsDir }, 'Experimental --ops: directory not found; skipping');
        return;
      }
      // Find *.op.json files (MVP DSL)
      const dirEntries = await fs.readDir?.(opsDir);
      const files = Array.isArray(dirEntries)
        ? dirEntries.filter(f => f.name?.endsWith?.('.op.json')).map(f => f.path || `${opsDir}/${f.name}`)
        : [];
      if (files.length === 0) {
        // Fallback to a couple of well-known names
        const fallbacks = ['products_by_name.op.json', 'orders_by_user.op.json'];
        for (const name of fallbacks) {
          const p = await fs.join(opsDir, name);
          if (await fs.exists(p)) files.push(p);
        }
      }
      if (files.length === 0) {
        logger.info({ opsDir }, 'Experimental --ops: no *.op.json files found; skipping');
        return;
      }
      const outDir = options.outDir || 'out';
      const outFiles = [];

      // Prepare JSON Schema validator (dynamic import to keep host-light)
      let ajv, addFormats, validateOp;
      try {
        const AjvMod = await import('ajv');
        const Ajv = AjvMod.default || AjvMod;
        const fmtMod = await import('ajv-formats');
        addFormats = (fmtMod.default || fmtMod);
        ajv = new Ajv({ strict: false, allErrors: true });
        addFormats(ajv);
        validateOp = ajv.compile(opJsonSchema);
      } catch (e) {
        logger.warn('Experimental --ops: failed to initialize AJV, skipping schema validation: ' + (e?.message || e));
      }
      for (const path of files) {
        try {
          const raw = await fs.read(path);
          const op = JSON.parse(String(raw));
          // Validate against schema first
          if (validateOp && !validateOp(op)) {
            const errs = (validateOp.errors || []).map(er => `${er.instancePath || '(root)'} ${er.message}`).join('; ');
            logger.warn({ file: path, errors: validateOp.errors }, `Op schema validation failed: ${errs}`);
            continue;
          }
          const plan = buildPlanFromJson(op);
          const paramCount = (collectParams(plan)?.ordered?.length) || 0;
          const isParamless = paramCount === 0;
          const fnSql = emitFunction(op.name || 'unnamed', plan);
          let baseName = (op.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          if (!baseName) baseName = 'unnamed';
          if (baseName.length > 240) baseName = baseName.slice(0, 240);
          if (isParamless) {
            const viewSql = emitView(op.name || 'unnamed', plan);
            outFiles.push({ name: `ops/${baseName}.view.sql`, content: viewSql + '\n' });
          }
          outFiles.push({ name: `ops/${baseName}.fn.sql`, content: fnSql + '\n' });
        } catch (e) {
          logger.warn({ file: path }, 'Failed to compile op: ' + (e?.message || e));
        }
      }
      if (outFiles.length) {
        // Aggregate all function SQL into a single file for docker-compose init
        const fnChunks = outFiles
          .filter(f => f.name.endsWith('.fn.sql'))
          .map(f => `-- ${f.name}\n${f.content}`);
        if (fnChunks.length) {
          outFiles.push({ name: 'ops.functions.sql', content: fnChunks.join('\n') });
        }
        await this.ctx.writer.writeFiles(outFiles, outDir);
        const opsDir = await fs.join(outDir, 'ops');
        logger.info({ count: outFiles.length, dir: opsDir }, 'Compiled operations (experimental)');

        // Generate basic pgTAP tests for ops functions
        try {
          const tapSql = await this.buildOpsPgTapTests(outDir);
          if (tapSql) {
            await this.ctx.writer.writeFiles([{ name: 'tests-ops.sql', content: tapSql }], outDir);
            logger.info({ file: await fs.join(outDir, 'tests-ops.sql') }, 'Emitted pgTAP tests for ops');
          }
        } catch (e) {
          logger.warn('Failed to emit pgTAP tests for ops: ' + (e?.message || e));
        }
      }
    } catch (e) {
      logger.warn('Experimental --ops failed: ' + (e?.message || e));
    }
  }

  // Build a minimal pgTAP suite validating ops functions exist and include expected clauses
  async buildOpsPgTapTests(outDir) {
    const fs = this.ctx.fs;
    const opsPath = await fs.join(outDir, 'ops');
    const exists = await fs.exists(opsPath);
    if (!exists) return '';
    const dirEntries = await fs.readDir?.(opsPath);
    const fnFiles = (dirEntries || []).filter(f => f.name?.endsWith?.('.fn.sql'));
    if (fnFiles.length === 0) return '';
    const lines = [];
    lines.push('-- Wesley Generated pgTAP suite for ops');
    lines.push('BEGIN;');
    lines.push('SELECT plan(999);');
    lines.push("CREATE SCHEMA IF NOT EXISTS wes_ops; -- Ensure schema for functions under test");

    for (const f of fnFiles) {
      const content = String(await fs.read(f.path || (await fs.join(opsPath, f.name))));
      const m = content.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+"?(\w+)"?\./i)
        ? null
        : content.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([^\s(]+)/i);
      // Extract function signature schema.func(args)
      let fnQName = null;
      if (!m) {
        const m2 = content.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+\"?([a-zA-Z_][\w]*)\"?\.(\"?[a-zA-Z_][\w]*\"?)/);
        if (m2) fnQName = `${m2[1]}.${m2[2].replace(/\"/g,'"')}`;
      } else {
        fnQName = (m && m[1]) || null;
      }
      // Use filename to recover base op name
      const base = f.name.replace(/\.fn\.sql$/,'');
      const opName = `op_${base}`;
      // Test function presence via catalog
      lines.push(`SELECT ok(EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wes_ops' AND p.proname='${opName}'), 'wes_ops.${opName} exists');`);
      // Test definition contains FROM root table (best-effort)
      // This is a heuristic: look for FROM "<table>" or FROM <table>
      // Without parsing, assert presence of FROM in definition
      lines.push(`SELECT ok(position('FROM' in pg_get_functiondef(p.oid)) > 0, 'wes_ops.${opName} contains FROM clause') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wes_ops' AND p.proname='${opName}';`);
    }

    lines.push('SELECT finish();');
    lines.push('ROLLBACK;');
    lines.push('');
    return lines.join('\n');
  }
}

// Export for testing
export default GeneratePipelineCommand;

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
