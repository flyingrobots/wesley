/**
 * PostgreSQL Generator - Core domain logic
 * Generates PostgreSQL DDL from Wesley schema.
 */

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
      const sqlTable = (await import('../Identifier.mjs')).identifier.toTableSQLName(table.name);
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      const tableStartLine = this.currentLine;

      const cols = [];
      const constraints = [];

      for (const field of table.getFields()) {
        if (field.isVirtual()) continue;

        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        const fieldStartLine = this.currentLine + cols.length + constraints.length + 2;

        const colName = (await import('../Identifier.mjs')).identifier.toSQL(field.name);
        let col = `"${colName}" ${this.getSQLType(field)}`;

        if (field.isPrimaryKey()) {
          constraints.push(`PRIMARY KEY ("${colName}")`);
        }

        const defaultValue = field.getDefault();
        if (defaultValue?.expr || defaultValue?.value) {
          const dv = defaultValue.expr ?? defaultValue.value;
          col += ` DEFAULT ${dv}`;
        }

        cols.push(col);

        if (this.evidenceMap) {
          this.evidenceMap.record(fieldUid, 'sql', {
            file: 'out/schema.sql',
            lines: `${fieldStartLine}-${fieldStartLine}`,
            sha: this.evidenceMap.sha
          });
        }

        if (field.isUnique()) {
          constraints.push(`UNIQUE ("${colName}")`);
        }

        const fkRef = field.getForeignKeyRef();
        if (fkRef) {
          const [refTable, refCol] = fkRef.split('.');
          const idf = (await import('../Identifier.mjs')).identifier;
          constraints.push(
            `FOREIGN KEY ("${colName}") REFERENCES "${idf.toTableSQLName(refTable)}"("${idf.toSQL(refCol || 'id')}") ON DELETE NO ACTION`
          );
        }

        if (field.list && field.itemNonNull) {
          const baseType = scalarMap[field.type] || 'text';
          constraints.push(`CHECK (NOT "${colName}" @> ARRAY[NULL]::${baseType}[])`);
        }

        const checkExpr = field.getCheckConstraint();
        if (checkExpr) {
          constraints.push(`CHECK (${checkExpr})`);
        }
      }

      const create = `CREATE TABLE IF NOT EXISTS "${sqlTable}" (\n  ${[...cols, ...constraints]
        .filter(Boolean)
        .join(',\n  ')}\n);`;

      statements.push(create);
      statements.push(`COMMENT ON TABLE "${sqlTable}" IS 'uid: ${tableUid}';`);

      for (const field of table.getFields()) {
        if (!field.isVirtual()) {
          const idf = (await import('../Identifier.mjs')).identifier;
          const fieldUid = field.directives?.['@uid'] || `col:${table.name}.${field.name}`;
          statements.push(`COMMENT ON COLUMN "${sqlTable}"."${idf.toSQL(field.name)}" IS 'uid: ${fieldUid}';`);
        }
      }

      const deduplicator = new IndexDeduplicator();

      for (const field of table.getFields()) {
        if (field.isPrimaryKey()) {
          deduplicator.registerPrimaryKey(sqlTable, (await import('../Identifier.mjs')).identifier.toSQL(field.name));
        }
        if (field.isUnique()) {
          deduplicator.registerUniqueConstraint(sqlTable, (await import('../Identifier.mjs')).identifier.toSQL(field.name));
        }
      }

      for (const field of table.getFields()) {
        if (field.isIndexed()) {
          const indexDef = field.directives?.['@index'] || {};
          const idf = (await import('../Identifier.mjs')).identifier;
          const columns = [idf.toSQL(field.name)];
          const options = {
            unique: indexDef.unique || false,
            where: indexDef.where || null
          };

          const check = deduplicator.isRedundant(sqlTable, columns, options);
          if (!check.redundant) {
            const indexName = `${sqlTable}_${idf.toSQL(field.name)}_idx`;
            const indexUid = field.directives?.['@uid'] ? `idx_${field.directives['@uid']}` : `idx_${sqlTable}_${idf.toSQL(field.name)}`;

            let indexStmt = `CREATE`;
            if (options.unique) indexStmt += ` UNIQUE`;
            indexStmt += ` INDEX IF NOT EXISTS "${indexName}" ON "${sqlTable}" ("${idf.toSQL(field.name)}")`;
            if (options.where) {
              indexStmt += ` WHERE ${options.where}`;
            }
            indexStmt += `;`;

            statements.push(indexStmt);
            statements.push(`COMMENT ON INDEX "${indexName}" IS 'uid: ${indexUid}';`);

            deduplicator.registerIndex(sqlTable, columns, options);
          } else {
            statements.push(`-- Skipped redundant index: ${check.reason}`);
          }
        }
      }

      const rlsConfig = table.directives?.['@rls'];
      if (enableRLS && rlsConfig) {
        if (rlsConfig.preset) {
          statements.push(this.generatePresetRLS(table, rlsConfig.preset));
        } else {
          statements.push(this.generateRLSPolicies(table));
        }
      }

      const tableLines = create.split('\n').length;
      this.currentLine += tableLines;
      this.output.push(create);
    }

    const tenantModel = new TenantModel(schema);
    const tenantAnalysis = tenantModel.analyze();
    if (tenantAnalysis.hasTenancy || tenantAnalysis.hasOwnership) {
      statements.push('-- TENANT MODEL SUPPORT');
      statements.push(tenantModel.generateSQL());
    }

    const sql = statements.join('\n\n');
    // Return a String object so callers can use string methods AND access .sql
    const str = new String(sql);
    str.sql = sql;
    return str;
  }

  getSQLType(field) {
    const baseType = scalarMap[field.type] || 'text';

    if (field.list) {
      const arrayType = `${baseType}[]`;
      let sqlType = field.nonNull ? `${arrayType} NOT NULL` : arrayType;
      return sqlType;
    }

    return field.nonNull ? `${baseType} NOT NULL` : baseType;
  }

  generateRLSPolicies(table) {
    const tableName = table.name;
    const rlsConfig = table.rls;
    const uid = table.uid || tableName.toLowerCase();

    const policies = [];

    policies.push(`-- Enable RLS for ${tableName}`);
    policies.push(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
    policies.push(`ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`);

    if (rlsConfig?.select) {
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

    if (rlsConfig?.insert) {
      const roles = rlsConfig.insertRoles || rlsConfig.roles || ['authenticated'];
      const roleList = roles.map(r => `'${r}'`).join(', ');

      policies.push(`
DROP POLICY IF EXISTS "policy_${tableName}_insert_${uid}" ON "${tableName}";
CREATE POLICY "policy_${tableName}_insert_${uid}" ON "${tableName}"
  FOR INSERT
  TO ${roleList === "'public'" ? 'public' : roleList}
  WITH CHECK (${rlsConfig.insert});`);
    }

    if (rlsConfig?.update) {
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

    if (rlsConfig?.delete) {
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

  generatePresetRLS(table, presetConfig) {
    const tableName = table.name;
    let presetName;
    let presetOptions = {};

    if (typeof presetConfig === 'string') {
      presetName = presetConfig;
    } else {
      presetName = presetConfig.name;
      presetOptions = presetConfig.options || {};
    }

    const fields = table.getFields();

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
      if (!presetOptions.membership_table) {
        presetOptions.membership_table = 'membership';
      }
    }

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
