/**
 * Shared migration plan helpers for plan/rehearse/up and other runtime consumers.
 *
 * Kept in core so Node-side entry points can build the same plan shape without
 * importing Wesley CLI code.
 */

import { fieldTypeToPg } from '../domain/typeMapping.mjs';

// ── Validation regexes (M3) ─────────────────────────────────────────────────
const SAFE_PG_TYPE_RE = /^[a-zA-Z_][a-zA-Z0-9_ [\](),.]*$/;
const SAFE_USING_RE = /^(btree|hash|gin|gist|spgist|brin)$/i;
// Allowlist for DEFAULT values: numeric literals, booleans, bare function calls, single-quoted strings.
const SAFE_DEFAULT_RE = /^(-?\d+(\.\d+)?|true|false|'[^']*'|[a-zA-Z_][a-zA-Z0-9_]*\(\))$/i;

/**
 * Build an additive-only migration plan: tables/columns/indexes/fks.
 * Reads the new IR shape (table.fields with structured FieldType and directives).
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
        phases[0].steps.push({ op: 'create_index_concurrently', table: name, columns: idx.fields, using: idx.using, name: idx.name });
      }
      for (const f of t.fields || []) {
        if (!f.directives.fk) continue;
        phases[0].steps.push({ op: 'add_fk_not_valid', table: name, column: f.name, refTable: f.directives.fk.targetTable, refColumn: f.directives.fk.targetField });
        phases[1].steps.push({ op: 'validate_fk', table: name, column: f.name });
      }
      continue;
    }
    // New fields
    const oldFields = new Set((old.fields || []).map(f => f.name));
    for (const f of t.fields || []) {
      if (!oldFields.has(f.name)) {
        const defaultVal = f.directives.default?.value ?? null;
        phases[0].steps.push({ op: 'add_column', table: name, column: f.name, type: fieldTypeToPg(f.type), nullable: f.nullable, default: defaultVal });
      }
    }
    // New indexes
    const oldIdxSig = new Set((old.indexes || []).map(i => (i.fields || []).join('|') + ':' + (i.using || 'btree')));
    for (const idx of t.indexes || []) {
      const sig = (idx.fields || []).join('|') + ':' + (idx.using || 'btree');
      if (!oldIdxSig.has(sig)) {
        phases[0].steps.push({ op: 'create_index_concurrently', table: name, columns: idx.fields, using: idx.using, name: idx.name });
      }
    }
    // New FKs
    const oldFks = new Set((old.fields || []).filter(f => f.directives.fk).map(f => `${f.name}->${f.directives.fk.targetTable}.${f.directives.fk.targetField}`));
    for (const f of t.fields || []) {
      if (!f.directives.fk) continue;
      const key = `${f.name}->${f.directives.fk.targetTable}.${f.directives.fk.targetField}`;
      if (!oldFks.has(key)) {
        phases[0].steps.push({ op: 'add_fk_not_valid', table: name, column: f.name, refTable: f.directives.fk.targetTable, refColumn: f.directives.fk.targetField });
        phases[1].steps.push({ op: 'validate_fk', table: name, column: f.name });
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
    // PG 11+ allows ADD COLUMN with a non-volatile DEFAULT without rewriting the table,
    // so nullable columns or columns with a DEFAULT only need SHARE ROW EXCLUSIVE.
    // ACCESS EXCLUSIVE is required only for NOT NULL columns without a DEFAULT.
  case 'add_column': {
    const canAvoidRewrite = step.nullable !== false || step.default != null;
    return canAvoidRewrite
      ? L('SHARE ROW EXCLUSIVE', true, false)
      : L('ACCESS EXCLUSIVE', true, true);
  }
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
        expand.push(`-- create table ${q(tname(s.table))}`);
      }
      if (s.op === 'add_column') {
        // M3: validate type
        if (s.type && !SAFE_PG_TYPE_RE.test(String(s.type))) {
          throw new Error(`Unsafe PostgreSQL type in migration: ${s.type}`);
        }
        // M3/SR-M6: validate default — allowlist of safe patterns only.
        // Accepts: numeric literals, booleans, bare function calls, single-quoted strings.
        if (s.default != null && !SAFE_DEFAULT_RE.test(String(s.default))) {
          throw new Error(`Unsafe DEFAULT value in migration: ${s.default}`);
        }
        const parts = [`ALTER TABLE ${q(tname(s.table))} ADD COLUMN ${q(s.column)} ${s.type}`];
        if (s.nullable === false) parts.push('NOT NULL');
        if (s.default != null) parts.push('DEFAULT ' + s.default);
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
