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
  DateTime: 'timestamptz',
  Date: 'date',
  Time: 'time',
  Decimal: 'numeric',
  UUID: 'uuid',
  JSON: 'jsonb',
  Inet: 'inet',
  CIDR: 'cidr',
  MacAddr: 'macaddr'
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
        
        // Add CHECK constraint for arrays with non-null items
        if (field.list && field.itemNonNull) {
          const baseType = scalarMap[field.type] || 'text';
          constraints.push(
            `CHECK (NOT "${field.name}" @> ARRAY[NULL]::${baseType}[])`
          );
        }
      }

      const create = `CREATE TABLE IF NOT EXISTS "${table.name}" (\n  ${[...cols, ...constraints]
        .filter(Boolean)
        .join(',\n  ')}\n);`;

      statements.push(create);
      
      // Add UID comment for evidence tracking
      const tableUid = table.directives?.['@uid'] || table.uid || `tbl_${table.name.toLowerCase()}`;
      statements.push(`COMMENT ON TABLE "${table.name}" IS 'uid: ${tableUid}';`);
      
      // Add column comments with UIDs
      for (const field of table.getFields()) {
        if (!field.isVirtual()) {
          const fieldUid = field.directives?.['@uid'] || `col_${table.name.toLowerCase()}_${field.name.toLowerCase()}`;
          statements.push(`COMMENT ON COLUMN "${table.name}"."${field.name}" IS 'uid: ${fieldUid}';`);
        }
      }

      // Generate indexes with UID comments
      for (const field of table.getFields()) {
        if (field.isIndexed()) {
          const indexName = `${table.name}_${field.name}_idx`;
          const indexUid = field.directives?.['@uid'] ? `idx_${field.directives['@uid']}` : `idx_${table.name.toLowerCase()}_${field.name.toLowerCase()}`;
          statements.push(
            `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table.name}" ("${field.name}");`
          );
          statements.push(`COMMENT ON INDEX "${indexName}" IS 'uid: ${indexUid}';`);
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
    const baseType = scalarMap[field.type] || 'text';
    
    // Handle array types with item nullability
    if (field.list) {
      // For arrays, PostgreSQL doesn't have NOT NULL on array elements directly
      // but we can add CHECK constraints
      const arrayType = `${baseType}[]`;
      
      // Add NOT NULL for the field itself if required
      let sqlType = field.nonNull ? `${arrayType} NOT NULL` : arrayType;
      
      // Note: itemNonNull would need a CHECK constraint, added separately
      // e.g., CHECK (NOT (array_field @> ARRAY[NULL]::type[]))
      
      return sqlType;
    }
    
    // Regular non-array field
    return field.nonNull ? `${baseType} NOT NULL` : baseType;
  }

  generateRLSPolicies(table) {
    const tableName = table.name;
    const rlsConfig = table.rls;
    const uid = table.uid || tableName.toLowerCase();
    
    const policies = [];
    
    // Enable RLS with FORCE for superusers
    policies.push(`-- Enable RLS for ${tableName}`);
    policies.push(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
    policies.push(`ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`);
    
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