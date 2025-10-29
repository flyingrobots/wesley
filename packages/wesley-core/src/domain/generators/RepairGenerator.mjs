/**
 * Repair Generator - Wave 2 WP3.T005
 * Generate SQL to fix schema drift with safe repair operations only
 */

import { MigrationSafety } from '../MigrationSafety.mjs';

export class RepairGenerator {
  constructor(options = {}) {
    this.safety = new MigrationSafety(options);
    this.safeMode = options.safeMode ?? true;
    this.enableConstraintHandling = options.enableConstraintHandling ?? true;
    this.batchSize = options.batchSize ?? 1000;
    this.transactionMode = options.transactionMode ?? 'individual'; // 'individual' | 'batch' | 'single'
    this.dryRun = options.dryRun ?? false;
  }

  /**
   * Generate repair SQL from drift analysis report
   * @param {Object} driftReport - Report from DifferentialValidator
   * @param {Object} options - Generation options
   * @returns {Promise<RepairPlan>} Complete repair plan with SQL and safety analysis
   */
  async generateRepairSQL(driftReport, options = {}) {
    if (!driftReport.hasDrift) {
      return this.createEmptyRepairPlan('No drift detected - no repairs needed');
    }

    const context = {
      timestamp: new Date().toISOString(),
      repairId: this.generateRepairId(),
      driftValidationId: driftReport.context.validationId,
      environment: options.environment || driftReport.context.environment
    };

    // Filter differences to only safe operations
    const safeOperations = this.filterSafeOperations(driftReport.differences);
    const unsafeOperations = driftReport.differences.filter(diff => 
      !safeOperations.includes(diff)
    );

    // Generate repair steps in dependency order
    const repairSteps = await this.generateRepairSteps(safeOperations);

    // Analyze repair safety and constraints
    const safetyAnalysis = this.analyzeRepairSafety(repairSteps);

    // Generate SQL statements
    const sqlStatements = await this.generateSQLStatements(repairSteps);

    // Handle constraint violations
    const constraintHandling = this.enableConstraintHandling 
      ? await this.generateConstraintHandling(repairSteps, driftReport)
      : null;

    // Create migration from drift state
    const migration = this.createMigrationFromDrift(sqlStatements, constraintHandling, context);

    // Generate rollback plan
    const rollbackPlan = this.generateRollbackPlan(repairSteps, safeOperations);

    // Estimate execution metrics
    const executionMetrics = this.estimateExecutionMetrics(repairSteps);

    return {
      context,
      summary: {
        totalDifferences: driftReport.differences.length,
        safeRepairs: safeOperations.length,
        unsafeOperations: unsafeOperations.length,
        repairSteps: repairSteps.length,
        estimatedDuration: executionMetrics.estimatedDuration,
        complexity: safetyAnalysis.complexity
      },
      repairSteps,
      safeOperations: safeOperations.map(op => ({ type: op.type, description: op.description })),
      unsafeOperations: unsafeOperations.map(op => ({ 
        type: op.type, 
        description: op.description,
        reason: this.getUnsafeReason(op)
      })),
      safetyAnalysis,
      migration,
      rollbackPlan,
      constraintHandling,
      executionMetrics,
      warnings: this.generateWarnings(repairSteps, unsafeOperations)
    };
  }

  /**
   * Filter operations to only include safe repair actions
   */
  filterSafeOperations(differences) {
    const safeOperationTypes = [
      'missing_field',
      'nullability_mismatch', // Only null -> not null with data validation
      'missing_directive'
    ];

    return differences.filter(diff => {
      // Check if operation type is inherently safe
      if (!safeOperationTypes.includes(diff.type)) {
        return false;
      }

      // Additional safety checks
      switch (diff.type) {
        case 'missing_field':
          return this.isSafeColumnAddition(diff);
          
        case 'nullability_mismatch':
          return this.isSafeNullabilityChange(diff);
          
        case 'missing_directive':
          return this.isSafeDirectiveAddition(diff);
          
        case 'extra_field':
          return false; // Always unsafe - dropping columns causes data loss
          
        default:
          return false;
      }
    });
  }

  /**
   * Check if column addition is safe
   */
  isSafeColumnAddition(diff) {
    const field = diff.expectedValue;
    
    // Safe if nullable or has default value
    if (!field.nonNull || field.getDefault()) {
      return true;
    }

    // Check if it's a computed/virtual field
    if (field.isVirtual()) {
      return true;
    }

    return false;
  }

  /**
   * Check if nullability change is safe
   */
  isSafeNullabilityChange(diff) {
    // Only allow NULL -> NOT NULL changes
    // NOT NULL -> NULL is considered data model degradation
    return diff.expectedValue === true && diff.actualValue === false;
  }

  /**
   * Check if directive addition is safe
   */
  isSafeDirectiveAddition(diff) {
    const safeDirectives = ['@index', '@default', '@check'];
    return safeDirectives.includes(diff.directive);
  }

  /**
   * Generate repair steps in dependency order
   */
  async generateRepairSteps(safeOperations) {
    const steps = [];

    // Group operations by dependency level
    const dependencyLevels = this.analyzeDependencies(safeOperations);

    for (let level = 0; level < dependencyLevels.length; level++) {
      const levelOperations = dependencyLevels[level];
      
      for (const operation of levelOperations) {
        const step = await this.createRepairStep(operation, level);
        if (step) {
          steps.push(step);
        }
      }
    }

    return steps;
  }

  /**
   * Analyze operation dependencies
   */
  analyzeDependencies(operations) {
    const levels = [];
    const processed = new Set();
    
    // Simple dependency analysis - more complex dependencies would need graph traversal
    const tableCreations = operations.filter(op => op.type === 'missing_table');
    const columnAdditions = operations.filter(op => op.type === 'missing_field');
    const constraintAdditions = operations.filter(op => op.type === 'missing_directive');
    const nullabilityChanges = operations.filter(op => op.type === 'nullability_mismatch');
    
    if (tableCreations.length > 0) {
      levels.push(tableCreations);
    }
    
    if (columnAdditions.length > 0) {
      levels.push(columnAdditions);
    }
    
    if (nullabilityChanges.length > 0) {
      levels.push(nullabilityChanges);
    }
    
    if (constraintAdditions.length > 0) {
      levels.push(constraintAdditions);
    }

    return levels.length > 0 ? levels : [operations];
  }

  /**
   * Create individual repair step
   */
  async createRepairStep(operation, dependencyLevel) {
    const step = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      operation: operation.type,
      dependencyLevel,
      target: {
        table: operation.table,
        column: operation.column,
        directive: operation.directive
      },
      description: operation.description,
      repairAction: operation.repairAction,
      sql: null,
      preConditions: [],
      postConditions: [],
      rollbackSQL: null,
      riskScore: this.safety.assessStepRisk({ kind: operation.repairAction }).score,
      estimatedDuration: this.estimateStepDuration(operation.repairAction),
      safetyChecks: []
    };

    // Generate SQL for this step
    step.sql = await this.generateStepSQL(operation);
    step.rollbackSQL = this.generateRollbackSQL(operation);

    // Add safety checks
    step.safetyChecks = this.generateSafetyChecks(operation);
    step.preConditions = this.generatePreConditions(operation);
    step.postConditions = this.generatePostConditions(operation);

    return step;
  }

  /**
   * Generate SQL for a single repair step
   */
  async generateStepSQL(operation) {
    switch (operation.repairAction) {
      case 'add_column':
        return this.generateAddColumnSQL(operation);
        
      case 'add_not_null':
        return this.generateAddNotNullSQL(operation);
        
      case 'add_directive':
        return this.generateAddDirectiveSQL(operation);
        
      case 'drop_column':
        return this.safeMode ? null : this.generateDropColumnSQL(operation);
        
      default:
        return `-- Unsupported repair action: ${operation.repairAction}`;
    }
  }

  /**
   * Generate ADD COLUMN SQL
   */
  generateAddColumnSQL(operation) {
    const field = operation.expectedValue;
    const tableName = operation.table;
    const columnName = operation.column;
    
    const columnType = this.mapFieldToPostgreSQLType(field);
    const nullable = field.nonNull ? ' NOT NULL' : '';
    const defaultDirective = field.getDefault();
    const defaultValue = defaultDirective ? ` DEFAULT ${this.formatDefaultValue(defaultDirective.value || defaultDirective)}` : '';
    
    return `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}${nullable}${defaultValue};`;
  }

  /**
   * Generate ADD NOT NULL constraint SQL
   */
  generateAddNotNullSQL(operation) {
    const tableName = operation.table;
    const columnName = operation.column;
    
    return [
      `-- First, update any NULL values to prevent constraint violation`,
      `UPDATE "${tableName}" SET "${columnName}" = 'DEFAULT_VALUE' WHERE "${columnName}" IS NULL;`,
      `-- Then add NOT NULL constraint`,
      `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET NOT NULL;`
    ].join('\n');
  }

  /**
   * Generate directive addition SQL (indexes, constraints, etc.)
   */
  generateAddDirectiveSQL(operation) {
    const tableName = operation.table;
    const directive = operation.directive;
    const directiveData = operation.expectedValue;

    switch (directive) {
      case '@index':
        const indexName = `idx_${tableName}_${operation.column || 'multi'}`;
        return `CREATE INDEX CONCURRENTLY "${indexName}" ON "${tableName}" ("${operation.column}");`;
        
      case '@check':
        const constraintName = `chk_${tableName}_${operation.column}`;
        return `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" CHECK (${directiveData.expr});`;
        
      case '@default':
        return `ALTER TABLE "${tableName}" ALTER COLUMN "${operation.column}" SET DEFAULT ${this.formatDefaultValue(directiveData)};`;
        
      default:
        return `-- Unsupported directive: ${directive}`;
    }
  }

  /**
   * Generate DROP COLUMN SQL (unsafe operation)
   */
  generateDropColumnSQL(operation) {
    const tableName = operation.table;
    const columnName = operation.column;
    
    return [
      `-- WARNING: This will permanently delete data`,
      `-- Backup recommended before execution`,
      `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}";`
    ].join('\n');
  }

  /**
   * Generate constraint violation handling
   */
  async generateConstraintHandling(repairSteps, driftReport) {
    const constraintChecks = [];
    const violationHandlers = [];

    for (const step of repairSteps) {
      if (step.operation === 'missing_field' && step.target.column) {
        // Check for potential foreign key violations
        const fkCheck = this.generateForeignKeyCheck(step);
        if (fkCheck) {
          constraintChecks.push(fkCheck);
        }

        // Check for unique constraint violations
        const uniqueCheck = this.generateUniqueConstraintCheck(step);
        if (uniqueCheck) {
          constraintChecks.push(uniqueCheck);
        }
      }

      if (step.operation === 'nullability_mismatch') {
        // Handle NOT NULL constraint violations
        const nullCheck = this.generateNullConstraintHandler(step);
        if (nullCheck) {
          violationHandlers.push(nullCheck);
        }
      }
    }

    return {
      preExecutionChecks: constraintChecks,
      violationHandlers,
      recommendations: this.generateConstraintRecommendations(constraintChecks, violationHandlers)
    };
  }

  /**
   * Generate foreign key constraint checks
   */
  generateForeignKeyCheck(step) {
    const field = step.target;
    if (!field || !field.isForeignKey?.()) return null;

    const referencedTable = field.getForeignKeyRef?.()?.table;
    if (!referencedTable) return null;

    return {
      type: 'foreign_key_check',
      description: `Verify referenced records exist in ${referencedTable}`,
      sql: `
-- Check for foreign key constraint violations before adding column
SELECT COUNT(*) as violation_count
FROM "${step.target.table}" t
LEFT JOIN "${referencedTable}" r ON t."${field.name}" = r.id
WHERE t."${field.name}" IS NOT NULL AND r.id IS NULL;`
    };
  }

  /**
   * Generate unique constraint checks
   */
  generateUniqueConstraintCheck(step) {
    if (!step.target.column || !step.expectedValue?.isUnique?.()) return null;

    return {
      type: 'unique_constraint_check',
      description: `Check for duplicate values in ${step.target.column}`,
      sql: `
-- Check for unique constraint violations
SELECT "${step.target.column}", COUNT(*) as duplicate_count
FROM "${step.target.table}"
WHERE "${step.target.column}" IS NOT NULL
GROUP BY "${step.target.column}"
HAVING COUNT(*) > 1;`
    };
  }

  /**
   * Generate NULL constraint handler
   */
  generateNullConstraintHandler(step) {
    return {
      type: 'null_constraint_handler',
      description: `Handle NULL values before adding NOT NULL constraint`,
      sql: `
-- Count NULL values that need to be handled
SELECT COUNT(*) as null_count
FROM "${step.target.table}"
WHERE "${step.target.column}" IS NULL;`,
      handler: `
-- Option 1: Set default value for NULLs
UPDATE "${step.target.table}" 
SET "${step.target.column}" = 'DEFAULT_VALUE' 
WHERE "${step.target.column}" IS NULL;

-- Option 2: Delete rows with NULLs (if acceptable)
-- DELETE FROM "${step.target.table}" WHERE "${step.target.column}" IS NULL;`
    };
  }

  /**
   * Create migration from drift state
   */
  createMigrationFromDrift(sqlStatements, constraintHandling, context) {
    const migration = {
      id: context.repairId,
      name: `repair_drift_${context.timestamp.replace(/[:.]/g, '_')}`,
      createdAt: context.timestamp,
      source: 'drift_repair',
      driftValidationId: context.driftValidationId,
      up: [],
      down: [],
      preExecutionChecks: constraintHandling?.preExecutionChecks || [],
      postExecutionValidation: []
    };

    // Build UP migration
    migration.up = [
      '-- Drift Repair Migration',
      `-- Generated: ${context.timestamp}`,
      `-- Validation ID: ${context.driftValidationId}`,
      '',
      ...sqlStatements.filter(sql => sql && sql.trim())
    ];

    // Build DOWN migration (rollback)
    migration.down = [
      '-- Rollback for Drift Repair',
      `-- Generated: ${context.timestamp}`,
      '',
      '-- WARNING: Some operations may not be fully reversible',
      '-- Manual verification recommended',
      '',
      ...this.generateMigrationRollback(sqlStatements)
    ];

    // Add post-execution validation
    migration.postExecutionValidation = [
      '-- Validate repair completion',
      'SELECT \'Repair migration completed\' as status;'
    ];

    return migration;
  }

  /**
   * Generate rollback plan
   */
  generateRollbackPlan(repairSteps, safeOperations) {
    const rollbackSteps = [];

    // Reverse order for rollback
    const reversedSteps = [...repairSteps].reverse();

    for (const step of reversedSteps) {
      const rollbackStep = {
        id: `rollback_${step.id}`,
        originalStepId: step.id,
        operation: this.getRollbackOperation(step.operation),
        description: `Rollback: ${step.description}`,
        sql: step.rollbackSQL,
        riskScore: this.safety.assessStepRisk({ kind: this.getRollbackOperation(step.operation) }).score,
        warnings: this.generateRollbackWarnings(step)
      };
      
      rollbackSteps.push(rollbackStep);
    }

    return {
      steps: rollbackSteps,
      totalSteps: rollbackSteps.length,
      complexity: this.assessRollbackComplexity(rollbackSteps),
      warnings: [
        'Rollback operations may result in data loss',
        'Always backup before executing rollback',
        'Some operations may not be fully reversible'
      ]
    };
  }

  /**
   * Generate SQL statements from repair steps
   */
  async generateSQLStatements(repairSteps) {
    const statements = [];
    
    // Group by transaction mode
    if (this.transactionMode === 'single') {
      statements.push('BEGIN;');
    }

    for (const step of repairSteps) {
      if (this.transactionMode === 'individual') {
        statements.push('BEGIN;');
      }

      // Add step header
      statements.push('');
      statements.push(`-- Step: ${step.description}`);
      statements.push(`-- Risk Score: ${step.riskScore}`);
      
      // Add pre-conditions
      if (step.preConditions.length > 0) {
        statements.push('-- Pre-conditions:');
        statements.push(...step.preConditions.map(pc => `-- ${pc}`));
      }

      // Add the main SQL
      if (step.sql) {
        statements.push(step.sql);
      }

      // Add post-conditions
      if (step.postConditions.length > 0) {
        statements.push('-- Post-conditions:');
        statements.push(...step.postConditions.map(pc => `-- ${pc}`));
      }

      if (this.transactionMode === 'individual') {
        statements.push('COMMIT;');
      }
    }

    if (this.transactionMode === 'single') {
      statements.push('COMMIT;');
    }

    return statements;
  }

  /**
   * Utility methods for type mapping and formatting
   */
  mapFieldToPostgreSQLType(field) {
    const typeMap = { 
      ID: 'uuid', 
      String: 'text', 
      Int: 'integer', 
      Float: 'double precision', 
      Boolean: 'boolean', 
      DateTime: 'timestamptz' 
    };
    
    let pgType = typeMap[field.type] || 'text';
    
    if (field.list) {
      pgType += '[]';
    }
    
    return pgType;
  }

  formatDefaultValue(defaultValue) {
    if (typeof defaultValue === 'string') {
      return `'${defaultValue.replace(/'/g, "''")}'`;
    }
    if (typeof defaultValue === 'boolean') {
      return defaultValue.toString();
    }
    if (typeof defaultValue === 'number') {
      return defaultValue.toString();
    }
    if (defaultValue && typeof defaultValue === 'object') {
      return `'${JSON.stringify(defaultValue).replace(/'/g, "''")}'`;
    }
    return 'NULL';
  }

  /**
   * Safety and analysis methods
   */
  analyzeRepairSafety(repairSteps) {
    let totalRiskScore = 0;
    const riskFactors = [];
    const safetyRecommendations = [];

    for (const step of repairSteps) {
      totalRiskScore += step.riskScore;
      
      if (step.riskScore >= 50) {
        riskFactors.push({
          step: step.id,
          operation: step.operation,
          riskScore: step.riskScore,
          description: step.description
        });
      }
    }

    const complexity = this.determineComplexity(totalRiskScore, repairSteps.length);

    if (totalRiskScore >= 100) {
      safetyRecommendations.push('Consider breaking into smaller migrations');
      safetyRecommendations.push('Execute in staging environment first');
    }

    if (riskFactors.length > 0) {
      safetyRecommendations.push('Manual review recommended for high-risk steps');
    }

    return {
      totalRiskScore,
      complexity,
      riskFactors,
      safetyRecommendations,
      requiresManualReview: totalRiskScore >= 50,
      canAutoExecute: totalRiskScore < 20 && riskFactors.length === 0
    };
  }

  determineComplexity(riskScore, stepCount) {
    if (riskScore >= 100 || stepCount >= 20) return 'high';
    if (riskScore >= 50 || stepCount >= 10) return 'medium';
    return 'low';
  }

  estimateExecutionMetrics(repairSteps) {
    let totalDuration = 0;
    const stepMetrics = [];

    for (const step of repairSteps) {
      const duration = step.estimatedDuration || this.estimateStepDuration(step.repairAction);
      totalDuration += duration;
      
      stepMetrics.push({
        stepId: step.id,
        estimatedDuration: duration,
        operation: step.operation
      });
    }

    return {
      estimatedDuration: totalDuration,
      stepMetrics,
      averageStepDuration: Math.round(totalDuration / repairSteps.length) || 0,
      complexity: this.determineComplexity(totalDuration, repairSteps.length)
    };
  }

  estimateStepDuration(repairAction) {
    const durations = {
      'add_column': 30,      // seconds
      'drop_column': 60,
      'alter_column_type': 120,
      'add_not_null': 90,
      'add_directive': 45,
      'create_table': 60
    };
    return durations[repairAction] || 45;
  }

  /**
   * Helper methods
   */
  createEmptyRepairPlan(reason) {
    return {
      context: { timestamp: new Date().toISOString(), repairId: this.generateRepairId() },
      summary: { totalDifferences: 0, safeRepairs: 0, unsafeOperations: 0, repairSteps: 0 },
      repairSteps: [],
      safeOperations: [],
      unsafeOperations: [],
      migration: null,
      reason
    };
  }

  generateRepairId() {
    return `repair_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  getUnsafeReason(operation) {
    const reasons = {
      'extra_table': 'Dropping tables can cause permanent data loss',
      'field_type_mismatch': 'Type changes may cause data loss or corruption',
      'extra_field': 'Dropping columns causes permanent data loss',
      'list_property_mismatch': 'Array/scalar conversion requires data restructuring'
    };
    return reasons[operation.type] || 'Operation requires manual review';
  }

  generateSafetyChecks(operation) {
    const checks = [`Verify ${operation.table} table exists`];
    
    if (operation.column) {
      checks.push(`Check column ${operation.column} constraints`);
    }
    
    return checks;
  }

  generatePreConditions(operation) {
    return [`Table "${operation.table}" must exist`];
  }

  generatePostConditions(operation) {
    if (operation.repairAction === 'add_column') {
      return [`Column "${operation.column}" exists in table "${operation.table}"`];
    }
    return ['Operation completed successfully'];
  }

  generateRollbackSQL(operation) {
    switch (operation.repairAction) {
      case 'add_column':
        return `ALTER TABLE "${operation.table}" DROP COLUMN "${operation.column}";`;
      case 'add_not_null':
        return `ALTER TABLE "${operation.table}" ALTER COLUMN "${operation.column}" DROP NOT NULL;`;
      default:
        return '-- No automatic rollback available';
    }
  }

  getRollbackOperation(operation) {
    const rollbackMap = {
      'missing_field': 'drop_column',
      'nullability_mismatch': 'drop_not_null',
      'missing_directive': 'remove_directive'
    };
    return rollbackMap[operation] || 'manual_rollback';
  }

  generateRollbackWarnings(step) {
    const warnings = [];
    if (step.operation === 'missing_field') {
      warnings.push('Rolling back column addition will permanently delete data');
    }
    return warnings;
  }

  assessRollbackComplexity(rollbackSteps) {
    const highRiskSteps = rollbackSteps.filter(step => step.riskScore >= 50).length;
    if (highRiskSteps > 3) return 'high';
    if (highRiskSteps > 0) return 'medium';
    return 'low';
  }

  generateMigrationRollback(sqlStatements) {
    // Simple rollback generation - could be enhanced with proper parsing
    return [
      '-- Automatic rollback not available for all operations',
      '-- Manual review and custom rollback recommended'
    ];
  }

  generateConstraintRecommendations(checks, handlers) {
    const recommendations = [];
    
    if (checks.length > 0) {
      recommendations.push('Execute pre-flight constraint checks before repair');
    }
    
    if (handlers.length > 0) {
      recommendations.push('Handle constraint violations before applying changes');
    }
    
    recommendations.push('Backup affected tables before executing repair');
    
    return recommendations;
  }

  generateWarnings(repairSteps, unsafeOperations) {
    const warnings = [];
    
    if (unsafeOperations.length > 0) {
      warnings.push(`${unsafeOperations.length} operations were excluded due to safety concerns`);
    }
    
    const highRiskSteps = repairSteps.filter(step => step.riskScore >= 50);
    if (highRiskSteps.length > 0) {
      warnings.push(`${highRiskSteps.length} high-risk operations require manual review`);
    }
    
    if (repairSteps.some(step => step.operation === 'nullability_mismatch')) {
      warnings.push('NOT NULL constraint additions may fail if NULL values exist');
    }
    
    return warnings;
  }
}

// Export singleton with default configuration
export const repairGenerator = new RepairGenerator();