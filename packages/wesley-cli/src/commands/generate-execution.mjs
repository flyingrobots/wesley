import { filterIRByUnits } from '@wesley/core/domain/SchemaFilter';
import {
  GENERATED_BUNDLE_PATH,
  GENERATED_HISTORY_PATH,
  GENERATED_SCORES_PATH,
  TransmutationRunner,
  WesleyError,
  createGeneratedArtifactResolver,
  createRunId,
  enrichBundleWithEvidenceTruth,
  generatedArtifactPathCandidates
} from '@wesley/core';
import {
  LEGACY_SUPABASE_TRANSMUTATION,
  LegacySupabaseGeneratorPlugin,
  flattenTransmutationArtifacts
} from '../transmutations/legacy-supabase.mjs';
import { writeSnapshotProjection } from '../utils/runtime-projections.mjs';
import {
  attachRunFailure,
  createCommandEventCollector,
  createCommandEventScope,
  buildCommandRunReport,
  emitArtifactsMaterialized,
  emitIrParsed,
  emitRunCompleted,
  emitRunFailed,
  emitRunRequested,
  emitSourcesResolved,
  isInjectedCrash
} from '../utils/runtime-events.mjs';
import { applyResumeMetadata } from '../utils/runtime-resume.mjs';

export async function ensureGeneratePreconditions({ env, options, shell }) {
  if (shouldEnforceClean(env, options) && !options.allowDirty) {
    await assertCleanGit(shell);
  }
}

export async function runSequentialGeneration({ ctx, context, compileOpsIfRequested }) {
  const { schemaContent, schemaPath, options, logger } = context;
  const debugDump = options.printComposedSdl || options.printIr;
  const { writer } = ctx;
  const commandName = options.commandName || 'generate';
  const transmutation = options.transmutation || LEGACY_SUPABASE_TRANSMUTATION;
  const runId = typeof options.runId === 'string' && options.runId.trim()
    ? options.runId.trim()
    : createRunId();
  const run = { runId, transmutation };
  const scope = createCommandEventScope(run, commandName);
  const eventCollector = createCommandEventCollector(ctx, run);

  emitRunRequested(eventCollector, scope, {
    command: commandName,
    schemaPath,
    outDir: options.outDir,
    dryRun: Boolean(options.dryRun)
  });
  emitSourcesResolved(eventCollector, scope, {
    schemaPath,
    composed: Boolean(context.units),
    unitCount: context.units?.length ?? 1
  });

  if (options.printComposedSdl) {
    if (!context.units) {
      ctx.stderr.write('Warning: No composition directives found; printing raw schema.\n');
    }
    const sdl = context.units
      ? context.units.map(u => u.sdl).join('\n\n')
      : schemaContent;
    ctx.stdout.write(sdl + '\n');
    if (options.dryRun) {
      emitRunCompleted(eventCollector, scope, {
        artifactCount: 0,
        dryRun: true
      });
      return applyResumeMetadata({
        transmutation,
        runId,
        artifacts: 0,
        dryRun: true,
        events: eventCollector.events,
        run: buildCommandRunReport(eventCollector, run)
      }, context.resumeState);
    }
  }

  let ir = context.units
    ? ctx.parsers.graphql.parseComposed(context.units)
    : ctx.parsers.graphql.parse(schemaContent, { filename: schemaPath });

  const unitFilter = options.unit
    ? options.unit.flatMap(u => u.split(',')).map(s => s.trim()).filter(Boolean)
    : null;
  if (unitFilter) {
    ir = filterIRByUnits(ir, unitFilter);
  }
  emitIrParsed(eventCollector, scope, {
    tableCount: Array.isArray(ir?.tables) ? ir.tables.length : 0,
    unitFilterCount: unitFilter?.length ?? 0
  });

  if (options.printIr) {
    ctx.stdout.write(JSON.stringify(ir, (key, val) => {
      if (key === 'content' && typeof val === 'string' && val.length > 200) {
        return `<${val.length} bytes>`;
      }
      return val;
    }, 2) + '\n');
    if (options.dryRun) {
      emitRunCompleted(eventCollector, scope, {
        artifactCount: 0,
        dryRun: true
      });
      return applyResumeMetadata({
        transmutation,
        runId,
        artifacts: 0,
        dryRun: true,
        events: eventCollector.events,
        run: buildCommandRunReport(eventCollector, run)
      }, context.resumeState);
    }
  }
  try {
    const transmutationResult = await executeLegacySupabaseTransmutation({ ctx, context, ir, runId, eventCollector });
    const artifacts = flattenTransmutationArtifacts(transmutationResult);

    if (!options.dryRun && writer?.writeFiles) {
      await writer.writeFiles(artifacts, options.outDir);
      emitArtifactsMaterialized(eventCollector, scope, {
        artifactCount: artifacts.length,
        outDir: options.outDir
      });
    }

    await persistSnapshot({ ctx, ir, logger, dryRun: options.dryRun });
    await persistTransmutationArtifacts({
      ctx,
      transmutationResult,
      artifacts,
      outDir: options.outDir,
      logger,
      options
    });

    if (!options.dryRun) {
      context.ir = ir;
      context.transmutationRun = transmutationResult;
      await compileOpsIfRequested({ ctx, context });
    }

    emitRunCompleted(eventCollector, scope, {
      artifactCount: artifacts.length,
      dryRun: Boolean(options.dryRun)
    });

    if (!options.quiet && !options.json && !debugDump) {
      const action = options.dryRun ? 'Would generate' : 'Generated';
      logger.info('');
      logger.info(`${action}:`);
      for (const file of artifacts) {
        logger.info(`  ${file.name}`);
      }
      logger.info('');
    }

    return applyResumeMetadata({
      transmutation: transmutationResult.transmutation,
      runId: transmutationResult.runId,
      artifacts: artifacts.length,
      outDir: options.outDir,
      dryRun: options.dryRun || false,
      events: eventCollector.events,
      run: buildCommandRunReport(eventCollector, run)
    }, context.resumeState);
  } catch (error) {
    if (isInjectedCrash(error)) {
      throw attachRunFailure(error, eventCollector, run);
    }
    emitRunFailed(eventCollector, scope, {
      code: error.code || 'GENERATION_FAILED',
      message: error.message
    });
    throw attachRunFailure(error, eventCollector, run);
  }
}

export async function runTasksAndSlapsGeneration({ ctx, context, compileOpsIfRequested }) {
  const { schemaContent, options, logger } = context;
  const { planner, runner, generators, writer } = ctx;

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
    if (!node.needs) continue;
    for (const dep of node.needs) {
      edges.push([dep, node.id]);
    }
  }

  const plan = planner.buildPlan(nodes, edges, { versions: {} });

  if (options.showPlan) {
    logger.info({ plan }, 'Execution plan:');
  }

  const handlers = {
    parse_schema: async (n) => ({ ir: ctx.parsers.graphql.parse(n.args.sdl) }),
    validate_ir: async (_n, deps) => ({ ir: deps.parse.ir }),
    emit_ddl: async (_n, deps) => generators.sql.emitDDL(deps.validate.ir),
    emit_rls: async (_n, deps) => generators.sql.emitRLS(deps.validate.ir),
    emit_tests: async (_n, deps) => generators.tests.emitPgTap(deps.validate.ir),
    write_files: async (n, deps) => {
      const artifacts = [
        ...(deps.gen_ddl?.files || []),
        ...(deps.gen_rls?.files || []),
        ...(deps.gen_tests?.files || [])
      ];
      return writer.writeFiles(artifacts, n.args.out);
    }
  };

  const result = await runner.run(plan, { handlers, logger });

  await compileOpsIfRequested({ ctx, context });

  if (!options.quiet && !options.json) {
    logger.info('✨ Generation complete!');
  }

  return result;
}

async function persistSnapshot({ ctx, ir, logger, dryRun }) {
  if (dryRun) return;
  try {
    if (ctx.fs && ir?.tables) {
      await writeSnapshotProjection(ctx.fs, ir);
    }
  } catch (e) {
    logger.warn('Could not write IR snapshot: ' + (e?.message || e));
  }
}

async function executeLegacySupabaseTransmutation({ ctx, context, ir, runId, eventCollector }) {
  const { logger, options } = context;
  const requestedTransmutation = options.transmutation || LEGACY_SUPABASE_TRANSMUTATION;
  if (requestedTransmutation !== LEGACY_SUPABASE_TRANSMUTATION) {
    throw new WesleyError(
      'UNKNOWN_TRANSMUTATION',
      `The current sequential runtime only supports transmutation "${LEGACY_SUPABASE_TRANSMUTATION}", got "${requestedTransmutation}".`
    );
  }
  const plugin = new LegacySupabaseGeneratorPlugin({
    generators: ctx.generators,
    enableRls: options.supabase
  });
  const runner = new TransmutationRunner({
    logger,
    clock: createRunnerClock(ctx.clock),
    config: {
      paths: {
        ...(ctx.config?.paths || {}),
        outputDir: options.outDir
      },
      transmutation: {
        name: LEGACY_SUPABASE_TRANSMUTATION,
        supabase: Boolean(options.supabase)
      }
    }
  });

  if (options.showPlan) {
    const plan = runner.buildTaskGraph(LEGACY_SUPABASE_TRANSMUTATION, [plugin]);
    logger.info({ transmutation: LEGACY_SUPABASE_TRANSMUTATION, plan }, 'Execution plan:');
  }

  const schema = {
    sdl: context.schemaContent,
    ir,
    outputDir: options.outDir
  };
  const sourceSha = await resolveSourceSha(ctx, logger);

  const result = await runner.run(
    LEGACY_SUPABASE_TRANSMUTATION,
    [plugin],
    schema,
    {
      runId,
      eventCollector,
      sha: sourceSha,
      scoring: legacySupabaseScoringOptions()
    }
  );

  if (!result.success) {
    throw transmutationFailure(result);
  }

  return result;
}

function createRunnerClock(clock) {
  return {
    now() {
      const value = typeof clock?.now === 'function' ? clock.now() : new Date().toISOString();
      if (typeof value === 'string') return value;
      if (value && typeof value.toISOString === 'function') return value.toISOString();
      return new Date().toISOString();
    }
  };
}

function transmutationFailure(result) {
  const failed = result?.results?.find(entry => entry.status === 'error');
  if (!failed) {
    return new WesleyError('GENERATION_FAILED', `Transmutation "${result?.transmutation || LEGACY_SUPABASE_TRANSMUTATION}" failed`);
  }

  return new WesleyError(
    failed.errorCode || 'GENERATION_FAILED',
    `Transmutation "${result.transmutation}" failed in plugin "${failed.name}" during ${failed.phase}: ${failed.errorMessage}`
  );
}

function legacySupabaseScoringOptions() {
  return {
    scs: {
      artifactGroups: {
        sql: ['sql'],
        tests: ['test']
      },
      rollupGroups: ['sql']
    }
  };
}

async function resolveSourceSha(ctx, logger) {
  let sha = 'unknown';
  const envSha = (ctx.env || {}).GITHUB_SHA || '';
  try {
    const out = await ctx.shell?.exec?.('git rev-parse HEAD');
    const value = out?.stdout?.trim();
    if (value) return value;
    if (envSha) return envSha;
  } catch (error) {
    logger.debug?.({ err: error }, 'Could not resolve git SHA for transmutation bundle; falling back to env/unknown.');
  }
  if (envSha) sha = envSha;
  return sha;
}

async function persistTransmutationArtifacts({ ctx, transmutationResult, artifacts, outDir, logger, options }) {
  if (!options.emitBundle || options.dryRun) return;
  try {
    const { bundle, scores, evidenceTrust } = enrichBundleWithEvidenceTruth({
      bundle: transmutationResult.bundle,
      scores: transmutationResult.scores,
      artifacts,
      outDir,
      resolver: createGeneratedArtifactResolver(artifacts, outDir)
    });
    transmutationResult.scores = scores;
    transmutationResult.bundle = bundle;
    await ctx.fs.write(GENERATED_SCORES_PATH, JSON.stringify(scores, null, 2));
    await ctx.fs.write(GENERATED_BUNDLE_PATH, JSON.stringify(bundle, null, 2));

    try {
      const ctxEnv = ctx.env || {};
      const history = await loadMoriartyHistory({
        fs: ctx.fs,
        shell: ctx.shell,
        logger,
        defaultBase:
          ctxEnv.WESLEY_BASE_REF ||
          ctxEnv.GITHUB_BASE_REF ||
          ctxEnv.WESLEY_DEFAULT_BRANCH ||
          ctxEnv.GITHUB_DEFAULT_BRANCH ||
          'main'
      });
      const day = Math.floor(Date.now() / 86400000);
      const nextPoints = mergeHistoryPoints(history.points, [{
        day,
        timestamp: bundle.timestamp || scores.timestamp || new Date().toISOString(),
        scs: scores.scores?.scs ?? 0,
        tci: scores.scores?.tci ?? 0,
        mri: scores.scores?.mri ?? 0,
        evidenceTrust: evidenceTrust.level,
        evidenceTrustReasons: evidenceTrust.reasons
      }]);
      await ctx.fs.write(GENERATED_HISTORY_PATH, JSON.stringify({ points: nextPoints }, null, 2));
    } catch (error) {
      logger.debug?.({ err: error }, 'Could not refresh Moriarty history while persisting the transmutation bundle.');
    }
  } catch (e) {
    logger.warn('Could not emit HOLMES evidence bundle: ' + (e?.message || e));
  }
}

function shouldEnforceClean(env, options) {
  const policy = (env?.WESLEY_GIT_POLICY || 'emit').toLowerCase();
  if (policy === 'off') return false;
  if (policy === 'strict') return true;
  return !!options.emitBundle;
}

async function assertCleanGit(shell) {
  try {
    const result = shell?.exec
      ? await shell.exec('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
      : shell?.execSync?.('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    if (!result && !shell?.exec && !shell?.execSync) return;
  } catch {
    return;
  }
  const out = (await shell?.exec?.('git status --porcelain'))?.stdout?.trim?.() || '';
  if (out.length > 0) {
    throw new WesleyError('DIRTY_WORKTREE', 'Working tree has uncommitted changes. Commit or stash before running, or pass --allow-dirty.');
  }
}

async function loadMoriartyHistory({ fs, shell, defaultBase, logger: log }) {
  const warn = log?.warn ? log.warn.bind(log) : () => {};
  let points = [];
  try {
    for (const candidate of generatedArtifactPathCandidates(GENERATED_HISTORY_PATH)) {
      try {
        const raw = await fs.read(candidate);
        const parsed = JSON.parse(String(raw));
        if (Array.isArray(parsed?.points)) {
          points = mergeHistoryPoints(points, parsed.points);
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    warn('[Moriarty] Unable to read local history: ' + (err?.message || ''));
  }

  const gitShell = shell?.exec ? shell : null;
  if (!gitShell) return { points };

  try {
    const inside = await gitShell.exec('git rev-parse --is-inside-work-tree');
    if (!inside?.stdout?.trim()) return { points };
  } catch (err) {
    warn('[Moriarty] Git repo check failed: ' + (err?.message || ''));
    return { points };
  }

  let mergeBase;
  const fallbackBase = defaultBase || 'main';
  try {
    const mb = await gitShell.exec(`git merge-base HEAD ${fallbackBase}`);
    mergeBase = mb?.stdout?.trim();
  } catch (err) {
    warn('[Moriarty] merge-base lookup failed: ' + (err?.message || ''));
    return { points };
  }
  if (!mergeBase) return { points };

  try {
    for (const candidate of generatedArtifactPathCandidates(GENERATED_HISTORY_PATH)) {
      try {
        const show = await gitShell.exec(`git show ${mergeBase}:${candidate}`);
        if (show?.stdout) {
          const parsed = JSON.parse(show.stdout);
          if (Array.isArray(parsed?.points)) {
            points = mergeHistoryPoints(parsed.points, points);
            break;
          }
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    warn('[Moriarty] No history at merge-base: ' + (err?.message || ''));
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
