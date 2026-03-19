/**
 * Up Command - Bootstrap or migrate dev database
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError } from '@wesley/core';
import { buildAdditivePlan, explainPlan, emitMigrations } from './_migration-plan.mjs';
import {
  readSnapshotProjection,
  writeSnapshotProjection
} from '../utils/runtime-projections.mjs';

export class UpCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'up', 'Bootstrap or migrate the dev database');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin (alias for --schema -)')
      .option('--dsn <url>', 'Database DSN for dev environment')
      .option('--provider <name>', 'DB provider: postgres|supabase')
      .option('--docker', 'Attempt to start docker compose service postgres')
      .option('--out-dir <dir>', 'Output directory (for schema.sql)', 'out')
      .option('--dry-run', 'Explain without executing')
      .option('--json', 'Emit JSON');
  }

  async executeCore({ options, schemaContent, logger }) {
    const env = this.ctx.env || {};
    let dsn = options.dsn || pickDsn(options, env, this.makeLogger(options, { phase: 'up' }));

    if (options.docker) {
      await tryStartDocker(this.ctx, logger);
      dsn = dsn || defaultDsnFor('postgres', env);
    }
    if (!dsn) {
      throw new WesleyError('NO_DSN', 'No DSN provided. Pass --dsn, --provider, or set SUPABASE_DB_URL/POSTGRES_URL/DATABASE_URL.');
    }

    // Parse current schema → IR
    const current = this.ctx.parsers.graphql.parse(schemaContent);

    // Load previous snapshot if any
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

    if (!hadSnapshot) {
      // Bootstrap: emit full DDL and apply
      const ddl = (this.ctx.generators?.sql?.emitDDL?.(current)?.files?.[0]?.content) || '';
      if (!ddl) {
        throw new WesleyError('GENERATION_FAILED', 'Could not emit DDL for bootstrap');
      }
      if (options.dryRun) {
        return this.output({ mode: 'bootstrap', statements: 1 }, options);
      }
      await execSql(this.ctx.db, dsn, ddl);
      await this.writeSnapshot(current);
      const res = { mode: 'bootstrap', ok: true };
      return this.output(res, options);
    }

    // Migration path
    const plan = buildAdditivePlan(previous, current);
    const explain = explainPlan(plan);

    if (options.dryRun) {
      return this.output({ mode: 'migrate', steps: explain.steps.length, plan, explain }, options);
    }

    const files = emitMigrations(plan);
    for (const f of files) {
      await execSql(this.ctx.db, dsn, f.content);
    }
    await this.writeSnapshot(current);
    const res = { mode: 'migrate', ok: true, steps: explain.steps.length };
    return this.output(res, options);
  }

  async writeSnapshot(ir) {
    try {
      await writeSnapshotProjection(this.ctx.fs, ir);
    } catch { /* empty */ }
  }

  output(obj, options) {
    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(obj, null, 2) + '\n');
      return;
    }
    if (!options.quiet) {
      const logger = this.makeLogger(options, { phase: 'up' });
      if (obj.mode === 'bootstrap') logger.info('🚀 Bootstrapped dev database');
      if (obj.mode === 'migrate') logger.info(`🚀 Applied ${obj.steps} migration step(s)`);
    }
    return obj;
  }
}

function defaultDsnFor(provider, env) {
  if (provider === 'supabase') return env.SUPABASE_DB_URL || env.SUPABASE_POSTGRES_URL || null;
  return 'postgres://wesley:wesley_test@localhost:5432/wesley_test';
}

function pickDsn(options, env, logger) {
  // 1) Explicit --dsn wins
  if (options?.dsn) return options.dsn;

  // 2) Provider hint
  const hinted = (options?.provider || '').toLowerCase();
  const hasSupabase = !!(env.SUPABASE_DB_URL || env.SUPABASE_POSTGRES_URL);
  const hasPostgres = !!(env.POSTGRES_URL || env.DATABASE_URL || env.TEST_DATABASE_URL || env.WESLEY_TEST_DSN);

  if (hinted === 'supabase') {
    return env.SUPABASE_DB_URL || env.SUPABASE_POSTGRES_URL || null;
  }
  if (hinted === 'postgres') {
    return env.POSTGRES_URL || env.DATABASE_URL || env.TEST_DATABASE_URL || env.WESLEY_TEST_DSN || null;
  }

  // 3) Auto-detect
  if (hasSupabase && hasPostgres) {
    // Prefer Supabase if both present, but warn for clarity
    logger?.warn?.('Both SUPABASE_* and POSTGRES/DATABASE_URL present; defaulting to SUPABASE_*. Use --provider to disambiguate or --dsn to override.');
    return env.SUPABASE_DB_URL || env.SUPABASE_POSTGRES_URL;
  }
  if (hasSupabase) {
    return env.SUPABASE_DB_URL || env.SUPABASE_POSTGRES_URL;
  }
  if (hasPostgres) {
    return env.POSTGRES_URL || env.DATABASE_URL || env.TEST_DATABASE_URL || env.WESLEY_TEST_DSN;
  }

  // 4) Fallback to local default
  return defaultDsnFor('postgres', env);
}

async function tryStartDocker(ctx, logger) {
  try {
    const fs = ctx.fs;
    const hasCompose = await fs.exists('docker-compose.yml') || await fs.exists('compose.yaml');
    if (!hasCompose) {
      logger?.warn?.('No docker-compose file found in current directory; skipping --docker');
      return;
    }
    await ctx.shell.exec('docker compose up -d postgres');
    logger?.info?.('Started docker compose service: postgres');
  } catch (e) {
    logger?.warn?.('Could not start docker compose postgres: ' + (e?.message || e));
  }
}

async function execSql(db, dsn, sql) {
  return db.query(dsn, sql);
}
