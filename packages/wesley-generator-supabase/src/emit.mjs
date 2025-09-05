/**
 * Supabase Generator Emit Functions
 * Side-effect free exports for lazy loading
 */

/**
 * Emit PostgreSQL DDL from canonical IR
 * @param {object} ir - { tables: [...] }
 */
export function emitDDL(ir) {
  const lines = [];

  const q = (id) => '"' + id.replace(/"/g, '""') + '"';
  const tname = (name) => name.toLowerCase();

  for (const table of ir.tables || []) {
    const tbl = tname(table.name);
    const colLines = [];
    for (const col of table.columns || []) {
      const parts = [q(col.name), col.type];
      if (col.nullable === false) parts.push('NOT NULL');
      if (col.default) parts.push('DEFAULT ' + col.default);
      colLines.push('  ' + parts.join(' '));
    }
    if (table.primaryKey) {
      colLines.push(`  PRIMARY KEY (${q(table.primaryKey)})`);
    }
    // Unique constraints per unique column
    for (const col of table.columns || []) {
      if (col.unique) {
        colLines.push(`  UNIQUE (${q(col.name)})`);
      }
    }
    lines.push(`CREATE TABLE IF NOT EXISTS ${q(tbl)} (\n${colLines.join(',\n')}\n);`);

    // Indexes (concurrently)
    for (const idx of table.indexes || []) {
      const idxName = idx.name || `idx_${tbl}_${(idx.columns || []).join('_')}`;
      const using = idx.using ? ` USING ${idx.using}` : '';
      const cols = (idx.columns || []).map((c) => q(c)).join(', ');
      lines.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${q(idxName)} ON ${q(tbl)}${using} (${cols});`);
    }
    // Foreign keys (NOT VALID)
    for (const fk of table.foreignKeys || []) {
      const cname = `fk_${tbl}_${fk.column}`;
      const refTable = tname(fk.refTable);
      lines.push(
        `ALTER TABLE ${q(tbl)} ADD CONSTRAINT ${q(cname)} FOREIGN KEY (${q(fk.column)}) REFERENCES ${q(refTable)} (${q(fk.refColumn)}) NOT VALID;`
      );
    }
    lines.push('');
  }

  return {
    label: 'ddl',
    files: [
      { name: 'schema.sql', content: lines.join('\n') }
    ]
  };
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
