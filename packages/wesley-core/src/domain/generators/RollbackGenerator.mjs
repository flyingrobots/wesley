/**
 * Rollback Generator - Creates inverse DDL operations for safe migration rollbacks
 * 
 * Generates reversion scripts that can undo migration changes while preserving data
 * where possible. Critical for production database safety.
 */

export class RollbackGenerator {
  constructor() {
    // Operations that can cause permanent data loss
    this.DATA_LOSS_OPERATIONS = new Set([
      'drop_table',
      'drop_column', 
      'alter_type', // potential data truncation
      'drop_constraint'
    ]);
  }

  /**
   * Generate rollback SQL for a complete migration
   * @param {Array} forwardSteps - Forward migration steps
   * @param {Object} options - Generation options
   * @returns {Object} Rollback information including SQL and warnings
   */
  generateRollback(forwardSteps, options = {}) {
    const rollbackSteps = [];
    const dataPreservationSteps = [];
    const warnings = [];
    
    // Process steps in reverse order for rollback
    const reversedSteps = [...forwardSteps].reverse();
    
    for (const step of reversedSteps) {
      try {
        const rollbackStep = this.generateStepRollback(step);
        
        if (rollbackStep) {
          rollbackSteps.push(rollbackStep);
          
          // Check if data preservation is needed
          if (this.requiresDataPreservation(step)) {
            const preservationStep = this.generateDataPreservation(step);
            if (preservationStep) {
              dataPreservationSteps.push(preservationStep);
            }
          }
        }
      } catch (error) {
        warnings.push({
          step: step.kind,
          table: step.table,
          warning: `Cannot generate safe rollback: ${error.message}`,
          severity: 'error'
        });
      }
    }
    
    // Generate safety checks
    const safetyChecks = this.generateSafetyChecks(forwardSteps);
    
    return {
      rollbackSteps,
      dataPreservationSteps,
      safetyChecks,
      warnings,
      requiresManualIntervention: warnings.some(w => w.severity === 'error'),
      riskLevel: this.calculateRollbackRisk(rollbackSteps, warnings)
    };
  }

  /**
   * Generate rollback for a specific migration step
   * @param {Object} step - Forward migration step
   * @returns {Object} Rollback step or null if not reversible
   */
  generateStepRollback(step) {
    switch (step.kind) {
      case 'create_table':
        return {
          kind: 'drop_table_rollback',
          table: step.table,
          sql: `DROP TABLE IF EXISTS "${step.table}";`,
          riskLevel: 'high',
          dataLoss: true,
          description: `Drop table ${step.table} created during forward migration`
        };

      case 'drop_table':
        // Cannot safely rollback table drops without schema recreation
        throw new Error('Table drops cannot be automatically rolled back - requires manual schema recreation');

      case 'add_column':
        return {
          kind: 'drop_column_rollback',
          table: step.table,
          column: step.column,
          sql: `ALTER TABLE "${step.table}" DROP COLUMN IF EXISTS "${step.column}";`,
          riskLevel: 'medium',
          dataLoss: true,
          description: `Drop column ${step.column} added during forward migration`
        };

      case 'drop_column':
        // Cannot safely rollback column drops without data recreation
        throw new Error(`Column ${step.column} drop cannot be automatically rolled back - data permanently lost`);

      case 'alter_type':
        return this.generateTypeRollback(step);

      case 'create_index':
        return {
          kind: 'drop_index_rollback',
          table: step.table,
          indexName: step.indexName || `${step.table}_${step.column}_idx`,
          sql: `DROP INDEX IF EXISTS "${step.indexName || `${step.table}_${step.column}_idx`}";`,
          riskLevel: 'low',
          dataLoss: false,
          description: `Drop index created during forward migration`
        };

      case 'drop_index':
        return {
          kind: 'create_index_rollback',
          table: step.table,
          indexName: step.indexName,
          columns: step.columns || [step.column],
          sql: this.generateCreateIndexSQL(step),
          riskLevel: 'low',
          dataLoss: false,
          description: `Recreate index dropped during forward migration`
        };

      case 'add_constraint':
        return {
          kind: 'drop_constraint_rollback',
          table: step.table,
          constraintName: step.constraintName,
          sql: `ALTER TABLE "${step.table}" DROP CONSTRAINT IF EXISTS "${step.constraintName}";`,
          riskLevel: 'medium',
          dataLoss: false,
          description: `Drop constraint added during forward migration`
        };

      case 'drop_constraint':
        return this.generateConstraintRollback(step);

      case 'enable_rls':
        return {
          kind: 'disable_rls_rollback',
          table: step.table,
          sql: `ALTER TABLE "${step.table}" DISABLE ROW LEVEL SECURITY;`,
          riskLevel: 'medium',
          dataLoss: false,
          description: `Disable RLS enabled during forward migration`
        };

      case 'create_policy':
        return {
          kind: 'drop_policy_rollback', 
          table: step.table,
          policyName: step.policyName,
          sql: `DROP POLICY IF EXISTS "${step.policyName}" ON "${step.table}";`,
          riskLevel: 'low',
          dataLoss: false,
          description: `Drop policy created during forward migration`
        };

      case 'create_partition':
        return {
          kind: 'drop_partition_rollback',
          parentTable: step.parentTable,
          partitionName: step.partitionName,
          sql: `DROP TABLE IF EXISTS "${step.partitionName}";`,
          riskLevel: 'high',
          dataLoss: true,
          description: `Drop partition created during forward migration`
        };

      case 'attach_partition':
        return {
          kind: 'detach_partition_rollback',
          parentTable: step.parentTable,
          partitionName: step.partitionName,
          sql: `ALTER TABLE "${step.parentTable}" DETACH PARTITION "${step.partitionName}";`,
          riskLevel: 'medium',
          dataLoss: false,
          description: `Detach partition attached during forward migration`
        };

      case 'detach_partition':
        return {
          kind: 'attach_partition_rollback',
          parentTable: step.parentTable, 
          partitionName: step.partitionName,
          partitionBounds: step.partitionBounds,
          sql: `ALTER TABLE "${step.parentTable}" ATTACH PARTITION "${step.partitionName}" ${step.partitionBounds};`,
          riskLevel: 'medium',
          dataLoss: false,
          description: `Re-attach partition detached during forward migration`
        };

      default:
        throw new Error(`Unknown operation type: ${step.kind}`);
    }
  }

  /**
   * Generate type change rollback
   * @param {Object} step - ALTER TYPE step
   * @returns {Object} Rollback step
   */
  generateTypeRollback(step) {
    const fromType = this.mapFieldTypeToSQL(step.to); // Reverse: rollback to original
    const toType = this.mapFieldTypeToSQL(step.from);
    
    // Check if rollback is safe (no data truncation)
    const isSafeRollback = this.isTypeRollbackSafe(step.to, step.from);
    
    if (!isSafeRollback) {
      throw new Error(`Type change from ${step.from.type} to ${step.to.type} cannot be safely rolled back - potential data truncation`);
    }
    
    let sql = `ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" TYPE ${toType}`;
    
    // Add USING clause if needed for type conversion
    const usingClause = this.generateTypeConversionUsing(step.to, step.from);
    if (usingClause) {
      sql += ` USING ${usingClause}`;
    }
    sql += ';';
    
    // Handle nullability changes
    const nullabilitySQL = this.generateNullabilityRollback(step);
    if (nullabilitySQL) {
      sql += '\n' + nullabilitySQL;
    }
    
    return {
      kind: 'alter_type_rollback',
      table: step.table,
      column: step.column,
      fromType: step.to.type,
      toType: step.from.type,
      sql,
      riskLevel: isSafeRollback ? 'medium' : 'high',
      dataLoss: !isSafeRollback,
      description: `Rollback type change from ${step.to.type} to ${step.from.type}`
    };
  }

  /**
   * Check if type rollback is safe (no data loss)
   * @param {Object} fromField - Original field type
   * @param {Object} toField - Target field type  
   * @returns {boolean} True if rollback is safe
   */
  isTypeRollbackSafe(fromField, toField) {
    const fromType = fromField.type;
    const toType = toField.type;
    
    // Safe rollbacks (no data truncation)
    const safeRollbacks = new Map([
      ['String', ['String', 'ID']], // text can go to varchar or uuid
      ['Int', ['Int', 'Float']], // int can become int or float
      ['Float', ['Float']], // float to float only
      ['Boolean', ['Boolean']], // boolean to boolean only
      ['DateTime', ['DateTime']], // timestamp to timestamp only
      ['ID', ['String', 'ID']] // uuid can become text or uuid
    ]);
    
    const allowedTargets = safeRollbacks.get(fromType) || [];
    return allowedTargets.includes(toType);
  }

  /**
   * Generate nullability rollback SQL
   * @param {Object} step - Alter type step
   * @returns {string} SQL for nullability changes
   */
  generateNullabilityRollback(step) {
    const sql = [];
    
    // Rollback nullability (reverse the forward change)
    if (step.from.nonNull && !step.to.nonNull) {
      // Forward made nullable, rollback to NOT NULL
      sql.push(`ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" SET NOT NULL;`);
    } else if (!step.from.nonNull && step.to.nonNull) {
      // Forward made NOT NULL, rollback to nullable
      sql.push(`ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" DROP NOT NULL;`);
    }
    
    return sql.join('\n');
  }

  /**
   * Generate constraint recreation rollback
   * @param {Object} step - Drop constraint step
   * @returns {Object} Rollback step
   */
  generateConstraintRollback(step) {
    // This requires the original constraint definition
    // In practice, this should be captured during forward migration planning
    if (!step.originalDefinition) {
      throw new Error(`Cannot rollback constraint drop - original definition not captured`);
    }
    
    return {
      kind: 'add_constraint_rollback',
      table: step.table,
      constraintName: step.constraintName,
      constraintType: step.constraintType,
      sql: step.originalDefinition,
      riskLevel: 'medium',
      dataLoss: false,
      description: `Recreate constraint dropped during forward migration`
    };
  }

  /**
   * Generate data preservation steps for destructive operations
   * @param {Object} step - Migration step
   * @returns {Object} Data preservation step
   */
  generateDataPreservation(step) {
    switch (step.kind) {
      case 'drop_table':
        return {
          kind: 'backup_table',
          table: step.table,
          backupTable: `${step.table}_backup_${Date.now()}`,
          sql: `CREATE TABLE "${step.table}_backup_${Date.now()}" AS SELECT * FROM "${step.table}";`,
          description: `Backup table ${step.table} before dropping`
        };

      case 'drop_column':
        return {
          kind: 'backup_column',
          table: step.table,
          column: step.column,
          backupTable: `${step.table}_${step.column}_backup_${Date.now()}`,
          sql: `CREATE TABLE "${step.table}_${step.column}_backup_${Date.now()}" AS SELECT "${step.column}" FROM "${step.table}";`,
          description: `Backup column ${step.column} before dropping`
        };

      case 'alter_type':
        if (!this.isTypeRollbackSafe(step.from, step.to)) {
          return {
            kind: 'backup_column_values',
            table: step.table,
            column: step.column,
            backupTable: `${step.table}_${step.column}_values_${Date.now()}`,
            sql: `CREATE TABLE "${step.table}_${step.column}_values_${Date.now()}" AS SELECT id, "${step.column}" FROM "${step.table}";`,
            description: `Backup column values before potentially unsafe type change`
          };
        }
        break;

      default:
        return null;
    }
  }

  /**
   * Generate safety checks for rollback execution
   * @param {Array} forwardSteps - Forward migration steps
   * @returns {Array} Safety check steps
   */
  generateSafetyChecks(forwardSteps) {
    const checks = [];
    
    // Check for foreign key dependencies before dropping tables
    const tablesToDrop = forwardSteps.filter(s => s.kind === 'create_table').map(s => s.table);
    
    for (const table of tablesToDrop) {
      checks.push({
        kind: 'foreign_key_dependency_check',
        table,
        sql: `
          SELECT 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
          WHERE constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name='${table}';
        `,
        description: `Check for foreign key dependencies before dropping table ${table}`,
        failureAction: 'abort_rollback'
      });
    }
    
    // Check for data existence before destructive operations
    checks.push({
      kind: 'data_existence_check',
      description: 'Verify tables contain expected data before rollback',
      sql: forwardSteps
        .filter(s => s.kind === 'create_table')
        .map(s => `SELECT '${s.table}' as table_name, COUNT(*) as row_count FROM "${s.table}"`)
        .join('\nUNION ALL\n'),
      failureAction: 'warn_and_continue'
    });
    
    return checks;
  }

  /**
   * Calculate rollback risk level
   * @param {Array} rollbackSteps - Generated rollback steps
   * @param {Array} warnings - Rollback warnings
   * @returns {string} Risk level: 'low', 'medium', 'high', 'critical'  
   */
  calculateRollbackRisk(rollbackSteps, warnings = []) {
    let riskScore = 0;
    let dataLossSteps = 0;
    
    // If there are error warnings, the rollback is automatically critical
    const errorWarnings = warnings.filter(w => w.severity === 'error');
    if (errorWarnings.length > 0) {
      return 'critical';
    }
    
    for (const step of rollbackSteps) {
      switch (step.riskLevel) {
        case 'low': riskScore += 1; break;
        case 'medium': riskScore += 3; break;
        case 'high': riskScore += 5; break;
        case 'critical': riskScore += 8; break;
      }
      
      if (step.dataLoss) {
        dataLossSteps++;
        riskScore += 3;
      }
    }
    
    // Any data loss makes rollback at least medium risk
    if (dataLossSteps > 0) {
      riskScore = Math.max(riskScore, 6);
    }
    
    const avgRisk = rollbackSteps.length > 0 ? riskScore / rollbackSteps.length : 0;
    
    if (avgRisk <= 2) return 'low';
    if (avgRisk <= 4) return 'medium';
    if (avgRisk <= 6) return 'high';
    return 'critical';
  }

  /**
   * Check if step requires data preservation
   * @param {Object} step - Migration step
   * @returns {boolean} True if data preservation needed
   */
  requiresDataPreservation(step) {
    return this.DATA_LOSS_OPERATIONS.has(step.kind);
  }

  /**
   * Map field types to SQL types
   * @param {Object} field - Field object
   * @returns {string} SQL type definition
   */
  mapFieldTypeToSQL(field) {
    const typeMap = {
      ID: 'uuid',
      String: 'text', 
      Int: 'integer',
      Float: 'double precision',
      Boolean: 'boolean',
      DateTime: 'timestamptz'
    };
    
    let sqlType = typeMap[field.type] || 'text';
    
    // Handle arrays
    if (field.list) {
      sqlType += '[]';
    }
    
    return sqlType;
  }

  /**
   * Generate CREATE INDEX SQL for rollback
   * @param {Object} step - Drop index step
   * @returns {string} CREATE INDEX SQL
   */
  generateCreateIndexSQL(step) {
    const indexName = step.indexName;
    const tableName = step.table;
    const columns = Array.isArray(step.columns) ? step.columns : [step.column];
    
    let sql = `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}"`;
    sql += ` (${columns.map(c => `"${c}"`).join(', ')})`;
    
    if (step.unique) {
      sql = sql.replace('CREATE INDEX', 'CREATE UNIQUE INDEX');
    }
    
    if (step.whereClause) {
      sql += ` WHERE ${step.whereClause}`;
    }
    
    return sql + ';';
  }

  /**
   * Generate type conversion USING clause
   * @param {Object} fromField - Source field type
   * @param {Object} toField - Target field type
   * @returns {string} USING clause or null
   */
  generateTypeConversionUsing(fromField, toField) {
    const fromType = fromField.type;
    const toType = toField.type;
    const columnName = `"${fromField.name || toField.name}"`;
    
    // Common type conversions that need explicit USING clauses
    const conversions = new Map([
      ['String_ID', `${columnName}::uuid`],
      ['ID_String', `${columnName}::text`],
      ['Int_String', `${columnName}::text`],
      ['Float_Int', `${columnName}::integer`],
      ['String_Int', `${columnName}::integer`],
      ['String_Float', `${columnName}::double precision`]
    ]);
    
    const conversionKey = `${fromType}_${toType}`;
    return conversions.get(conversionKey) || null;
  }

  /**
   * Generate complete rollback script
   * @param {Object} rollbackResult - Result from generateRollback
   * @returns {string} Complete SQL rollback script
   */
  generateRollbackScript(rollbackResult) {
    const sections = [];
    
    // Header
    sections.push('-- ROLLBACK SCRIPT');
    sections.push('-- Generated automatically - review before execution');
    sections.push(`-- Risk Level: ${rollbackResult.riskLevel.toUpperCase()}`);
    sections.push('-- WARNING: This script may cause data loss');
    sections.push('');
    
    // Safety checks
    if (rollbackResult.safetyChecks.length > 0) {
      sections.push('-- SAFETY CHECKS');
      sections.push('-- Execute these first to verify rollback is safe');
      rollbackResult.safetyChecks.forEach(check => {
        sections.push(`-- ${check.description}`);
        sections.push(check.sql);
        sections.push('');
      });
    }
    
    // Data preservation (execute BEFORE rollback)
    if (rollbackResult.dataPreservationSteps.length > 0) {
      sections.push('-- DATA PRESERVATION STEPS');
      sections.push('-- Execute these BEFORE running rollback to preserve data');
      rollbackResult.dataPreservationSteps.forEach(step => {
        sections.push(`-- ${step.description}`);
        sections.push(step.sql);
        sections.push('');
      });
    }
    
    // Rollback steps
    sections.push('-- ROLLBACK STEPS');
    sections.push('BEGIN;');
    sections.push('');
    
    rollbackResult.rollbackSteps.forEach(step => {
      sections.push(`-- ${step.description} (Risk: ${step.riskLevel})`);
      sections.push(step.sql);
      sections.push('');
    });
    
    sections.push('COMMIT;');
    
    // Warnings
    if (rollbackResult.warnings.length > 0) {
      sections.push('');
      sections.push('-- WARNINGS');
      rollbackResult.warnings.forEach(warning => {
        sections.push(`-- ${warning.severity.toUpperCase()}: ${warning.warning}`);
      });
    }
    
    return sections.join('\n');
  }
}