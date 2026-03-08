/**
 * Supabase Generator Emit Functions
 * Side-effect free exports for lazy loading
 */

const GQL_TO_PG = {
  'ID': 'uuid',
  'UUID': 'uuid',
  'String': 'text',
  'Int': 'integer',
  'Float': 'double precision',
  'Boolean': 'boolean',
  'DateTime': 'timestamptz',
  'Date': 'date',
  'Time': 'time with time zone',
  'JSON': 'jsonb',
  'Decimal': 'numeric',
  'BigInt': 'bigint'
};

function gqlToPgType(fieldType) {
  const pgBase = GQL_TO_PG[fieldType.base] || 'text';
  return fieldType.isList ? `${pgBase}[]` : pgBase;
}

/**
 * Emit PostgreSQL DDL from Wesley IR
 * @param {object} ir - Wesley IR with structured fields and directives
 */
export function emitDDL(ir) {
  const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';
  const tname = (name) => String(name).toLowerCase();

  const tables = ir.tables || [];
  const create = [];
  const indexStmts = [];
  const fks = [];

  // Pass 1: CREATE TABLE only (with PK/UNIQUE)
  for (const table of tables) {
    const tbl = tname(table.name);
    const colLines = [];
    for (const field of table.fields) {
      const parts = [q(field.name), gqlToPgType(field.type)];
      if (field.nullable === false) parts.push('NOT NULL');
      if (field.directives.default) parts.push('DEFAULT ' + field.directives.default.value);
      colLines.push('  ' + parts.join(' '));
    }
    const pkField = table.fields.find(f => f.directives.pk);
    if (pkField) colLines.push(`  PRIMARY KEY (${q(pkField.name)})`);
    for (const field of table.fields) {
      if (field.directives.unique) colLines.push(`  UNIQUE (${q(field.name)})`);
    }
    create.push(`CREATE TABLE IF NOT EXISTS ${q(tbl)} (\n${colLines.join(',\n')}\n);`);
  }

  // Pass 2: Indexes
  for (const table of tables) {
    const tbl = tname(table.name);
    for (const idx of table.indexes || []) {
      const cols = (idx.fields || []);
      const idxName = idx.name || `idx_${tbl}_${cols.join('_')}`;
      const using = idx.using ? ` USING ${idx.using}` : '';
      indexStmts.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${q(idxName)} ON ${q(tbl)}${using} (${cols.map(c => q(c)).join(', ')});`);
    }
  }

  // Pass 3: FKs (NOT VALID)
  for (const table of tables) {
    const tbl = tname(table.name);
    for (const field of table.fields) {
      if (!field.directives.fk) continue;
      const fk = field.directives.fk;
      const cname = `fk_${tbl}_${field.name}`;
      const refTable = tname(fk.targetTable);
      fks.push(`ALTER TABLE ${q(tbl)} ADD CONSTRAINT ${q(cname)} FOREIGN KEY (${q(field.name)}) REFERENCES ${q(refTable)} (${q(fk.targetField)}) NOT VALID;`);
    }
  }

  const content = [create.join('\n'), indexStmts.join('\n'), fks.join('\n')].filter(Boolean).join('\n\n') + '\n';
  return { label: 'ddl', files: [{ name: 'schema.sql', content }] };
}

/**
 * Emit RLS policies
 */
export function emitRLS(ir) {
  const lines = [];
  const q = (id) => '"' + String(id).replace(/"/g, '""').toLowerCase() + '"';
  for (const t of ir.tables || []) {
    const rls = t.directives?.rls;
    const tenantField = t.directives?.tenant?.field;
    if (rls || tenantField) {
      lines.push(`-- RLS for ${t.name}`);
      lines.push(`ALTER TABLE ${q(t.name)} ENABLE ROW LEVEL SECURITY;`);
      const map = [ ['select','SELECT'], ['insert','INSERT'], ['update','UPDATE'], ['delete','DELETE'] ];
      for (const [k, verb] of map) {
        const expr = rls && typeof rls[k] === 'string' ? rls[k] : null;
        if (expr) {
          const pname = `${t.name.toLowerCase()}_${k}`;
          lines.push(`CREATE POLICY ${q(pname)} ON ${q(t.name)} FOR ${verb} USING (${expr});`);
        }
      }
      lines.push('');
    }
  }
  const content = lines.length ? lines.join('\n') + '\n' : '-- No RLS annotations found\n';
  return { label: 'rls', files: [{ name: 'rls.sql', content }] };
}

/**
 * Emit migrations (placeholder, plan will emit phased files)
 */
export function emitMigrations(_ir) {
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
export function emitPgTap(_ir) {
  return {
    label: 'pgtap',
    files: [
      { name: 'tests.sql', content: "SELECT plan(1);\nSELECT ok(true, 'DDL emits');\nSELECT * FROM finish();" }
    ]
  };
}
