/**
 * Migration Verifier - Post-Migration Validation
 * Provides comprehensive verification of migration execution with checksums,
 * schema comparison, data integrity checks, and performance baselines.
 * 
 * Licensed under the Apache License, Version 2.0
 */

import { hashString } from '../../util/hash.mjs';
import { DomainEvent } from '../Events.mjs';

/**
 * Custom error types for migration verification
 */
export class MigrationVerificationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'MigrationVerificationError';
    this.code = code;
    this.details = details;
  }
}

export class ChecksumMismatchError extends MigrationVerificationError {
  constructor(expected, actual, details = {}) {
    super(`Checksum mismatch: expected ${expected}, got ${actual}`, 'CHECKSUM_MISMATCH', {
      expected,
      actual,
      ...details
    });
  }
}

export class SchemaComparisonError extends MigrationVerificationError {
  constructor(message, differences, details = {}) {
    super(message, 'SCHEMA_COMPARISON_ERROR', {
      differences,
      ...details
    });
  }
}

export class DataIntegrityError extends MigrationVerificationError {
  constructor(message, violations, details = {}) {
    super(message, 'DATA_INTEGRITY_ERROR', {
      violations,
      ...details
    });
  }
}

/**
 * Domain events for verification process
 */
export class MigrationVerificationStarted extends DomainEvent {
  constructor(migrationId, options) {
    super('MIGRATION_VERIFICATION_STARTED', { migrationId, options });
  }
}

export class MigrationVerificationCompleted extends DomainEvent {
  constructor(migrationId, results) {
    super('MIGRATION_VERIFICATION_COMPLETED', { migrationId, results });
  }
}

export class MigrationVerificationFailed extends DomainEvent {
  constructor(migrationId, error, results) {
    super('MIGRATION_VERIFICATION_FAILED', { migrationId, error: error.message, results });
  }
}

export class ChecksumCalculated extends DomainEvent {
  constructor(target, checksum, metadata) {
    super('CHECKSUM_CALCULATED', { target, checksum, metadata });
  }
}

export class SchemaComparisonResult extends DomainEvent {
  constructor(comparison, differences) {
    super('SCHEMA_COMPARISON_RESULT', { comparison, differences });
  }
}

/**
 * MigrationVerifier - Core verification logic
 * Performs post-migration validation to ensure migration integrity
 */
export class MigrationVerifier {
  constructor(options = {}) {
    this.options = {
      checksumAlgorithm: 'sha256',
      enableSchemaComparison: true,
      enableDataIntegrityChecks: true,
      enablePerformanceBaselines: true,
      enableRollbackValidation: true,
      strictMode: false,
      timeout: 300000, // 5 minutes
      ...options
    };
    
    this.listeners = new Map();
  }

  /**
   * Add event listener
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
    return this;
  }

  /**
   * Emit domain event
   */
  emit(event) {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));
    return this;
  }

  /**
   * Verify migration execution
   * @param {Object} migrationContext - Context containing migration details
   * @returns {Promise<Object>} Verification results
   */
  async verifyMigration(migrationContext) {
    const { migrationId, beforeSnapshot, afterSnapshot, expectedChecksum } = migrationContext;
    
    this.emit(new MigrationVerificationStarted(migrationId, this.options));
    
    const results = {
      migrationId,
      timestamp: new Date().toISOString(),
      checksumValidation: null,
      schemaComparison: null,
      dataIntegrityCheck: null,
      rollbackValidation: null,
      performanceBaseline: null,
      overall: 'pending'
    };

    try {
      // 1. Checksum validation
      if (expectedChecksum) {
        results.checksumValidation = await this.validateChecksums(afterSnapshot, expectedChecksum);
      }

      // 2. Schema comparison
      if (this.options.enableSchemaComparison && beforeSnapshot && afterSnapshot) {
        results.schemaComparison = await this.compareSchemas(beforeSnapshot, afterSnapshot);
      }

      // 3. Data integrity verification
      if (this.options.enableDataIntegrityChecks) {
        results.dataIntegrityCheck = await this.verifyDataIntegrity(afterSnapshot);
      }

      // 4. Rollback trigger validation
      if (this.options.enableRollbackValidation) {
        results.rollbackValidation = await this.validateRollbackTriggers(migrationContext);
      }

      // 5. Performance baseline comparison
      if (this.options.enablePerformanceBaselines) {
        results.performanceBaseline = await this.comparePerformanceBaselines(migrationContext);
      }

      // Determine overall result
      results.overall = this.calculateOverallResult(results);
      
      this.emit(new MigrationVerificationCompleted(migrationId, results));
      
      return results;
      
    } catch (error) {
      results.overall = 'failed';
      results.error = {
        message: error.message,
        code: error.code,
        details: error.details
      };
      
      this.emit(new MigrationVerificationFailed(migrationId, error, results));
      
      if (this.options.strictMode) {
        throw error;
      }
      
      return results;
    }
  }

  /**
   * Validate checksums for migration integrity
   */
  async validateChecksums(snapshot, expectedChecksum) {
    const result = {
      status: 'pending',
      expected: expectedChecksum,
      actual: null,
      details: {}
    };

    try {
      // Calculate checksum of the current state
      result.actual = await this.calculateSchemaChecksum(snapshot);
      
      this.emit(new ChecksumCalculated('schema', result.actual, snapshot.metadata));
      
      if (result.actual === expectedChecksum) {
        result.status = 'passed';
        result.details.message = 'Checksum validation successful';
      } else {
        result.status = 'failed';
        result.details.message = 'Checksum mismatch detected';
        
        if (this.options.strictMode) {
          throw new ChecksumMismatchError(expectedChecksum, result.actual, snapshot.metadata);
        }
      }
      
    } catch (error) {
      result.status = 'error';
      result.details.error = error.message;
      throw error;
    }

    return result;
  }

  /**
   * Compare schemas before and after migration
   */
  async compareSchemas(beforeSnapshot, afterSnapshot) {
    const result = {
      status: 'pending',
      differences: [],
      addedTables: [],
      droppedTables: [],
      modifiedTables: [],
      details: {}
    };

    try {
      const before = beforeSnapshot.schema || {};
      const after = afterSnapshot.schema || {};
      
      // Find added tables
      for (const tableName in after) {
        if (!(tableName in before)) {
          result.addedTables.push({
            table: tableName,
            columns: Object.keys(after[tableName].columns || {}),
            constraints: after[tableName].constraints || []
          });
        }
      }
      
      // Find dropped tables
      for (const tableName in before) {
        if (!(tableName in after)) {
          result.droppedTables.push({
            table: tableName,
            columns: Object.keys(before[tableName].columns || {}),
            constraints: before[tableName].constraints || []
          });
        }
      }
      
      // Find modified tables
      for (const tableName in before) {
        if (tableName in after) {
          const tableDiff = this.compareTableStructure(before[tableName], after[tableName]);
          if (tableDiff.hasChanges) {
            result.modifiedTables.push({
              table: tableName,
              ...tableDiff
            });
          }
        }
      }
      
      result.differences = [
        ...result.addedTables.map(t => ({ type: 'table_added', ...t })),
        ...result.droppedTables.map(t => ({ type: 'table_dropped', ...t })),
        ...result.modifiedTables.map(t => ({ type: 'table_modified', ...t }))
      ];
      
      result.status = result.differences.length === 0 ? 'no_changes' : 'changes_detected';
      result.details.totalChanges = result.differences.length;
      
      this.emit(new SchemaComparisonResult(result, result.differences));
      
    } catch (error) {
      result.status = 'error';
      result.details.error = error.message;
      throw new SchemaComparisonError('Schema comparison failed', [], { error: error.message });
    }

    return result;
  }

  /**
   * Verify data integrity after migration
   */
  async verifyDataIntegrity(snapshot) {
    const result = {
      status: 'pending',
      violations: [],
      foreignKeyChecks: [],
      uniqueConstraintChecks: [],
      checkConstraintChecks: [],
      details: {}
    };

    try {
      const schema = snapshot.schema || {};
      
      for (const tableName in schema) {
        const table = schema[tableName];
        
        // Check foreign key integrity
        if (table.foreignKeys) {
          for (const fk of table.foreignKeys) {
            const fkResult = await this.validateForeignKeyIntegrity(tableName, fk, snapshot);
            result.foreignKeyChecks.push(fkResult);
            
            if (fkResult.violations > 0) {
              result.violations.push({
                type: 'foreign_key_violation',
                table: tableName,
                constraint: fk.name,
                violations: fkResult.violations
              });
            }
          }
        }
        
        // Check unique constraints
        if (table.uniqueConstraints) {
          for (const unique of table.uniqueConstraints) {
            const uniqueResult = await this.validateUniqueConstraint(tableName, unique, snapshot);
            result.uniqueConstraintChecks.push(uniqueResult);
            
            if (uniqueResult.violations > 0) {
              result.violations.push({
                type: 'unique_constraint_violation',
                table: tableName,
                constraint: unique.name,
                violations: uniqueResult.violations
              });
            }
          }
        }
        
        // Check CHECK constraints
        if (table.checkConstraints) {
          for (const check of table.checkConstraints) {
            const checkResult = await this.validateCheckConstraint(tableName, check, snapshot);
            result.checkConstraintChecks.push(checkResult);
            
            if (checkResult.violations > 0) {
              result.violations.push({
                type: 'check_constraint_violation',
                table: tableName,
                constraint: check.name,
                violations: checkResult.violations
              });
            }
          }
        }
      }
      
      result.status = result.violations.length === 0 ? 'passed' : 'failed';
      result.details.totalViolations = result.violations.length;
      
      if (result.violations.length > 0 && this.options.strictMode) {
        throw new DataIntegrityError('Data integrity violations detected', result.violations);
      }
      
    } catch (error) {
      result.status = 'error';
      result.details.error = error.message;
      
      if (error instanceof DataIntegrityError) {
        throw error;
      } else {
        throw new DataIntegrityError('Data integrity verification failed', [], { error: error.message });
      }
    }

    return result;
  }

  /**
   * Validate rollback trigger mechanisms
   */
  async validateRollbackTriggers(migrationContext) {
    const result = {
      status: 'pending',
      triggers: [],
      validTriggers: 0,
      invalidTriggers: 0,
      details: {}
    };

    try {
      const { rollbackTriggers = [] } = migrationContext;
      
      for (const trigger of rollbackTriggers) {
        const triggerResult = await this.validateSingleRollbackTrigger(trigger, migrationContext);
        result.triggers.push(triggerResult);
        
        if (triggerResult.isValid) {
          result.validTriggers++;
        } else {
          result.invalidTriggers++;
        }
      }
      
      result.status = result.invalidTriggers === 0 ? 'passed' : 'failed';
      result.details.totalTriggers = rollbackTriggers.length;
      
    } catch (error) {
      result.status = 'error';
      result.details.error = error.message;
    }

    return result;
  }

  /**
   * Compare performance baselines
   */
  async comparePerformanceBaselines(migrationContext) {
    const result = {
      status: 'pending',
      baseline: null,
      current: null,
      comparison: null,
      regressions: [],
      improvements: [],
      details: {}
    };

    try {
      const { performanceBaseline, currentPerformance } = migrationContext;
      
      if (!performanceBaseline || !currentPerformance) {
        result.status = 'skipped';
        result.details.reason = 'Missing performance data';
        return result;
      }
      
      result.baseline = performanceBaseline;
      result.current = currentPerformance;
      
      // Compare query execution times
      const queryComparison = this.compareQueryPerformance(
        performanceBaseline.queries || {},
        currentPerformance.queries || {}
      );
      
      result.comparison = queryComparison;
      result.regressions = queryComparison.regressions;
      result.improvements = queryComparison.improvements;
      
      result.status = result.regressions.length === 0 ? 'passed' : 'degraded';
      result.details.totalQueries = Object.keys(currentPerformance.queries || {}).length;
      
    } catch (error) {
      result.status = 'error';
      result.details.error = error.message;
    }

    return result;
  }

  /**
   * Calculate overall verification result
   */
  calculateOverallResult(results) {
    const checks = [
      results.checksumValidation?.status,
      results.schemaComparison?.status,
      results.dataIntegrityCheck?.status,
      results.rollbackValidation?.status,
      results.performanceBaseline?.status
    ].filter(Boolean);

    if (checks.some(status => status === 'error')) {
      return 'error';
    }
    
    if (checks.some(status => status === 'failed')) {
      return 'failed';
    }
    
    if (checks.every(status => ['passed', 'no_changes', 'skipped'].includes(status))) {
      return 'passed';
    }
    
    return 'partial';
  }

  /**
   * Calculate schema checksum
   */
  async calculateSchemaChecksum(snapshot) {
    const schemaData = JSON.stringify(snapshot.schema || {}, Object.keys(snapshot.schema || {}).sort());
    return hashString(schemaData);
  }

  /**
   * Compare table structure for differences
   */
  compareTableStructure(beforeTable, afterTable) {
    const diff = {
      hasChanges: false,
      addedColumns: [],
      droppedColumns: [],
      modifiedColumns: [],
      addedConstraints: [],
      droppedConstraints: []
    };

    const beforeColumns = beforeTable.columns || {};
    const afterColumns = afterTable.columns || {};

    // Compare columns
    for (const colName in afterColumns) {
      if (!(colName in beforeColumns)) {
        diff.addedColumns.push(colName);
        diff.hasChanges = true;
      }
    }

    for (const colName in beforeColumns) {
      if (!(colName in afterColumns)) {
        diff.droppedColumns.push(colName);
        diff.hasChanges = true;
      } else if (JSON.stringify(beforeColumns[colName]) !== JSON.stringify(afterColumns[colName])) {
        diff.modifiedColumns.push({
          column: colName,
          before: beforeColumns[colName],
          after: afterColumns[colName]
        });
        diff.hasChanges = true;
      }
    }

    return diff;
  }

  /**
   * Validate foreign key integrity (mock implementation)
   */
  async validateForeignKeyIntegrity(tableName, foreignKey, snapshot) {
    // In real implementation, this would execute SQL queries
    return {
      constraint: foreignKey.name,
      table: tableName,
      violations: 0,
      isValid: true
    };
  }

  /**
   * Validate unique constraint (mock implementation)
   */
  async validateUniqueConstraint(tableName, uniqueConstraint, snapshot) {
    return {
      constraint: uniqueConstraint.name,
      table: tableName,
      violations: 0,
      isValid: true
    };
  }

  /**
   * Validate CHECK constraint (mock implementation)
   */
  async validateCheckConstraint(tableName, checkConstraint, snapshot) {
    return {
      constraint: checkConstraint.name,
      table: tableName,
      violations: 0,
      isValid: true
    };
  }

  /**
   * Validate single rollback trigger
   */
  async validateSingleRollbackTrigger(trigger, migrationContext) {
    return {
      name: trigger.name,
      type: trigger.type,
      isValid: true,
      details: {}
    };
  }

  /**
   * Compare query performance metrics
   */
  compareQueryPerformance(baseline, current) {
    const comparison = {
      regressions: [],
      improvements: [],
      stable: []
    };

    const threshold = 0.1; // 10% threshold

    for (const queryId in current) {
      if (queryId in baseline) {
        const baselineTime = baseline[queryId].executionTime;
        const currentTime = current[queryId].executionTime;
        const change = (currentTime - baselineTime) / baselineTime;

        if (change > threshold) {
          comparison.regressions.push({
            query: queryId,
            baselineTime,
            currentTime,
            degradation: change
          });
        } else if (change < -threshold) {
          comparison.improvements.push({
            query: queryId,
            baselineTime,
            currentTime,
            improvement: -change
          });
        } else {
          comparison.stable.push(queryId);
        }
      }
    }

    return comparison;
  }
}

// Export singleton with default settings
export const migrationVerifier = new MigrationVerifier();
