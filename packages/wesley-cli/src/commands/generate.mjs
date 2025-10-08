/**
 * Generate Command - Full Pipeline
 * Uses Commander for parsing + DI for execution
 * Auto-registers on import
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { buildPlanFromJson, emitFunction, emitView, collectParams, lowerToSQL } from '@wesley/core/domain/qir';

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
      .option('--ops <dir>', 'Experimental: directory with GraphQL operation JSON files (*.op.json)', 'ops')
      .option('--ops-glob <pattern>', 'Glob for ops discovery (default: **/*.op.json)')
      .option('--ops-allow-empty', 'Do not error if no ops are found')
      .option('--ops-explain', 'Emit EXPLAIN JSON snapshots for ops (writes to out/ops/explain)')
      .option('--ops-explain-json', 'Execute EXPLAIN (FORMAT JSON) for paramless ops against a DSN and write snapshots')
      .option('--ops-dsn <url>', 'Database DSN to use with --ops-explain-json')
      .option('--ops-manifest <path>', 'Optional manifest (include/exclude) to control discovery')
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
        const e = new Error(`--ops directory not found: ${opsDir}`);
        e.code = 'ENOENT';
        throw e;
      }
      // Discovery mode: Manifest overrides directory contract
      let files = [];
      let pattern = options.opsGlob || '**/*.op.json';
      let manifest = null;
      if (options.opsManifest) {
        // Manifest mode (B)
        const manifestPath = options.opsManifest;
        const raw = await fs.read(manifestPath);
        manifest = JSON.parse(String(raw));
        // Validate manifest against schema if available
        try {
          const AjvMod = await import('ajv');
          const Ajv = AjvMod.default || AjvMod;
          const fmtMod = await import('ajv-formats');
          const addFormats = fmtMod.default || fmtMod;
          const ajv = new Ajv({ strict: false, allErrors: true });
          addFormats(ajv);
          let mschema;
          try { mschema = JSON.parse(String(await fs.read('schemas/ops-manifest.schema.json'))); } catch {}
          if (mschema) {
            const validate = ajv.compile(mschema);
            if (!validate(manifest)) {
              const errs = (validate.errors || []).map(er => `${er.instancePath || '(root)'} ${er.message}`).join('; ');
              const e = new Error(`ops manifest validation failed: ${errs}`); e.code='VALIDATION_FAILED'; throw e;
            }
          }
        } catch (e) {
          // Schema missing or Ajv unavailable → continue; discovery will still run
          if (e?.code === 'VALIDATION_FAILED') throw e;
          logger.warn('ops: manifest validation unavailable: ' + (e?.message || e));
        }
        // Minimal structural validation (we keep Ajv out to avoid extra deps)
        const inc = Array.isArray(manifest.include) ? manifest.include : [];
        const exc = Array.isArray(manifest.exclude) ? manifest.exclude : [];
        const allowEmpty = Boolean(manifest.allowEmpty);
        const expanded = await expandGlobs(fs, opsDir, inc.length ? inc : ['**/*.op.json']);
        const excluded = await expandGlobs(fs, opsDir, exc);
        const exclSet = new Set(excluded);
        files = expanded.filter(f => !exclSet.has(f));
        pattern = inc.length ? inc.join(',') : pattern;
        if (files.length === 0 && !allowEmpty && !options.opsAllowEmpty) {
          const e = new Error(`Manifest produced no files (ops=${opsDir}, include=${JSON.stringify(inc)}, exclude=${JSON.stringify(exc)})`);
          e.code = 'VALIDATION_FAILED';
          throw e;
        }
      } else {
        // Strict directory contract (A)
        files = await findOpFilesRecursive(fs, opsDir, pattern);
      }
      if (files.length === 0 && !options.opsAllowEmpty) {
        const e = new Error(`No ops matched in ${opsDir} (glob: ${pattern}). Pass --ops-allow-empty to proceed.`);
        e.code = 'VALIDATION_FAILED';
        throw e;
      }
      const outDir = options.outDir || 'out';
      const outFiles = [];

      // Prepare JSON Schema validator (Ajv)
      let ajvValidate;
      try {
        const AjvMod = await import('ajv');
        const Ajv = AjvMod.default || AjvMod;
        const fmtMod = await import('ajv-formats');
        const addFormats = fmtMod.default || fmtMod;
        const ajv = new Ajv({ strict: false, allErrors: true });
        addFormats(ajv);
        let schema;
        try {
          const qir = await import('@wesley/core/domain/qir');
          schema = qir.opJsonSchema;
        } catch {}
        if (!schema) {
          try {
            const mod = await import('@wesley/core/src/domain/qir/op.schema.mjs');
            schema = mod.opJsonSchema;
          } catch {}
        }
        if (!schema) {
          try {
            // Fallback to reading JSON schema shipped in repo
            const rawSchema = await this.ctx.fs.read('schemas/op.schema.json');
            schema = JSON.parse(String(rawSchema));
          } catch {}
        }
        if (schema) {
          ajvValidate = ajv.compile(schema);
        } else {
          logger.warn('ops: no schema export found; skipping Ajv validation');
        }
      } catch (e) {
        logger.warn('ops: could not initialize Ajv; schema validation skipped: ' + (e?.message || e));
      }

      // Load + validate + detect collisions
      const collisions = new Map(); // baseName -> [files]
      let hadErrors = false;
      const opsLoaded = [];
      for (const path of files) {
        try {
          const raw = await fs.read(path);
          const op = JSON.parse(String(raw));
          if (ajvValidate && !ajvValidate(op)) {
            hadErrors = true;
            const errs = (ajvValidate.errors || []).map(er => `${er.instancePath || '(root)'} ${er.message}`).join('; ');
            logger.warn({ file: path, errors: ajvValidate.errors }, `ops: schema validation failed: ${errs}`);
            continue;
          }
          let baseName = (op.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          if (!baseName) baseName = 'unnamed';
          if (baseName.length > 240) baseName = baseName.slice(0, 240);
          const list = collisions.get(baseName) || [];
          list.push(path);
          collisions.set(baseName, list);
          opsLoaded.push({ path, op, baseName });
        } catch (e) {
          hadErrors = true;
          logger.warn({ file: path }, 'ops: failed to read/parse op: ' + (e?.message || e));
        }
      }

      // Collisions → fail
      const dupes = Array.from(collisions.entries()).filter(([_, arr]) => arr.length > 1);
      if (dupes.length > 0) {
        hadErrors = true;
        for (const [key, arr] of dupes) {
          logger.warn({ key, files: arr }, `ops: sanitized name collision: ${key}`);
        }
      }
      if (hadErrors && !options.opsAllowErrors) {
        const e = new Error('ops: one or more operations failed validation or collided');
        e.code = 'VALIDATION_FAILED';
        throw e;
      }

      // Compile ordered set deterministically
      opsLoaded.sort((a,b)=> a.baseName.localeCompare(b.baseName));
      for (const { op, baseName } of opsLoaded) {
        try {
          const plan = buildPlanFromJson(op);
          const paramCount = (collectParams(plan)?.ordered?.length) || 0;
          const isParamless = paramCount === 0;
          const fnSql = emitFunction(baseName, plan);
          if (isParamless) {
            const viewSql = emitView(baseName, plan);
            outFiles.push({ name: `ops/${baseName}.view.sql`, content: viewSql + '\n' });
          }
          outFiles.push({ name: `ops/${baseName}.fn.sql`, content: fnSql + '\n' });
          // Optional: emit EXPLAIN SQL wrapper for later execution (does not contact DB)
          if (options.opsExplain) {
            const sel = lowerToSQL(plan);
            const explain = [
              'EXPLAIN (FORMAT JSON)',
              'SELECT to_jsonb(q.*) FROM (',
              sel,
              ') AS q;'
            ].join('\n');
            outFiles.push({ name: `ops/explain/${baseName}.explain.sql`, content: explain + '\n' });
          }
        } catch (e) {
          logger.warn({ op: baseName }, 'ops: failed to compile plan: ' + (e?.message || e));
          if (!options.opsAllowErrors) {
            const ex = new Error('ops: compile failed');
            ex.code = 'VALIDATION_FAILED';
            throw ex;
          }
        }
      }
      for (const path of files) {
        // no-op: preserved block boundary for patch clarity
      }
      if (outFiles.length) {
        // Aggregators when explain is enabled
        if (options.opsExplain) {
          const explainChunks = outFiles
            .filter(f => f.name.startsWith('ops/explain/') && f.name.endsWith('.explain.sql'))
            .map(f => `-- ${f.name}\n${f.content}`);
          if (explainChunks.length) {
            outFiles.push({ name: 'ops.explain.sql', content: explainChunks.join('\n') });
          }
        }
        await this.ctx.writer.writeFiles(outFiles, outDir);
        const opsOutputDir = await fs.join(outDir, 'ops');
        logger.info({ count: outFiles.length, dir: opsOutputDir }, 'Compiled operations');

        // Optional: run EXPLAIN (FORMAT JSON) for paramless ops if DSN provided
        if (options.opsExplainJson && options.opsDsn && Array.isArray(opsLoaded) && opsLoaded.length) {
          const explainDir = await fs.join(outDir, 'ops', 'explain-json');
          try { await fs.mkdir?.(explainDir, { recursive: true }); } catch {}
          for (const { baseName } of opsLoaded) {
            try {
              // If paramless (we emitted view), run without args.
              // If params exist, look for manifest.explainArgs samples by (sanitized) name.
              const hasView = outFiles.some(f => f.name === `ops/${baseName}.view.sql`);
              let sql;
              if (hasView) {
                sql = `EXPLAIN (FORMAT JSON) SELECT * FROM wes_ops.op_${baseName}()`;
              } else if (manifest && manifest.explainArgs) {
                // prefer sanitized key
                const keyCandidates = [baseName];
                // also check raw keys that may equal original names
                for (const k of Object.keys(manifest.explainArgs)) {
                  const kSan = (k || '').toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'unnamed';
                  if (!keyCandidates.includes(kSan) && kSan === baseName) keyCandidates.push(k);
                }
                let args = null;
                for (const kc of keyCandidates) {
                  if (Array.isArray(manifest.explainArgs[kc])) { args = manifest.explainArgs[kc]; break; }
                }
                if (!args) continue; // no samples → skip
                const joined = args.join(', ');
                sql = `EXPLAIN (FORMAT JSON) SELECT * FROM wes_ops.op_${baseName}(${joined})`;
              } else {
                continue; // no samples; skip
              }
              const res = await this.ctx.db?.query?.(options.opsDsn, sql);
              let payload = '';
              if (typeof res === 'string') payload = res;
              else if (res && Array.isArray(res.rows) && res.rows.length) payload = JSON.stringify(res.rows[0], null, 2);
              else payload = JSON.stringify(res ?? {}, null, 2);
              await fs.write(await fs.join(explainDir, `${baseName}.explain.json`), payload + '\n');
            } catch (e) {
              logger.warn({ op: baseName }, 'ops: explain-json skipped: ' + (e?.message || e));
            }
          }
        }
      }
    } catch (e) {
      // Propagate strict failures so the command exits non-zero
      throw e;
    }
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

// Recursively find **/*.op.json (simple suffix match with optional custom glob)
async function findOpFilesRecursive(fs, dir, globPattern) {
  const results = [];
  const isDefault = !globPattern || globPattern === '**/*.op.json';

  async function walk(path) {
    let entries;
    try {
      entries = await fs.readDir?.(path);
    } catch {
      return; // not a directory or adapter lacks readDir
    }
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      const p = e.path || await fs.join(path, e.name);
      const name = e.name || p;
      // Match file
      const isCandidate = isDefault ? name.endsWith('.op.json') : name.includes('.op.json');
      if (isCandidate) results.push(p);
      // Recurse into subdirectories (best-effort): if readDir works on p, it's a dir
      try {
        const sub = await fs.readDir?.(p);
        if (Array.isArray(sub)) await walk(p);
      } catch {}
    }
  }

  await walk(dir);
  // Deduplicate and sort deterministically
  const uniq = Array.from(new Set(results));
  uniq.sort();
  return uniq;
}

// Expand one or more glob patterns relative to base dir using the same walker
async function expandGlobs(fs, baseDir, globs) {
  if (!Array.isArray(globs) || globs.length === 0) return [];
  const files = await findOpFilesRecursive(fs, baseDir, '**/*.op.json');
  const tests = globs.map(g => globToRegExp(g));
  const matched = files.filter(f => tests.some(rx => rx.test(f.replaceAll('\\\\','/'))));
  const uniq = Array.from(new Set(matched));
  uniq.sort();
  return uniq;
}

// Very small glob → RegExp converter for patterns like **/*.op.json, ops/*.json
function globToRegExp(glob) {
  // Normalize path separators to '/'
  const s = String(glob).replaceAll('\\\\','/');
  let rx = '^';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '*') {
      if (s[i+1] === '*') { rx += '.*'; i++; }
      else rx += '[^/]*';
    } else if (ch === '?') {
      rx += '[^/]';
    } else if ('+.^$|()[]{}'.includes(ch)) {
      rx += '\\' + ch;
    } else {
      rx += ch;
    }
  }
  rx += '$';
  return new RegExp(rx);
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
