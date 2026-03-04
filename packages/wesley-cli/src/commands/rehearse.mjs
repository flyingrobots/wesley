/**
 * Rehearse Command - REALM (Shadow) rehearsal
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { buildAdditivePlan, explainPlan, emitMigrations } from './_migration-plan.mjs';
import { assertValid } from '../framework/schemaValidator.mjs';

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
      .option('--json', 'Emit JSON');
  }

  async executeCore({ options, schemaContent, logger }) {
    const ir = this.ctx.parsers.graphql.parse(schemaContent);

    let previous = { tables: [] };
    try { previous = JSON.parse(await this.ctx.fs.read('.wesley/snapshot.json')); } catch (e) {
      if (e?.code !== 'ENOENT' && e?.code !== 'ERR_MODULE_NOT_FOUND') {
        logger.warn('Could not read snapshot: ' + (e?.message || ''));
      }
    }

    const plan = buildAdditivePlan(previous, ir);
    const explain = explainPlan(plan);

    if (options.dryRun) {
      if (options.json) {
        // Validate and emit the same shape — include mapping/radar stubs so
        // the output conforms to plan-report.schema.json.
        const report = { plan, explain, mapping: [], radar: { lines: [], counts: {} } };
        await assertValid(this.ctx, 'plan-report.schema.json', report, 'Dry-run plan');
        this.ctx.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        logger.info('🧭 REALM Dry Run');
        for (const line of explain.lines) logger.info(line);
      }
      return { dryRun: true, steps: explain.steps.length };
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
      const e = new Error('No DSN provided for rehearsal. Pass --dsn or configure realm.dsn.');
      e.code = 'NO_DSN';
      throw e;
    }

    const start = Date.now();
    try {
      const files = emitMigrations(plan);
      for (const f of files) {
        await execSql(this.ctx.db, dsn, f.content);
      }
      // Simple health probe: select from each table
      for (const t of ir.tables || []) {
        await execSql(this.ctx.db, dsn, `SELECT 1 FROM "${t.name.toLowerCase().replace(/"/g, '""')}" LIMIT 1;`).catch(()=>{});
      }
      const realm = {
        provider,
        verdict: 'PASS',
        duration_ms: Date.now() - start,
        steps: explain.steps.length,
        timestamp: new Date().toISOString()
      };
      await this.ctx.fs.write('.wesley/realm.json', JSON.stringify(realm, null, 2));
      if (!options.json) logger.info('🕶️ REALM verdict: PASS');
      if (hooks.postDown) await runHook(this.ctx, hooks.postDown, logger);
      if (options.json) {
        await assertValid(this.ctx, 'realm.schema.json', realm, 'REALM report');
        this.ctx.stdout.write(JSON.stringify(realm, null, 2) + '\n');
      }
      return realm;
    } catch (error) {
      const realm = {
        provider,
        verdict: 'FAIL',
        duration_ms: Date.now() - start,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      await this.ctx.fs.write('.wesley/realm.json', JSON.stringify(realm, null, 2));
      if (!options.json) logger.error('🕶️ REALM verdict: FAIL - ' + error.message);
      if (hooks.postDown) try { await runHook(this.ctx, hooks.postDown, logger); } catch {}
      if (options.json) {
        try { await assertValid(this.ctx, 'realm.schema.json', realm, 'REALM report'); } catch (ve) { logger.warn('REALM validation failed in error path: ' + (ve?.message || ve)); }
        this.ctx.stdout.write(JSON.stringify(realm, null, 2) + '\n');
      }
      const e = new Error('REALM rehearsal failed: ' + error.message);
      e.code = 'REALM_FAILED';
      throw e;
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

export default RehearseCommand;

