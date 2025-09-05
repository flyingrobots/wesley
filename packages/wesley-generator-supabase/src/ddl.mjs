/**
 * PostgreSQL Generator - Core domain logic
 * Generates PostgreSQL DDL from Wesley schema using @supabase/pg-parser
 */

// Use Supabase pg-parser with our custom deparser
import { PgParser } from '@supabase/pg-parser';
import { SQLDeparser } from './SQLDeparser.mjs';

const parser = new PgParser();
const deparser = new SQLDeparser();

const parse = async (sql) => {
  try {
    return await parser.parse(sql);
  } catch (error) {
    console.warn('PostgreSQLGenerator: parse failed:', error.message);
    return null;
  }
};

const deparse = (ast) => {
  try {
    return deparser.deparse(ast);
  } catch (error) {
    console.warn('PostgreSQLGenerator: deparse failed:', error.message);
    return '-- deparse failed: ' + error.message;
  }
};
import { DirectiveProcessor } from '../Directives.mjs';
import { IndexDeduplicator } from '../IndexDeduplicator.mjs';
import { TenantModel } from '../TenantModel.mjs';
import { RLSPresets } from '../RLSPresets.mjs';

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
    this.rlsPresets = new RLSPresets();
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

        // Add custom CHECK constraints
        const checkExpr = field.getCheckConstraint();
        if (checkExpr) {
          constraints.push(`CHECK (${checkExpr})`);
        }
      }

      const create = `CREATE TABLE IF NOT EXISTS "${table.name}" (\n  ${[...cols, ...constraints]
        .filter(Boolean)
        .join(',\n  ')}\n);`;

      statements.push(create);
      
      // Add UID comment for evidence tracking (reuse tableUid from above)
      statements.push(`COMMENT ON TABLE "${table.name}" IS 'uid: ${tableUid}';`);
      
      // Add column comments with UIDs
      for (const field of table.getFields()) {
        if (!field.isVirtual()) {
          const fieldUid = field.directives?.['@uid'] || `col_${table.name.toLowerCase()}_${field.name.toLowerCase()}`;
          statements.push(`COMMENT ON COLUMN "${table.name}"."${field.name}" IS 'uid: ${fieldUid}';`);
        }
      }

      // Generate indexes with deduplication
      const deduplicator = new IndexDeduplicator();
      
      // Register PKs and unique constraints first
      for (const field of table.getFields()) {
        if (field.isPrimaryKey()) {
          deduplicator.registerPrimaryKey(table.name, field.name);
        }
        if (field.isUnique()) {
          deduplicator.registerUniqueConstraint(table.name, field.name);
        }
      }
      
      // Generate non-redundant indexes
      for (const field of table.getFields()) {
        if (field.isIndexed()) {
          const indexDef = field.directives?.['@index'] || {};
          const columns = [field.name];
          const options = {
            unique: indexDef.unique || false,
            where: indexDef.where || null
          };
          
          const check = deduplicator.isRedundant(table.name, columns, options);
          if (!check.redundant) {
            const indexName = `${table.name}_${field.name}_idx`;
            const indexUid = field.directives?.['@uid'] ? `idx_${field.directives['@uid']}` : `idx_${table.name.toLowerCase()}_${field.name.toLowerCase()}`;
            
            let indexStmt = `CREATE`;
            if (options.unique) indexStmt += ` UNIQUE`;
            indexStmt += ` INDEX IF NOT EXISTS "${indexName}" ON "${table.name}" ("${field.name}")`;
            if (options.where) {
              indexStmt += ` WHERE ${options.where}`;
            }
            indexStmt += `;`;
            
            statements.push(indexStmt);
            statements.push(`COMMENT ON INDEX "${indexName}" IS 'uid: ${indexUid}';`);
            
            deduplicator.registerIndex(table.name, columns, options);
          } else {
            // Add comment about skipped redundant index
            statements.push(`-- Skipped redundant index: ${check.reason}`);
          }
        }
      }

      // Generate RLS policies if enabled and @rls directive present
      const rlsConfig = table.directives?.['@rls'];
      if (enableRLS && rlsConfig) {
        // Check for preset usage
        if (rlsConfig.preset) {
          statements.push(this.generatePresetRLS(table, rlsConfig.preset));
        } else {
          statements.push(this.generateRLSPolicies(table));
        }
      }
    }

    // Analyze schema for tenant model
    const tenantModel = new TenantModel(schema);
    const tenantAnalysis = tenantModel.analyze();
    
    // If we have tenant model, generate additional SQL
    if (tenantAnalysis.hasTenancy || tenantAnalysis.hasOwnership) {
      statements.push('-- TENANT MODEL SUPPORT');
      statements.push(tenantModel.generateSQL());
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
      const roles = rlsConfig.selectRoles || rlsConfig.roles || ['authenticated'];
      const roleList = roles.map(r => `'${r}'`).join(', ');
      
      policies.push(`
-- Drop if exists for idempotency
DROP POLICY IF EXISTS "policy_${tableName}_select_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_select_${uid}" ON "${tableName}"
  FOR SELECT
  TO ${roleList === "'public'" ? 'public' : roleList}
  USING (${rlsConfig.select});`);
    }
    
    if (rlsConfig.insert) {
      const roles = rlsConfig.insertRoles || rlsConfig.roles || ['authenticated'];
      const roleList = roles.map(r => `'${r}'`).join(', ');
      
      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_insert_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_insert_${uid}" ON "${tableName}"
  FOR INSERT
  TO ${roleList === "'public'" ? 'public' : roleList}
  WITH CHECK (${rlsConfig.insert});`);
    }
    
    if (rlsConfig.update) {
      const roles = rlsConfig.updateRoles || rlsConfig.roles || ['authenticated'];
      const roleList = roles.map(r => `'${r}'`).join(', ');
      
      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_update_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_update_${uid}" ON "${tableName}"
  FOR UPDATE
  TO ${roleList === "'public'" ? 'public' : roleList}
  USING (${rlsConfig.update})
  WITH CHECK (${rlsConfig.update});`);
    }
    
    if (rlsConfig.delete) {
      const roles = rlsConfig.deleteRoles || rlsConfig.roles || ['authenticated'];
      const roleList = roles.map(r => `'${r}'`).join(', ');
      
      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_delete_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_delete_${uid}" ON "${tableName}"
  FOR DELETE
  TO ${roleList === "'public'" ? 'public' : roleList}
  USING (${rlsConfig.delete});`);
    }
    
    return policies.join('\n');
  }
  
  /**
   * Generate RLS policies from preset
   */
  generatePresetRLS(table, presetConfig) {
    const tableName = table.name;
    let presetName;
    let presetOptions = {};
    
    // Parse preset config (can be string or object)
    if (typeof presetConfig === 'string') {
      presetName = presetConfig;
    } else {
      presetName = presetConfig.name;
      presetOptions = presetConfig.options || {};
    }
    
    // Auto-detect common column names if not provided
    const fields = table.getFields();
    
    // Owner column detection
    if (!presetOptions.owner_column && (presetName === 'owner' || presetName === 'public-read')) {
      const ownerField = fields.find(f => 
        f.name === 'created_by' || 
        f.name === 'owner_id' || 
        f.name === 'user_id' ||
        f.name === 'author_id'
      );
      if (ownerField) {
        presetOptions.owner_column = ownerField.name;
      }
    }
    
    // Tenant column detection
    if (!presetOptions.tenant_column && presetName === 'tenant') {
      const tenantField = fields.find(f => 
        f.name === 'org_id' || 
        f.name === 'organization_id' || 
        f.name === 'tenant_id' ||
        f.name === 'company_id'
      );
      if (tenantField) {
        presetOptions.tenant_column = tenantField.name;
      }
      
      // Auto-detect membership table
      if (!presetOptions.membership_table) {
        // Look for common membership table names in schema
        presetOptions.membership_table = 'membership'; // Default
      }
    }
    
    // Deleted at column detection for soft-delete
    if (!presetOptions.deleted_at_column && presetName === 'soft-delete') {
      const deletedField = fields.find(f => 
        f.name === 'deleted_at' || 
        f.name === 'deleted' || 
        f.name === 'is_deleted'
      );
      if (deletedField) {
        presetOptions.deleted_at_column = deletedField.name;
      }
    }
    
    // Generate SQL using preset
    try {
      return this.rlsPresets.generateSQL(presetName, tableName, presetOptions);
    } catch (error) {
      if (this.evidenceMap) {
        this.evidenceMap.recordError(table.uid || tableName, {
          message: `Failed to apply RLS preset: ${error.message}`,
          type: 'rls_preset_error',
          context: { preset: presetName, options: presetOptions }
        });
      }
      throw error;
    }
  }
}