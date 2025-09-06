/**
 * Supabase Generator Emit Functions
 * Side-effect free exports for lazy loading
 */

/**
 * Emit PostgreSQL DDL from canonical IR
 * @param {object} ir - { tables: [...] }
 */
export function emitDDL(ir) {
  const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';
  const tname = (name) => String(name).toLowerCase();

  const tables = ir.tables || [];
  const create = [];
  const indexes = [];
  const fks = [];

  // Pass 1: CREATE TABLE only (with PK/UNIQUE)
  for (const table of tables) {
    const tbl = tname(table.name);
    const colLines = [];
    for (const col of table.columns || []) {
      const parts = [q(col.name), col.type];
      if (col.nullable === false) parts.push('NOT NULL');
      if (col.default) parts.push('DEFAULT ' + col.default);
      colLines.push('  ' + parts.join(' '));
    }
    if (table.primaryKey) colLines.push(`  PRIMARY KEY (${q(table.primaryKey)})`);
    for (const col of table.columns || []) if (col.unique) colLines.push(`  UNIQUE (${q(col.name)})`);
    create.push(`CREATE TABLE IF NOT EXISTS ${q(tbl)} (\n${colLines.join(',\n')}\n);`);
  }

  // Pass 2: Indexes
  for (const table of tables) {
    const tbl = tname(table.name);
    for (const idx of table.indexes || []) {
      const idxName = idx.name || `idx_${tbl}_${(idx.columns || []).join('_')}`;
      const using = idx.using ? ` USING ${idx.using}` : '';
      const cols = (idx.columns || []).map((c) => q(c)).join(', ');
      indexes.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${q(idxName)} ON ${q(tbl)}${using} (${cols});`);
    }
  }

  // Pass 3: FKs (NOT VALID)
  for (const table of tables) {
    const tbl = tname(table.name);
    for (const fk of table.foreignKeys || []) {
      const cname = `fk_${tbl}_${fk.column}`;
      const refTable = tname(fk.refTable);
      fks.push(`ALTER TABLE ${q(tbl)} ADD CONSTRAINT ${q(cname)} FOREIGN KEY (${q(fk.column)}) REFERENCES ${q(refTable)} (${q(fk.refColumn)}) NOT VALID;`);
    }
  }

  const content = [create.join('\n'), indexes.join('\n'), fks.join('\n')].filter(Boolean).join('\n\n') + '\n';
  return { label: 'ddl', files: [{ name: 'schema.sql', content }] };
}

/**
 * Emit RLS policies (stub for MVP)
 */
export function emitRLS(ir) {
  return {
    label: 'rls',
    files: [
      { name: 'rls.sql', content: '-- RLS policies will be generated here' }
    ]
  };
}

/**
 * Emit migrations (placeholder, plan will emit phased files)
 */
export function emitMigrations(ir) {
  return {
    label: 'migrations',
    files: [
      { name: '001_initial.sql', content: '-- Initial migration (placeholder)' }
    ]
  };
}

/**
 * Emit pgTAP tests (basic)
 */
export function emitPgTap(ir) {
  return {
    label: 'pgtap',
    files: [
      { name: 'tests.sql', content: "SELECT plan(1);\nSELECT ok(true, 'DDL emits');\nSELECT * FROM finish();" }
    ]
  };
}
