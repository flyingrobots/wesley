/**
 * Up Command - Bootstrap or migrate dev database
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

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
    const outDir = options.outDir || 'out';
    let dsn = options.dsn || pickDsn(options, env, this.makeLogger(options, { phase: 'up' }));

    if (options.docker) {
      await tryStartDocker(this.ctx, logger);
      dsn = dsn || defaultDsnFor('postgres', env);
    }
    if (!dsn) {
      const e = new Error('No DSN provided. Pass --dsn or set SUPABASE_DB_URL/SUPABASE_POSTGRES_URL.');
      e.code = 'NO_DSN';
      throw e;
    }

    // Parse current schema → IR
    const current = this.ctx.parsers.graphql.parse(schemaContent);

    // Load previous snapshot if any
    let previous = { tables: [] };
    let hadSnapshot = false;
    try {
      const snap = await this.ctx.fs.read('.wesley/snapshot.json');
      previous = JSON.parse(snap);
      hadSnapshot = true;
    } catch {}

    if (!hadSnapshot) {
      // Bootstrap: emit full DDL and apply
      const ddl = (this.ctx.generators?.sql?.emitDDL?.(current)?.files?.[0]?.content) || '';
      if (!ddl) {
        const e = new Error('Could not emit DDL for bootstrap');
        e.code = 'GENERATION_FAILED';
        throw e;
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
      await this.ctx.fs.write('.wesley/snapshot.json', JSON.stringify({ irVersion: '1.0.0', tables: ir.tables }, null, 2));
    } catch {}
  }

  output(obj, options) {
    if (options.json) {
      this.ctx.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    } else if (!options.quiet) {
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

// NOTE: Helpers duplicated from plan/rehearse for now; consider extracting.
function buildAdditivePlan(prev, curr) {
  const pmap = new Map((prev.tables || []).map(t => [t.name, t]));
  const cmap = new Map((curr.tables || []).map(t => [t.name, t]));
  const phases = [ { name: 'expand', steps: [] }, { name: 'validate', steps: [] } ];
  for (const [name, t] of cmap) {
    const old = pmap.get(name);
    if (!old) {
      phases[0].steps.push({ op: 'create_table', table: name });
      for (const idx of t.indexes || []) phases[0].steps.push({ op: 'create_index_concurrently', table: name, columns: idx.columns, using: idx.using, name: idx.name });
      for (const fk of t.foreignKeys || []) { phases[0].steps.push({ op: 'add_fk_not_valid', table: name, column: fk.column, refTable: fk.refTable, refColumn: fk.refColumn }); phases[1].steps.push({ op: 'validate_fk', table: name, column: fk.column }); }
      continue;
    }
    const oldCols = new Set((old.columns || []).map(c => c.name));
    for (const c of t.columns || []) if (!oldCols.has(c.name)) phases[0].steps.push({ op: 'add_column', table: name, column: c.name, type: c.type, nullable: c.nullable, default: c.default });
    const oldIdxSig = new Set((old.indexes || []).map(i => (i.columns||[]).join('|')));
    for (const idx of t.indexes || []) { const sig = (idx.columns||[]).join('|'); if (!oldIdxSig.has(sig)) phases[0].steps.push({ op: 'create_index_concurrently', table: name, columns: idx.columns, using: idx.using, name: idx.name }); }
    const oldFks = new Set((old.foreignKeys||[]).map(f => `${f.column}->${f.refTable}.${f.refColumn}`));
    for (const fk of t.foreignKeys || []) { const key = `${fk.column}->${fk.refTable}.${fk.refColumn}`; if (!oldFks.has(key)) { phases[0].steps.push({ op: 'add_fk_not_valid', table: name, column: fk.column, refTable: fk.refTable, refColumn: fk.refColumn }); phases[1].steps.push({ op: 'validate_fk', table: name, column: fk.column }); } }
  }
  return { phases };
}

function explainPlan(plan) {
  const lines = [];
  const steps = [];
  for (const phase of plan.phases) {
    lines.push(`• ${phase.name}`);
    for (const s of phase.steps) { const lock = lockFor(s); lines.push(`   - ${s.op} on ${s.table}${s.column?'.'+s.column:''} [${lock.name}]`); steps.push({ ...s, lock }); }
  }
  return { lines, steps };
}
function lockFor(step){ switch(step.op){ case 'create_table': return L('ACCESS EXCLUSIVE', true, true); case 'add_column': return step.nullable!==false||step.default?L('SHARE ROW EXCLUSIVE',true,false):L('ACCESS EXCLUSIVE',true,true); case 'create_index_concurrently': return L('SHARE UPDATE EXCLUSIVE',true,false); case 'add_fk_not_valid': return L('SHARE ROW EXCLUSIVE',true,false); case 'validate_fk': return L('SHARE ROW EXCLUSIVE',true,false); default: return L('EXCLUSIVE',true,false);} }
function L(name,blocksWrites,blocksReads){return {name,blocksWrites,blocksReads};}

function emitMigrations(plan) {
  const files = [];
  const expand = [];
  const validate = [];
  const q = (id) => '"' + id.replace(/\"/g, '""') + '"';
  const tname = (n) => n.toLowerCase();
  for (const phase of plan.phases) {
    for (const s of phase.steps) {
      if (s.op === 'create_table') {
        expand.push(`-- create table ${s.table}`);
      }
      if (s.op === 'add_column') {
        const parts = [`ALTER TABLE ${q(tname(s.table))} ADD COLUMN ${q(s.column)} ${s.type}`];
        if (s.nullable === false && s.default) parts.push('DEFAULT ' + s.default);
        expand.push(parts.join(' ') + ';');
      }
      if (s.op === 'create_index_concurrently') {
        const idxName = s.name || `idx_${tname(s.table)}_${(s.columns || []).join('_')}`;
        const using = s.using ? ` USING ${s.using}` : '';
        const cols = (s.columns || []).map((c)=> q(c)).join(', ');
        expand.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${q(idxName)} ON ${q(tname(s.table))}${using} (${cols});`);
      }
      if (s.op === 'add_fk_not_valid') {
        const cname = `fk_${tname(s.table)}_${s.column}`;
        expand.push(`ALTER TABLE ${q(tname(s.table))} ADD CONSTRAINT ${q(cname)} FOREIGN KEY (${q(s.column)}) REFERENCES ${q(tname(s.refTable))} (${q(s.refColumn)}) NOT VALID;`);
      }
      if (s.op === 'validate_fk') {
        const cname = `fk_${tname(s.table)}_${s.column}`;
        validate.push(`ALTER TABLE ${q(tname(s.table))} VALIDATE CONSTRAINT ${q(cname)};`);
      }
    }
  }
  if (expand.length) files.push({ name: '001_expand.sql', content: expand.join('\n') + '\n' });
  if (validate.length) files.push({ name: '002_validate.sql', content: validate.join('\n') + '\n' });
  return files;
}

export default UpCommand;
