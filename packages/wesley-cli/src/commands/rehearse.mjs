/**
 * Rehearse Command - REALM (Shadow) rehearsal
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { buildAdditivePlan, explainPlan, emitMigrations } from './_migration-plan.mjs';
import { assertValid } from '../framework/schemaValidator.mjs';
import { WesleyError } from '@wesley/core';
import { resolveRunMetadata } from '../utils/run-metadata.mjs';
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
  isInjectedCrash,
  emitTaskCompleted,
  emitTaskFailed,
  emitTaskStarted
} from '../utils/runtime-events.mjs';
import {
  buildRealmProjection,
  readSnapshotProjection,
  REALM_PROJECTION_PATH,
  writeRealmProjection
} from '../utils/runtime-projections.mjs';

export class RehearseCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'rehearse', 'Rehearse plan on a shadow database (REALM)');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--dsn <url>', 'Database DSN for rehearsal')
      .option('--provider <name>', 'realm provider: postgres|supabase')
      .option('--docker', 'Attempt to start docker compose service postgres')
      .option('--dry-run', 'Explain without executing')
      .option('--keep', 'Keep temporary schema for inspection')
      .option('--timeout <ms>', 'Timeout in ms', '300000')
      .option('--transmutation <name>', 'Transmutation to associate with this rehearsal', 'legacy-supabase')
      .option('--run-id <id>', 'Associate this rehearsal with a specific run ID')
      .option('--json', 'Emit JSON');
  }

  async executeCore({ options, schemaContent, schemaPath, logger }) {
    const run = resolveRunMetadata(options);
    const eventCollector = createCommandEventCollector(this.ctx, run);
    const scope = createCommandEventScope(run, 'rehearse');
    emitRunRequested(eventCollector, scope, {
      command: 'rehearse',
      schemaPath,
      dryRun: Boolean(options.dryRun)
    });
    const ir = this.ctx.parsers.graphql.parse(schemaContent);
    emitIrParsed(eventCollector, scope, {
      tableCount: Array.isArray(ir?.tables) ? ir.tables.length : 0
    });

    let previous = { tables: [] };
    let hadSnapshot = false;
    try {
      const snapshot = await readSnapshotProjection(this.ctx.fs);
      if (snapshot) {
        previous = snapshot;
        hadSnapshot = true;
      }
    } catch (e) {
      if (e?.code !== 'ENOENT' && e?.code !== 'ERR_MODULE_NOT_FOUND') {
        logger.warn('Could not read snapshot: ' + (e?.message || ''));
      }
    }
    emitSourcesResolved(eventCollector, scope, {
      schemaPath,
      hadSnapshot
    });

    const plan = buildAdditivePlan(previous, ir);
    const explain = explainPlan(plan);
    emitPlanBuilt(eventCollector, scope, {
      phaseCount: plan.phases.length,
      stepCount: explain.steps.length
    });

    if (options.dryRun) {
      if (options.json) {
        emitRunCompleted(eventCollector, scope, {
          command: 'rehearse',
          dryRun: true,
          stepCount: explain.steps.length
        });
        const report = {
          transmutation: run.transmutation,
          runId: run.runId,
          run: buildCommandRunReport(eventCollector, run),
          plan,
          explain,
          mapping: [],
          radar: { lines: [], counts: {} },
          events: eventCollector.events
        };
        await assertValid(this.ctx, 'plan-report.schema.json', report, 'Dry-run plan');
        this.ctx.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return;
      } else {
        logger.info('🧭 REALM Dry Run');
        for (const line of explain.lines) logger.info(line);
      }
      emitRunCompleted(eventCollector, scope, {
        command: 'rehearse',
        dryRun: true,
        stepCount: explain.steps.length
      });
      return {
        dryRun: true,
        steps: explain.steps.length,
        events: eventCollector.events,
        run: buildCommandRunReport(eventCollector, run)
      };
    }

    const provider = (options.provider || this.ctx?.config?.realm?.provider || 'postgres').toLowerCase();
    const env = this.ctx.env || {};
    let dsn = options.dsn || this.ctx?.config?.realm?.dsn || defaultDsnFor(provider, env);

    if (options.docker && provider === 'postgres') {
      await tryStartDocker(this.ctx, logger);
      // assume default DSN if not provided
      dsn = dsn || defaultDsnFor('postgres', env);
    }

    // Optional provider hooks from config
    const hooks = this.ctx?.config?.realm?.hooks || {};
    if (hooks.preUp) await runHook(this.ctx, hooks.preUp, logger);

    if (!dsn) {
      emitRunFailed(eventCollector, scope, {
        command: 'rehearse',
        code: 'NO_DSN',
        message: 'No DSN provided for rehearsal. Pass --dsn or configure realm.dsn.'
      });
      const error = new WesleyError('NO_DSN', 'No DSN provided for rehearsal. Pass --dsn or configure realm.dsn.');
      throw attachRunFailure(error, eventCollector, run);
    }

    const start = Date.now();
    const taskId = `${run.transmutation}:rehearse:apply`;
    emitTaskStarted(eventCollector, taskId, {
      taskId,
      provider
    });
    try {
      const files = emitMigrations(plan);
      for (const f of files) {
        await execSql(this.ctx.db, dsn, f.content);
      }
      // Simple health probe: select from each table
      for (const t of ir.tables || []) {
        await execSql(this.ctx.db, dsn, `SELECT 1 FROM "${t.name.toLowerCase().replace(/"/g, '""')}" LIMIT 1;`).catch(()=>{});
      }
      const realm = buildRealmProjection({
        transmutation: run.transmutation,
        runId: run.runId,
        provider,
        verdict: 'PASS',
        durationMs: Date.now() - start,
        steps: explain.steps.length,
        timestamp: new Date().toISOString()
      });
      emitTaskCompleted(eventCollector, taskId, {
        taskId,
        provider,
        stepCount: explain.steps.length,
        durationMs: Date.now() - start
      });
      await writeRealmProjection(this.ctx.fs, realm, REALM_PROJECTION_PATH);
      emitArtifactsMaterialized(eventCollector, scope, {
        artifactCount: 1,
        path: REALM_PROJECTION_PATH
      });
      emitRunCompleted(eventCollector, scope, {
        command: 'rehearse',
        verdict: realm.verdict,
        stepCount: explain.steps.length
      });
      const realmReport = {
        ...realm,
        events: eventCollector.events,
        run: buildCommandRunReport(eventCollector, run)
      };
      if (!options.json) logger.info('🕶️ REALM verdict: PASS');
      if (hooks.postDown) await runHook(this.ctx, hooks.postDown, logger);
      if (options.json) {
        await assertValid(this.ctx, 'realm.schema.json', realmReport, 'REALM report');
        this.ctx.stdout.write(JSON.stringify(realmReport, null, 2) + '\n');
        return;
      }
      return realmReport;
    } catch (error) {
      if (isInjectedCrash(error)) {
        throw attachRunFailure(error, eventCollector, run);
      }
      const realm = buildRealmProjection({
        transmutation: run.transmutation,
        runId: run.runId,
        provider,
        verdict: 'FAIL',
        durationMs: Date.now() - start,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      emitTaskFailed(eventCollector, taskId, {
        taskId,
        provider,
        errorCode: error.code || 'REALM_FAILED',
        errorMessage: error.message,
        durationMs: Date.now() - start
      });
      await writeRealmProjection(this.ctx.fs, realm, REALM_PROJECTION_PATH);
      emitArtifactsMaterialized(eventCollector, scope, {
        artifactCount: 1,
        path: REALM_PROJECTION_PATH
      });
      emitRunFailed(eventCollector, scope, {
        command: 'rehearse',
        verdict: realm.verdict,
        code: error.code || 'REALM_FAILED',
        message: error.message
      });
      const realmReport = {
        ...realm,
        events: eventCollector.events,
        run: buildCommandRunReport(eventCollector, run)
      };
      if (!options.json) logger.error('🕶️ REALM verdict: FAIL - ' + error.message);
      if (hooks.postDown) try { await runHook(this.ctx, hooks.postDown, logger); } catch (e) { logger.debug?.('postDown hook failed: ' + e?.message); }
      if (options.json) {
        try { await assertValid(this.ctx, 'realm.schema.json', realmReport, 'REALM report'); } catch (ve) { logger.warn('REALM validation failed in error path: ' + (ve?.message || ve)); }
        this.ctx.stdout.write(JSON.stringify(realmReport, null, 2) + '\n');
      }
      const wrapped = new WesleyError('REALM_FAILED', 'REALM rehearsal failed: ' + error.message, {}, error);
      throw attachRunFailure(wrapped, eventCollector, run);
    }
  }
}

function defaultDsnFor(provider, env) {
  if (provider === 'supabase') return env.SUPABASE_DB_URL || env.SUPABASE_POSTGRES_URL || null;
  return 'postgres://wesley:wesley_test@localhost:5432/wesley_test';
}

async function tryStartDocker(ctx, logger) {
  try {
    await ctx.shell.exec('docker compose up -d postgres', { inheritStdio: true });
  } catch (e) {
    logger.warn('Could not start docker compose postgres: ' + (e?.message || e));
  }
}

async function runHook(ctx, cmd, logger) {
  try {
    logger.info(`🔧 realm hook: ${cmd}`);
    await ctx.shell.exec(cmd, { inheritStdio: true });
  } catch (e) {
    logger.warn('realm hook failed: ' + (e?.message || e));
  }
}

async function execSql(db, dsn, sql) {
  // naive split not used; rely on pg handling multiple statements
  return db.query(dsn, sql);
}
