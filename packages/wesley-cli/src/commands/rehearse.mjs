/**
 * Rehearse Command - REALM (Shadow) rehearsal
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

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
      .option('--provider <name>', 'realm provider: postgres|supabase', 'postgres')
      .option('--docker', 'Attempt to start docker compose service postgres')
      .option('--dry-run', 'Explain without executing')
      .option('--timeout <ms>', 'Timeout in ms', '300000')
      .option('--json', 'Emit JSON');
  }

  async executeCore({ options, schemaContent, logger }) {
    const ir = this.ctx.parsers.graphql.parse(schemaContent);

    let previous = { tables: [] };
    try { previous = JSON.parse(await this.ctx.fs.read('.wesley/snapshot.json')); } catch {}

    const plan = buildAdditivePlan(previous, ir);
    const explain = explainPlan(plan);

    if (options.dryRun) {
      if (options.json) {
        this.ctx.stdout.write(JSON.stringify({ plan, explain }, null, 2) + '\n');
      } else {
        logger.info('🧭 REALM Dry Run');
        for (const line of explain.lines) logger.info(line);
      }
      return { dryRun: true, steps: explain.steps.length };
    }

    const provider = (options.provider || 'postgres').toLowerCase();
    const env = this.ctx.env || {};
    let dsn = options.dsn || this.ctx?.config?.realm?.dsn || defaultDsnFor(provider, env);

    if (options.docker && provider === 'postgres') {
      await tryStartDocker(logger);
      // assume default DSN if not provided
      dsn = dsn || defaultDsnFor('postgres', env);
    }

    if (!dsn) {
      const e = new Error('No DSN provided for rehearsal. Pass --dsn or configure realm.dsn.');
      e.code = 'NO_DSN';
      throw e;
    }

    const start = Date.now();
    const keep = (this.ctx.env?.WESLEY_REALM_KEEP === '1') || !!options.keep;
    const tempSchema = `_realm_${Date.now().toString(36)}`;
    const withSearchPath = (sql) => `SET LOCAL search_path TO "${tempSchema}",public;\n${sql}`;
    const execAll = async (sql) => execSql(this.ctx.db, dsn, withSearchPath(sql));
    try {
      // Isolated schema for rehearsal
      await execSql(this.ctx.db, dsn, `CREATE SCHEMA IF NOT EXISTS "${tempSchema}";`);
      // Apply full DDL to temp schema
      const ddl = this.ctx.generators?.sql?.emitDDL?.(ir);
      if (ddl?.files?.length) {
        for (const f of ddl.files) await execAll(f.content);
      }
      // Apply only VALIDATE steps (FK validation)
      const files = emitMigrations(plan).filter(f => f.name.includes('validate'));
      for (const f of files) await execAll(f.content);
      const realm = {
        provider,
        verdict: 'PASS',
        duration_ms: Date.now() - start,
        steps: explain.steps.length,
        timestamp: new Date().toISOString()
      };
      await this.ctx.fs.write('.wesley/realm.json', JSON.stringify(realm, null, 2));
      if (!keep) {
        await execSql(this.ctx.db, dsn, `DROP SCHEMA IF EXISTS "${tempSchema}" CASCADE;`).catch(()=>{});
      }
      if (!options.json) logger.info('🕶️ REALM verdict: PASS');
      if (options.json) this.ctx.stdout.write(JSON.stringify(realm, null, 2) + '\n');
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
      try { await execSql(this.ctx.db, dsn, `DROP SCHEMA IF EXISTS "${tempSchema}" CASCADE;`); } catch {}
      if (!options.json) logger.error('🕶️ REALM verdict: FAIL - ' + error.message);
      if (options.json) this.ctx.stdout.write(JSON.stringify(realm, null, 2) + '\n');
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

async function tryStartDocker(logger) {
  try {
    const { execSync } = await import('node:child_process');
    execSync('docker compose up -d postgres', { stdio: 'inherit' });
  } catch (e) {
    logger.warn('Could not start docker compose postgres: ' + (e?.message || e));
  }
}

async function execSql(db, dsn, sql) {
  // naive split not used; rely on pg handling multiple statements
  return db.query(dsn, sql);
}

// The following helpers mirror plan.mjs; keep in sync or refactor to shared module
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

export default RehearseCommand;
