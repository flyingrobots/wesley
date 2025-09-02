/**
 * PostgreSQL Generator - Core domain logic
 * Generates PostgreSQL DDL from Wesley schema
 */

import { DirectiveProcessor } from '../Directives.mjs';

const scalarMap = {
  ID: 'uuid',
  String: 'text',
  Int: 'integer',
  Float: 'double precision',
  Boolean: 'boolean',
  DateTime: 'timestamptz'
};

export class PostgreSQLGenerator {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
    this.currentLine = 1;
    this.output = [];
  }

  async generate(schema, options = {}) {
    const enableRLS = options.enableRLS ?? true;
    const statements = [];
    this.currentLine = 1;
    this.output = [];

    for (const table of schema.getTables()) {
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      const tableStartLine = this.currentLine;
      
      const cols = [];
      const constraints = [];

      for (const field of table.getFields()) {
        // Skip virtual relation fields
        if (field.isVirtual()) continue;

        const fieldUid = DirectiveProcessor.getUid(field.directives) || 
                        `col:${table.name}.${field.name}`;
        const fieldStartLine = this.currentLine + cols.length + constraints.length + 2;

        let col = `"${field.name}" ${this.getSQLType(field)}`;

        if (field.isPrimaryKey()) {
          constraints.push(`PRIMARY KEY ("${field.name}")`);
        }

        const defaultValue = field.getDefault();
        if (defaultValue?.expr) {
          col += ` DEFAULT ${defaultValue.expr}`;
        }

        cols.push(col);
        
        // Record evidence for this field
        if (this.evidenceMap) {
          this.evidenceMap.record(fieldUid, 'sql', {
            file: 'out/schema.sql',
            lines: `${fieldStartLine}-${fieldStartLine}`,
            sha: this.evidenceMap.sha
          });
        }

        if (field.isUnique()) {
          constraints.push(`UNIQUE ("${field.name}")`);
        }

        const fkRef = field.getForeignKeyRef();
        if (fkRef) {
          const [refTable, refCol] = fkRef.split('.');
          constraints.push(
            `FOREIGN KEY ("${field.name}") REFERENCES "${refTable}"("${refCol || 'id'}") ON DELETE NO ACTION`
          );
        }
      }

      const create = `CREATE TABLE IF NOT EXISTS "${table.name}" (\n  ${[...cols, ...constraints]
        .filter(Boolean)
        .join(',\n  ')}\n);`;

      statements.push(create);

      // Generate indexes
      for (const field of table.getFields()) {
        if (field.isIndexed()) {
          statements.push(
            `CREATE INDEX IF NOT EXISTS "${table.name}_${field.name}_idx" ON "${table.name}" ("${field.name}");`
          );
        }
      }

      // Generate RLS policies if enabled and @rls directive present
      const rlsConfig = table.directives?.['@rls'];
      if (enableRLS && rlsConfig) {
        statements.push(this.generateRLSPolicies(table));
      }
    }

    return statements.join('\n\n');
  }

  getSQLType(field) {
    const pgType = scalarMap[field.type] || 'text';
    return field.nonNull ? `${pgType} NOT NULL` : pgType;
  }

  generateRLSPolicies(table) {
    const tableName = table.name;
    const rlsConfig = table.rls;
    const uid = table.uid || tableName.toLowerCase();
    
    const policies = [];
    
    // Enable RLS
    policies.push(`-- Enable RLS for ${tableName}`);
    policies.push(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
    
    // Generate policy for each operation
    if (rlsConfig.select) {
      policies.push(`
-- Drop if exists for idempotency
DROP POLICY IF EXISTS "policy_${tableName}_select_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_select_${uid}" ON "${tableName}"
  FOR SELECT
  USING (${rlsConfig.select});`);
    }
    
    if (rlsConfig.insert) {
      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_insert_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_insert_${uid}" ON "${tableName}"
  FOR INSERT
  WITH CHECK (${rlsConfig.insert});`);
    }
    
    if (rlsConfig.update) {
      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_update_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_update_${uid}" ON "${tableName}"
  FOR UPDATE
  USING (${rlsConfig.update})
  WITH CHECK (${rlsConfig.update});`);
    }
    
    if (rlsConfig.delete) {
      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_delete_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_delete_${uid}" ON "${tableName}"
  FOR DELETE
  USING (${rlsConfig.delete});`);
    }
    
    return policies.join('\n');
  }
}