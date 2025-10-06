/**
 * Generate Command - Full Pipeline
 * Uses Commander for parsing + DI for execution
 * Auto-registers on import
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

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
    
    if (!options.quiet && !options.json) {
      logger.info('✨ Generation complete!');
    }
    
    return result;
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
