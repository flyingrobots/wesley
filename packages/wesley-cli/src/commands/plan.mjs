/**
 * Plan Command - Explain phased migration plan
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

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
      .option('--write', 'Write migration files to out-dir/migrations')
      .option('--json', 'Emit JSON plan');
  }

  async executeCore(context) {
    const { options, schemaContent, logger } = context;
    const outDir = options.outDir || this.ctx?.config?.paths?.migrations || this.ctx?.config?.paths?.output || 'out';
    options.outDir = outDir;

    // Enforce clean tree only in strict policy; default: allow
    const env = this.ctx.env || {};
    if (shouldEnforceCleanPlan(env) && !options.allowDirty) {
      try { await assertCleanGit(); } catch (e) { e.code = e.code || 'DIRTY_WORKTREE'; throw e; }
    }

    const current = this.ctx.parsers.graphql.parse(schemaContent);

    let previous = { tables: [] };
    try {
      const snap = await this.ctx.fs.read('.wesley/snapshot.json');
      previous = JSON.parse(snap);
    } catch {}

    const plan = buildAdditivePlan(previous, current);
    const explain = explainPlan(plan);
    const radar = buildLockRadar(explain, plan);
    const mapping = buildMapping(plan);

    if (options.json) {
      this.ctx.stdout.write(JSON.stringify({ plan, explain, mapping, radar }, null, 2) + '\n');
      return { phases: plan.phases.length, steps: explain.steps.length };
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
        await this.ctx.fs.write(`${options.outDir}/migrations/${f.name}`, f.content);
      }
      if (!options.quiet) logger.info(`✍️ Wrote ${files.length} migration file(s) to ${options.outDir}/migrations`);
    }

    return { phases: plan.phases.length };
  }
}

// Build additive-only plan: tables/columns/indexes/fks
function buildAdditivePlan(prev, curr) {
  const pmap = new Map((prev.tables || []).map(t => [t.name, t]));
  const cmap = new Map((curr.tables || []).map(t => [t.name, t]));

  const phaseOrder = ['expand', 'backfill', 'validate', 'switch', 'contract'];
  const phases = phaseOrder.map(name => ({ name, steps: [] }));
  const getPhase = (name) => phases.find(p => p.name === name);

  for (const [name, t] of cmap) {
    const old = pmap.get(name);
    if (!old) {
      // New table: create table + indexes + fks (NOT VALID)
      getPhase('expand').steps.push({ op: 'create_table', table: name });
      for (const idx of t.indexes || []) {
        getPhase('expand').steps.push({ op: 'create_index_concurrently', table: name, columns: idx.columns, using: idx.using, name: idx.name });
      }
      for (const fk of t.foreignKeys || []) {
        getPhase('expand').steps.push({ op: 'add_fk_not_valid', table: name, column: fk.column, refTable: fk.refTable, refColumn: fk.refColumn });
        getPhase('validate').steps.push({ op: 'validate_fk', table: name, column: fk.column });
      }
      continue;
    }
    // New columns
    const oldCols = new Set((old.columns || []).map(c => c.name));
    for (const c of t.columns || []) {
      if (!oldCols.has(c.name)) {
        getPhase('expand').steps.push({ op: 'add_column', table: name, column: c.name, type: c.type, nullable: c.nullable, default: c.default });
        if (c.nullable === false) {
          getPhase('backfill').steps.push({ op: 'backfill_column', table: name, column: c.name, default: c.default });
          getPhase('switch').steps.push({ op: 'set_not_null', table: name, column: c.name });
        }
      }
    }
    // New indexes
    const oldIdxSig = new Set((old.indexes || []).map(i => (i.columns||[]).join('|')));
    for (const idx of t.indexes || []) {
      const sig = (idx.columns||[]).join('|');
      if (!oldIdxSig.has(sig)) {
        getPhase('expand').steps.push({ op: 'create_index_concurrently', table: name, columns: idx.columns, using: idx.using, name: idx.name });
      }
    }
    // New FKs
    const oldFks = new Set((old.foreignKeys||[]).map(f => `${f.column}->${f.refTable}.${f.refColumn}`));
    for (const fk of t.foreignKeys || []) {
      const key = `${fk.column}->${fk.refTable}.${fk.refColumn}`;
      if (!oldFks.has(key)) {
        getPhase('expand').steps.push({ op: 'add_fk_not_valid', table: name, column: fk.column, refTable: fk.refTable, refColumn: fk.refColumn });
        getPhase('validate').steps.push({ op: 'validate_fk', table: name, column: fk.column });
      }
    }
  }

  return { phases };
}

function explainPlan(plan) {
  const lines = [];
  const steps = [];
  for (const phase of plan.phases) {
    lines.push(`• ${phase.name}`);
    for (const s of phase.steps) {
      const lock = lockFor(s);
      lines.push(`   - ${s.op} on ${s.table}${s.column?'.'+s.column:''} [${lock.name}]`);
      steps.push({ ...s, lock });
    }
  }
  return { lines, steps };
}

function lockFor(step) {
  switch (step.op) {
    case 'create_table': return L('ACCESS EXCLUSIVE', true, true);
    case 'add_column': return step.nullable !== false || step.default ? L('SHARE ROW EXCLUSIVE', true, false) : L('ACCESS EXCLUSIVE', true, true);
    case 'create_index_concurrently': return L('SHARE UPDATE EXCLUSIVE', true, false);
    case 'add_fk_not_valid': return L('SHARE ROW EXCLUSIVE', true, false);
    case 'validate_fk': return L('SHARE ROW EXCLUSIVE', true, false);
    case 'backfill_column': return L('ROW EXCLUSIVE', true, false);
    case 'set_not_null': return L('ACCESS EXCLUSIVE', true, true);
    default: return L('EXCLUSIVE', true, false);
  }
}
function L(name, blocksWrites, blocksReads){ return { name, blocksWrites, blocksReads }; }

function emitMigrations(plan) {
  const files = [];
  const statements = new Map([
    ['expand', []],
    ['backfill', []],
    ['validate', []],
    ['switch', []],
    ['contract', []]
  ]);

  const q = (id) => '"' + id.replace(/"/g, '""') + '"';
  const tname = (n) => n.toLowerCase();

  for (const phase of plan.phases) {
    for (const s of phase.steps) {
      const bucket = statements.get(phase.name);
      if (!bucket) continue;
      if (s.op === 'create_table') {
        bucket.push(`-- create table ${s.table}`);
        // table DDL handled by full schema ddl; keep placeholder here
      }
      if (s.op === 'add_column') {
        const parts = [`ALTER TABLE ${q(tname(s.table))} ADD COLUMN ${q(s.column)} ${s.type}`];
        if (s.nullable === false && s.default) parts.push('DEFAULT ' + s.default);
        // Add as nullable by default in expand phase
        bucket.push(parts.join(' ') + ';');
      }
      if (s.op === 'create_index_concurrently') {
        const idxName = s.name || `idx_${tname(s.table)}_${(s.columns || []).join('_')}`;
        const using = s.using ? ` USING ${s.using}` : '';
        const cols = (s.columns || []).map((c)=> q(c)).join(', ');
        bucket.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${q(idxName)} ON ${q(tname(s.table))}${using} (${cols});`);
      }
      if (s.op === 'add_fk_not_valid') {
        const cname = `fk_${tname(s.table)}_${s.column}`;
        bucket.push(`ALTER TABLE ${q(tname(s.table))} ADD CONSTRAINT ${q(cname)} FOREIGN KEY (${q(s.column)}) REFERENCES ${q(tname(s.refTable))} (${q(s.refColumn)}) NOT VALID;`);
      }
      if (s.op === 'validate_fk') {
        const cname = `fk_${tname(s.table)}_${s.column}`;
        bucket.push(`ALTER TABLE ${q(tname(s.table))} VALIDATE CONSTRAINT ${q(cname)};`);
      }
      if (s.op === 'backfill_column') {
        if (s.default) {
          const defaultExpr = s.default;
          bucket.push(`UPDATE ${q(tname(s.table))} SET ${q(s.column)} = ${defaultExpr} WHERE ${q(s.column)} IS NULL;`);
        } else {
          bucket.push(`-- TODO: backfill ${tname(s.table)}.${s.column} before switching to NOT NULL`);
        }
      }
      if (s.op === 'set_not_null') {
        bucket.push(`ALTER TABLE ${q(tname(s.table))} ALTER COLUMN ${q(s.column)} SET NOT NULL;`);
      }
    }
  }

  const orderedFiles = [
    ['expand', '001_expand.sql'],
    ['backfill', '002_backfill.sql'],
    ['validate', '003_validate.sql'],
    ['switch', '004_switch.sql'],
    ['contract', '005_contract.sql']
  ];

  for (const [phaseName, fileName] of orderedFiles) {
    const stmts = statements.get(phaseName) || [];
    if (stmts.length) {
      files.push({ name: fileName, content: stmts.join('\n') + '\n' });
    }
  }
  return files;
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

export default PlanCommand;

// Git cleanliness check
function shouldEnforceCleanPlan(env) {
  const policy = (env?.WESLEY_GIT_POLICY || 'emit').toLowerCase();
  return policy === 'strict';
}
async function assertCleanGit() {
  const shell = globalThis?.wesleyCtx?.shell;
  try { shell?.execSync?.('git rev-parse --is-inside-work-tree', { stdio: 'ignore' }); } catch { return; }
  const out = (await shell?.exec?.('git status --porcelain'))?.stdout?.trim?.() || '';
  if (out) {
    const err = new Error('Working tree has uncommitted changes. Commit or stash before running, or pass --allow-dirty.');
    err.code = 'DIRTY_WORKTREE';
    throw err;
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
