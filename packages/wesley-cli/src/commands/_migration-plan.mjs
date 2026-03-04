/**
 * Shared migration plan helpers — used by both plan.mjs and rehearse.mjs.
 *
 * Extracted to eliminate duplication and to apply SQL-injection guards in a
 * single location (M3).
 */

// ── Validation regexes (M3) ─────────────────────────────────────────────────
const SAFE_PG_TYPE_RE = /^[a-zA-Z_][a-zA-Z0-9_ [\](),.]*$/;
const SAFE_USING_RE = /^(btree|hash|gin|gist|spgist|brin)$/i;

/**
 * Build an additive-only migration plan: tables/columns/indexes/fks.
 */
export function buildAdditivePlan(prev, curr) {
  const pmap = new Map((prev.tables || []).map(t => [t.name, t]));
  const cmap = new Map((curr.tables || []).map(t => [t.name, t]));

  const phases = [{ name: 'expand', steps: [] }, { name: 'validate', steps: [] }];

  for (const [name, t] of cmap) {
    const old = pmap.get(name);
    if (!old) {
      phases[0].steps.push({ op: 'create_table', table: name });
      for (const idx of t.indexes || []) {
        phases[0].steps.push({ op: 'create_index_concurrently', table: name, columns: idx.columns, using: idx.using, name: idx.name });
      }
      for (const fk of t.foreignKeys || []) {
        phases[0].steps.push({ op: 'add_fk_not_valid', table: name, column: fk.column, refTable: fk.refTable, refColumn: fk.refColumn });
        phases[1].steps.push({ op: 'validate_fk', table: name, column: fk.column });
      }
      continue;
    }
    // New columns
    const oldCols = new Set((old.columns || []).map(c => c.name));
    for (const c of t.columns || []) {
      if (!oldCols.has(c.name)) {
        phases[0].steps.push({ op: 'add_column', table: name, column: c.name, type: c.type, nullable: c.nullable, default: c.default });
      }
    }
    // New indexes
    const oldIdxSig = new Set((old.indexes || []).map(i => (i.columns || []).join('|')));
    for (const idx of t.indexes || []) {
      const sig = (idx.columns || []).join('|');
      if (!oldIdxSig.has(sig)) {
        phases[0].steps.push({ op: 'create_index_concurrently', table: name, columns: idx.columns, using: idx.using, name: idx.name });
      }
    }
    // New FKs
    const oldFks = new Set((old.foreignKeys || []).map(f => `${f.column}->${f.refTable}.${f.refColumn}`));
    for (const fk of t.foreignKeys || []) {
      const key = `${fk.column}->${fk.refTable}.${fk.refColumn}`;
      if (!oldFks.has(key)) {
        phases[0].steps.push({ op: 'add_fk_not_valid', table: name, column: fk.column, refTable: fk.refTable, refColumn: fk.refColumn });
        phases[1].steps.push({ op: 'validate_fk', table: name, column: fk.column });
      }
    }
  }

  return { phases };
}

export function explainPlan(plan) {
  const lines = [];
  const steps = [];
  for (const phase of plan.phases) {
    lines.push(`• ${phase.name}`);
    for (const s of phase.steps) {
      const lock = lockFor(s);
      lines.push(`   - ${s.op} on ${s.table}${s.column ? '.' + s.column : ''} [${lock.name}]`);
      steps.push({ ...s, lock });
    }
  }
  return { lines, steps };
}

export function lockFor(step) {
  switch (step.op) {
    case 'create_table': return L('ACCESS EXCLUSIVE', true, true);
    case 'add_column': return step.nullable !== false || step.default ? L('SHARE ROW EXCLUSIVE', true, false) : L('ACCESS EXCLUSIVE', true, true);
    case 'create_index_concurrently': return L('SHARE UPDATE EXCLUSIVE', true, false);
    case 'add_fk_not_valid': return L('SHARE ROW EXCLUSIVE', true, false);
    case 'validate_fk': return L('SHARE ROW EXCLUSIVE', true, false);
    default: return L('EXCLUSIVE', true, false);
  }
}

function L(name, blocksWrites, blocksReads) { return { name, blocksWrites, blocksReads }; }

/**
 * Emit migration SQL files from a plan.
 * Validates injected values (M3: s.type, s.using, s.default).
 */
export function emitMigrations(plan) {
  const files = [];
  const expand = [];
  const validate = [];

  const q = (id) => '"' + id.replace(/"/g, '""') + '"';
  const tname = (n) => n.toLowerCase();

  for (const phase of plan.phases) {
    for (const s of phase.steps) {
      if (s.op === 'create_table') {
        expand.push(`-- create table ${s.table}`);
      }
      if (s.op === 'add_column') {
        // M3: validate type
        if (s.type && !SAFE_PG_TYPE_RE.test(String(s.type))) {
          throw new Error(`Unsafe PostgreSQL type in migration: ${s.type}`);
        }
        // M3: validate default (no semicolons)
        if (s.default && /;/.test(String(s.default))) {
          throw new Error(`Unsafe DEFAULT value in migration (contains semicolon): ${s.default}`);
        }
        const parts = [`ALTER TABLE ${q(tname(s.table))} ADD COLUMN ${q(s.column)} ${s.type}`];
        if (s.nullable === false && s.default) parts.push('DEFAULT ' + s.default);
        expand.push(parts.join(' ') + ';');
      }
      if (s.op === 'create_index_concurrently') {
        // M3: validate USING
        if (s.using && !SAFE_USING_RE.test(String(s.using))) {
          throw new Error(`Unsafe index method in migration: ${s.using}`);
        }
        const idxName = s.name || `idx_${tname(s.table)}_${(s.columns || []).join('_')}`;
        const using = s.using ? ` USING ${s.using}` : '';
        const cols = (s.columns || []).map((c) => q(c)).join(', ');
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
