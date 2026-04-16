/**
 * Plan Command - Explain phased migration plan
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { buildOutputPathMap, resolveFilePath } from '../utils/output-paths.mjs';
import { buildAdditivePlan, explainPlan, emitMigrations } from './_migration-plan.mjs';
import { assertValid } from '../framework/schemaValidator.mjs';
import { WesleyError } from '@wesley/core';
import { formatTransmutationChoices, getDefaultTransmutationName } from '../transmutations/registry.mjs';
import { resolveRunMetadata } from '../utils/run-metadata.mjs';
import { resolveSchemaIr } from '../utils/schema-ir-cache.mjs';
import {
  applyResumeMetadata,
  assertResumeRequestedRunId,
  buildShortCircuitedResumeResult,
  resolveResumeState
} from '../utils/runtime-resume.mjs';
import {
  attachRunFailure,
  buildCommandRunReport,
  createCommandEventCollector,
  createCommandEventScope,
  emitArtifactsMaterialized,
  emitIrParsed,
  emitPlanBuilt,
  emitRunCompleted,
  emitRunFailed,
  emitRunRequested,
  emitSourcesResolved,
  isInjectedCrash
} from '../utils/runtime-events.mjs';
import { buildGitDiscoveryEnv } from '../utils/git-env.mjs';

export class PlanCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'plan', 'Plan phased migrations and explain lock impact');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--out-dir <dir>', 'Output directory for migrations', 'out')
      .option('--explain', 'Show plan explanation')
      .option('--radar', 'Show lock radar summary')
      .option('--map', 'Show mapping from GraphQL/IR changes to migration steps')
      .option('--allow-dirty', 'Allow running with a dirty git working tree (not recommended)')
      .option('--transmutation <name>', `Transmutation to associate with this plan (${formatTransmutationChoices()})`, getDefaultTransmutationName())
      .option('--run-id <id>', 'Associate this plan with a specific run ID')
      .option('--resume', 'Resume a previously started plan run with the same transmutation and run ID')
      .option('--write', 'Write migration files to out-dir/migrations')
      .option('--json', 'Emit JSON plan');
  }

  async executeCore(context) {
    const { options, schemaContent, schemaPath, logger } = context;
    assertResumeRequestedRunId(options);
    const run = resolveRunMetadata(options);
    const resumeState = options.resume
      ? resolveResumeState(this.ctx?.eventStore, { ...run, command: 'plan' })
      : null;
    if (resumeState?.shortCircuited) {
      return buildShortCircuitedResumeResult(resumeState);
    }
    if (resumeState) {
      context.resumeState = resumeState;
    }
    const eventCollector = createCommandEventCollector(this.ctx, run);
    const scope = createCommandEventScope(run, 'plan');
    const configPaths = this.ctx?.config?.paths || {};
    const baseOutDir = options.outDir || configPaths.output || 'out';
    const outputPaths = buildOutputPathMap(configPaths, baseOutDir);
    options.outDir = outputPaths.baseDir;
    emitRunRequested(eventCollector, scope, {
      command: 'plan',
      schemaPath,
      outDir: options.outDir,
      write: Boolean(options.write)
    });

    // Enforce clean tree only in strict policy; default: allow
    const env = this.ctx.env || {};
    if (shouldEnforceCleanPlan(env) && !options.allowDirty) {
      await assertCleanGit(this.ctx.shell);
    }

    try {
      const currentResolution = await resolveSchemaIr({
        ctx: this.ctx,
        schemaContent,
        schemaPath,
        units: context.units,
        logger
      });
      const current = currentResolution.ir;
      emitIrParsed(eventCollector, scope, {
        tableCount: Array.isArray(current?.tables) ? current.tables.length : 0,
        cacheStatus: currentResolution.cacheStatus
      });

      let previous = { tables: [] };
      let hadSnapshot = false;
      try {
        const snapshotPath = resolveFilePath(outputPaths.bundleDir, 'snapshot.json');
        const snap = await this.ctx.fs.read(snapshotPath);
        previous = JSON.parse(snap);
        hadSnapshot = true;
      } catch (e) {
        if (e?.code !== 'ENOENT' && e?.code !== 'ERR_MODULE_NOT_FOUND') {
          logger.warn('Could not read snapshot: ' + (e?.message || ''));
        }
      }
      emitSourcesResolved(eventCollector, scope, {
        schemaPath,
        bundleDir: outputPaths.bundleDir,
        hadSnapshot
      });

      const plan = buildAdditivePlan(previous, current);
      const explain = explainPlan(plan);
      const radar = buildLockRadar(explain, plan);
      const mapping = buildMapping(plan);
      emitPlanBuilt(eventCollector, scope, {
        phaseCount: plan.phases.length,
        stepCount: explain.steps.length
      });

      if (options.json) {
        emitRunCompleted(eventCollector, scope, {
          command: 'plan',
          phaseCount: plan.phases.length,
          stepCount: explain.steps.length
        });
        const report = applyResumeMetadata({
          transmutation: run.transmutation,
          runId: run.runId,
          run: buildCommandRunReport(eventCollector, run),
          plan,
          explain,
          mapping,
          radar,
          events: eventCollector.events
        }, resumeState);
        await assertValid(this.ctx, 'plan-report.schema.json', report, 'Plan report');
        this.ctx.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return;
      }

      if (options.explain) {
        logger.info('🧭 Migration Plan (additive)');
        for (const line of explain.lines) logger.info(line);
      }

      if (options.radar && !options.json) {
        logger.info('');
        logger.info('🔭 Lock Radar');
        for (const line of radar.lines) logger.info(line);
        if (radar.notes?.length) {
          logger.info('Notes:');
          for (const n of radar.notes) logger.info(' - ' + n);
        }
      }

      if (options.map && !options.json) {
        logger.info('');
        logger.info('🔎 Change Mapping (GraphQL/IR → Steps)');
        for (const item of mapping) {
          logger.info(`Δ ${item.change} → ${item.steps.map(s=> s.op + ' ' + s.table + (s.column?'.'+s.column:'' )).join(', ')}`);
        }
      }

      if (options.write) {
        const files = emitMigrations(plan);
        for (const f of files) {
          const targetPath = resolveFilePath(outputPaths.migrationsDir, f.name);
          await this.ctx.fs.write(targetPath, f.content);
        }
        emitArtifactsMaterialized(eventCollector, scope, {
          artifactCount: files.length,
          outDir: outputPaths.migrationsDir
        });
        if (!options.quiet) logger.info(`✍️ Wrote ${files.length} migration file(s) to ${outputPaths.migrationsDir}`);
      }

      emitRunCompleted(eventCollector, scope, {
        command: 'plan',
        phaseCount: plan.phases.length,
        stepCount: explain.steps.length
      });

      return applyResumeMetadata({
        transmutation: run.transmutation,
        runId: run.runId,
        run: buildCommandRunReport(eventCollector, run),
        phases: plan.phases.length,
        steps: explain.steps.length,
        events: eventCollector.events
      }, resumeState);
    } catch (error) {
      if (isInjectedCrash(error)) {
        throw attachRunFailure(error, eventCollector, run);
      }
      emitRunFailed(eventCollector, scope, {
        command: 'plan',
        code: error.code || 'PLAN_FAILED',
        message: error.message
      });
      throw attachRunFailure(error, eventCollector, run);
    }
  }
}

// Build a compact summary of locks and phase impact
function buildLockRadar(explain, plan) {
  const counts = new Map();
  let blocksReads = 0;
  let blocksWrites = 0;
  let accessExclusive = 0;
  let cic = 0;
  let fkNV = 0;
  let fkValidate = 0;
  for (const s of explain.steps) {
    const name = s.lock?.name || 'UNKNOWN';
    counts.set(name, (counts.get(name) || 0) + 1);
    if (s.lock?.blocksReads) blocksReads++;
    if (s.lock?.blocksWrites) blocksWrites++;
    if (name === 'ACCESS EXCLUSIVE') accessExclusive++;
    if (s.op === 'create_index_concurrently') cic++;
    if (s.op === 'add_fk_not_valid') fkNV++;
    if (s.op === 'validate_fk') fkValidate++;
  }
  // Phase summary
  const phaseLines = [];
  for (const ph of plan.phases) {
    const phSteps = ph.steps.length;
    phaseLines.push(`• ${ph.name}: ${phSteps} op(s)`);
  }
  // Order locks by perceived severity then count
  const severity = ['ACCESS EXCLUSIVE', 'EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE ROW EXCLUSIVE', 'SHARE', 'ROW EXCLUSIVE', 'ROW SHARE', 'ACCESS SHARE', 'UNKNOWN'];
  const lockLines = Array.from(counts.entries())
    .sort((a,b)=>{
      const ia = severity.indexOf(a[0]);
      const ib = severity.indexOf(b[0]);
      if (ia !== ib) return ia - ib;
      return b[1] - a[1];
    })
    .map(([k,v]) => `${k}: ${v} ${bar(v)}`);
  const lines = [
    ...lockLines,
    `blocks(writes): ${blocksWrites} | blocks(reads): ${blocksReads}`,
    ...phaseLines
  ];
  const notes = [];
  if (accessExclusive > 0) notes.push('ACCESS EXCLUSIVE detected — review plan.');
  if (cic > 0) notes.push(`${cic} CREATE INDEX CONCURRENTLY`);
  if (fkNV > 0 || fkValidate > 0) notes.push(`${fkNV} FK NOT VALID → ${fkValidate} VALIDATE`);
  return { lines, notes, counts: Object.fromEntries(counts) };
}
function bar(n){
  const max = Math.min(n, 10);
  return max > 0 ? ' ' + '▓'.repeat(max) : '';
}


// Git cleanliness check
function shouldEnforceCleanPlan(env) {
  const policy = (env?.WESLEY_GIT_POLICY || 'emit').toLowerCase();
  return policy === 'strict';
}
async function assertCleanGit(shell) {
  const gitEnv = buildGitDiscoveryEnv();
  if (!shell?.exec) return;
  try {
    await shell.exec('git rev-parse --is-inside-work-tree', { env: gitEnv });
  } catch {
    return;
  }
  const out = (await shell.exec('git status --porcelain', { env: gitEnv }))?.stdout?.trim?.() || '';
  if (out) {
    throw new WesleyError('DIRTY_WORKTREE', 'Working tree has uncommitted changes. Commit or stash before running, or pass --allow-dirty.');
  }
}

function buildMapping(plan) {
  const mapping = [];
  // naive grouping: each create_table represents a table-added change
  for (const ph of plan.phases) {
    for (const s of ph.steps) {
      if (s.op === 'create_table') {
        const steps = [];
        for (const ph2 of plan.phases) {
          for (const s2 of ph2.steps) if (s2.table === s.table) steps.push(s2);
        }
        mapping.push({ change: `type ${s.table} added`, steps });
      }
      if (s.op === 'add_column') {
        mapping.push({ change: `field ${s.table}.${s.column} added`, steps: [s] });
      }
      if (s.op === 'create_index_concurrently') {
        mapping.push({ change: `index on ${s.table}(${(s.columns||[]).join(',')}) added`, steps: [s] });
      }
      if (s.op === 'add_fk_not_valid') {
        mapping.push({ change: `foreign key ${s.table}.${s.column} → ${s.refTable}.${s.refColumn}`, steps: [s] });
      }
    }
  }
  // de-duplicate changes by key
  const seen = new Set();
  const uniq = [];
  for (const m of mapping) {
    if (seen.has(m.change)) continue; seen.add(m.change); uniq.push(m);
  }
  return uniq;
}
