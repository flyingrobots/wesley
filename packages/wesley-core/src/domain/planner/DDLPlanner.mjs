/**
 * DDL Planner - Classifies DDL operations by PostgreSQL lock levels
 * 
 * PostgreSQL Lock Hierarchy (from weakest to strongest):
 * 1. ACCESS SHARE - Reading only
 * 2. ROW SHARE - SELECT with FOR UPDATE/SHARE
 * 3. ROW EXCLUSIVE - DML operations (INSERT, UPDATE, DELETE)
 * 4. SHARE UPDATE EXCLUSIVE - VACUUM, CREATE INDEX CONCURRENTLY
 * 5. SHARE - CREATE INDEX (non-concurrent)
 * 6. SHARE ROW EXCLUSIVE - Some complex operations
 * 7. EXCLUSIVE - ALTER TABLE operations
 * 8. ACCESS EXCLUSIVE - Table-level DDL (DROP, TRUNCATE)
 */

export class DDLPlanner {
  constructor() {
    // Define lock levels in hierarchy order (1 = weakest, 8 = strongest)
    this.LOCK_LEVELS = {
      ACCESS_SHARE: 1,
      ROW_SHARE: 2, 
      ROW_EXCLUSIVE: 3,
      SHARE_UPDATE_EXCLUSIVE: 4,
      SHARE: 5,
      SHARE_ROW_EXCLUSIVE: 6,
      EXCLUSIVE: 7,
      ACCESS_EXCLUSIVE: 8
    };

    // Operations that need non-transactional execution (like CREATE INDEX CONCURRENTLY)
    this.NON_TRANSACTIONAL_OPS = new Set([
      'create_index_concurrently',
      'drop_index_concurrently'
    ]);
  }

  /**
   * Plan migration steps by grouping them by lock level and execution phase
   * @param {Array} migrationSteps - Array of migration steps from MigrationDiffer
   * @returns {Object} Execution plan with phases and lock annotations
   */
  planMigration(migrationSteps) {
    const annotatedSteps = migrationSteps.map(step => this.annotateStep(step));
    
    // Group steps by execution phase
    const transactionalSteps = annotatedSteps.filter(step => !step.nonTransactional);
    const nonTransactionalSteps = annotatedSteps.filter(step => step.nonTransactional);
    
    // Sort transactional steps by lock level (safest first)
    const sortedTransactionalSteps = this.sortByLockLevel(transactionalSteps);
    
    // Detect potential lock conflicts
    const lockConflicts = this.detectLockConflicts(annotatedSteps);
    
    return {
      phases: {
        preTransactional: nonTransactionalSteps.filter(s => s.phase === 'pre'),
        transactional: sortedTransactionalSteps,
        postTransactional: nonTransactionalSteps.filter(s => s.phase === 'post')
      },
      lockConflicts,
      totalSteps: annotatedSteps.length,
      riskLevel: this.calculateRiskLevel(annotatedSteps)
    };
  }

  /**
   * Annotate a migration step with lock level and execution metadata
   * @param {Object} step - Migration step
   * @returns {Object} Annotated step with lock information
   */
  annotateStep(step) {
    const lockInfo = this.getLockInfoForStep(step);
    
    return {
      ...step,
      lockLevel: lockInfo.lockLevel,
      lockLevelName: lockInfo.lockLevelName,
      lockDescription: lockInfo.description,
      nonTransactional: lockInfo.nonTransactional || false,
      phase: lockInfo.phase || 'transactional',
      estimatedDuration: lockInfo.estimatedDuration || 'instant',
      canRunConcurrently: lockInfo.canRunConcurrently || false,
      dataPreservation: lockInfo.dataPreservation || false
    };
  }

  /**
   * Get lock information for a specific migration step
   * @param {Object} step - Migration step
   * @returns {Object} Lock classification information
   */
  getLockInfoForStep(step) {
    switch (step.kind) {
      case 'create_table':
        return {
          lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
          lockLevelName: 'EXCLUSIVE',
          description: 'Creates new table - blocks concurrent reads/writes during creation',
          estimatedDuration: 'instant',
          canRunConcurrently: true
        };

      case 'drop_table':
        return {
          lockLevel: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
          lockLevelName: 'ACCESS_EXCLUSIVE',
          description: 'Drops table - blocks all concurrent access',
          estimatedDuration: 'instant',
          dataPreservation: true
        };

      case 'add_column':
        const addColumnLock = this.getAddColumnLockLevel(step);
        return {
          lockLevel: addColumnLock.level,
          lockLevelName: addColumnLock.name,
          description: addColumnLock.description,
          estimatedDuration: addColumnLock.duration,
          canRunConcurrently: false
        };

      case 'drop_column':
        return {
          lockLevel: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
          lockLevelName: 'ACCESS_EXCLUSIVE',
          description: 'Drops column - requires full table lock',
          estimatedDuration: 'table-scan',
          dataPreservation: true
        };

      case 'alter_type':
        return this.getAlterTypeLockLevel(step);

      case 'create_index':
        return {
          lockLevel: this.LOCK_LEVELS.SHARE,
          lockLevelName: 'SHARE',
          description: 'Creates index - blocks writes during creation',
          estimatedDuration: 'table-scan'
        };

      case 'create_index_concurrently':
        return {
          lockLevel: this.LOCK_LEVELS.SHARE_UPDATE_EXCLUSIVE,
          lockLevelName: 'SHARE_UPDATE_EXCLUSIVE',
          description: 'Creates index concurrently - minimal blocking',
          estimatedDuration: 'table-scan',
          nonTransactional: true,
          phase: 'post',
          canRunConcurrently: true
        };

      case 'drop_index':
        return {
          lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
          lockLevelName: 'EXCLUSIVE',
          description: 'Drops index - brief exclusive lock',
          estimatedDuration: 'instant'
        };

      case 'add_constraint':
        return this.getConstraintLockLevel(step);

      case 'drop_constraint':
        return {
          lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
          lockLevelName: 'EXCLUSIVE',
          description: 'Drops constraint - requires exclusive access',
          estimatedDuration: 'instant'
        };

      // Row Level Security operations
      case 'enable_rls':
        return {
          lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
          lockLevelName: 'EXCLUSIVE',
          description: 'Enables RLS - requires exclusive table access',
          estimatedDuration: 'instant'
        };

      case 'create_policy':
        return {
          lockLevel: this.LOCK_LEVELS.ROW_EXCLUSIVE,
          lockLevelName: 'ROW_EXCLUSIVE',
          description: 'Creates RLS policy - minimal locking',
          estimatedDuration: 'instant'
        };

      // Partitioning operations
      case 'create_partition':
        return {
          lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
          lockLevelName: 'EXCLUSIVE',
          description: 'Creates table partition - requires parent table lock',
          estimatedDuration: 'instant'
        };

      case 'attach_partition':
        return {
          lockLevel: this.LOCK_LEVELS.SHARE_UPDATE_EXCLUSIVE,
          lockLevelName: 'SHARE_UPDATE_EXCLUSIVE',
          description: 'Attaches partition - requires constraint validation',
          estimatedDuration: 'table-scan'
        };

      case 'detach_partition':
        return {
          lockLevel: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
          lockLevelName: 'ACCESS_EXCLUSIVE',
          description: 'Detaches partition - blocks all access during operation',
          estimatedDuration: 'instant',
          dataPreservation: true
        };

      default:
        // Unknown operation - assume highest lock level for safety
        return {
          lockLevel: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
          lockLevelName: 'ACCESS_EXCLUSIVE',
          description: `Unknown operation: ${step.kind} - using maximum lock level for safety`,
          estimatedDuration: 'unknown'
        };
    }
  }

  /**
   * Determine lock level for ADD COLUMN operations
   * @param {Object} step - Add column step
   * @returns {Object} Lock level information
   */
  getAddColumnLockLevel(step) {
    const field = step.field;
    
    // Adding nullable column is fast
    if (!field.nonNull && !field.getDefault()) {
      return {
        level: this.LOCK_LEVELS.EXCLUSIVE,
        name: 'EXCLUSIVE',
        description: 'Adds nullable column - fast metadata-only change',
        duration: 'instant'
      };
    }
    
    // Adding NOT NULL column with default requires table rewrite
    if (field.nonNull && field.getDefault()) {
      return {
        level: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
        name: 'ACCESS_EXCLUSIVE',
        description: 'Adds NOT NULL column with default - requires table rewrite',
        duration: 'table-rewrite'
      };
    }
    
    // Adding NOT NULL column without default is problematic
    if (field.nonNull && !field.getDefault()) {
      return {
        level: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
        name: 'ACCESS_EXCLUSIVE', 
        description: 'Adds NOT NULL column without default - unsafe operation',
        duration: 'table-scan'
      };
    }
    
    // Default case
    return {
      level: this.LOCK_LEVELS.EXCLUSIVE,
      name: 'EXCLUSIVE',
      description: 'Adds column - requires exclusive access',
      duration: 'instant'
    };
  }

  /**
   * Determine lock level for ALTER COLUMN TYPE operations
   * @param {Object} step - Alter type step
   * @returns {Object} Lock level information
   */
  getAlterTypeLockLevel(step) {
    const fromType = this.normalizeType(step.from.type);
    const toType = this.normalizeType(step.to.type);
    
    // Compatible type changes (no rewrite needed)
    const compatibleChanges = [
      ['varchar', 'text'],
      ['int4', 'int8'],
      ['numeric', 'numeric'], // precision/scale changes
      ['text', 'text'], // same type
      ['uuid', 'uuid'], // same type
      ['int4', 'int4'], // same type
      ['float8', 'float8'], // same type
      ['bool', 'bool'], // same type
      ['timestamptz', 'timestamptz'] // same type
    ];
    
    const isCompatible = compatibleChanges.some(([from, to]) => 
      fromType === from && toType === to
    );
    
    if (isCompatible) {
      return {
        lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
        lockLevelName: 'EXCLUSIVE',
        description: 'Compatible type change - no table rewrite required',
        estimatedDuration: 'instant'
      };
    }
    
    // Incompatible type changes require table rewrite
    return {
      lockLevel: this.LOCK_LEVELS.ACCESS_EXCLUSIVE,
      lockLevelName: 'ACCESS_EXCLUSIVE',
      description: 'Incompatible type change - requires full table rewrite',
      estimatedDuration: 'table-rewrite'
    };
  }

  /**
   * Get constraint-specific lock levels
   * @param {Object} step - Add constraint step
   * @returns {Object} Lock level information
   */
  getConstraintLockLevel(step) {
    const constraintType = step.constraintType || 'unknown';
    
    switch (constraintType) {
      case 'check':
        return {
          lockLevel: this.LOCK_LEVELS.SHARE_ROW_EXCLUSIVE,
          lockLevelName: 'SHARE_ROW_EXCLUSIVE',
          description: 'Adds CHECK constraint - validates existing data',
          estimatedDuration: 'table-scan'
        };
        
      case 'foreign_key':
        return {
          lockLevel: this.LOCK_LEVELS.SHARE_ROW_EXCLUSIVE,
          lockLevelName: 'SHARE_ROW_EXCLUSIVE',
          description: 'Adds foreign key - validates referential integrity',
          estimatedDuration: 'table-scan'
        };
        
      case 'unique':
        return {
          lockLevel: this.LOCK_LEVELS.SHARE,
          lockLevelName: 'SHARE',
          description: 'Adds unique constraint - creates supporting index',
          estimatedDuration: 'table-scan'
        };
        
      default:
        return {
          lockLevel: this.LOCK_LEVELS.EXCLUSIVE,
          lockLevelName: 'EXCLUSIVE',
          description: `Adds ${constraintType} constraint - requires exclusive access`,
          estimatedDuration: 'instant'
        };
    }
  }

  /**
   * Normalize database types for compatibility checking
   * @param {String} type - Field type
   * @returns {String} Normalized PostgreSQL type
   */
  normalizeType(type) {
    const typeMap = {
      'ID': 'uuid',
      'String': 'text',
      'Int': 'int4',
      'Float': 'float8',
      'Boolean': 'bool',
      'DateTime': 'timestamptz'
    };
    
    return typeMap[type] || type.toLowerCase();
  }

  /**
   * Sort steps by lock level (safest operations first)
   * @param {Array} steps - Annotated migration steps
   * @returns {Array} Sorted steps
   */
  sortByLockLevel(steps) {
    return steps.sort((a, b) => {
      // Primary sort: lock level (lower = safer = first)
      if (a.lockLevel !== b.lockLevel) {
        return a.lockLevel - b.lockLevel;
      }
      
      // Secondary sort: non-data-preserving operations first (safer)
      if (a.dataPreservation !== b.dataPreservation) {
        return a.dataPreservation ? 1 : -1;
      }
      
      // Tertiary sort: faster operations first
      const durationOrder = {
        'instant': 1,
        'table-scan': 2,
        'table-rewrite': 3,
        'unknown': 4
      };
      
      return (durationOrder[a.estimatedDuration] || 4) - (durationOrder[b.estimatedDuration] || 4);
    });
  }

  /**
   * Detect potential lock conflicts between operations
   * @param {Array} steps - Annotated migration steps
   * @returns {Array} Array of potential conflicts
   */
  detectLockConflicts(steps) {
    const conflicts = [];
    
    // Look for operations on the same table
    const operationsByTable = new Map();
    
    steps.forEach(step => {
      const tableName = step.table;
      if (!tableName) return;
      
      if (!operationsByTable.has(tableName)) {
        operationsByTable.set(tableName, []);
      }
      operationsByTable.get(tableName).push(step);
    });
    
    // Check each table for conflicts
    operationsByTable.forEach((tableOps, tableName) => {
      if (tableOps.length <= 1) return;
      
      // Check for high-lock operations mixed with others
      const highLockOps = tableOps.filter(op => op.lockLevel >= this.LOCK_LEVELS.EXCLUSIVE);
      const lowLockOps = tableOps.filter(op => op.lockLevel < this.LOCK_LEVELS.EXCLUSIVE);
      
      if (highLockOps.length > 0 && lowLockOps.length > 0) {
        conflicts.push({
          type: 'lock_escalation',
          table: tableName,
          description: `Table ${tableName} has both high-lock and low-lock operations`,
          highLockOperations: highLockOps.length,
          suggestion: 'Consider separating operations into different migration phases'
        });
      }
      
      // Check for multiple table rewrites
      const rewriteOps = tableOps.filter(op => op.estimatedDuration === 'table-rewrite');
      if (rewriteOps.length > 1) {
        conflicts.push({
          type: 'multiple_rewrites',
          table: tableName,
          description: `Table ${tableName} has multiple operations requiring table rewrites`,
          operations: rewriteOps.map(op => op.kind),
          suggestion: 'Combine operations to minimize table rewrites'
        });
      }
    });
    
    return conflicts;
  }

  /**
   * Calculate overall risk level for the migration
   * @param {Array} steps - Annotated migration steps  
   * @returns {String} Risk level: 'low', 'medium', 'high', 'critical'
   */
  calculateRiskLevel(steps) {
    // Empty migration has no risk
    if (steps.length === 0) return 'low';
    
    let riskScore = 0;
    
    steps.forEach(step => {
      // Base risk by lock level
      riskScore += step.lockLevel;
      
      // Additional risk factors
      if (step.estimatedDuration === 'table-rewrite') riskScore += 10;
      if (step.dataPreservation) riskScore += 5;
      if (step.lockLevel >= this.LOCK_LEVELS.ACCESS_EXCLUSIVE) riskScore += 8;
      if (step.nonTransactional) riskScore += 3;
    });
    
    // Normalize risk score
    const avgRisk = riskScore / steps.length;
    
    if (avgRisk <= 3) return 'low';
    if (avgRisk <= 6) return 'medium';  
    if (avgRisk <= 10) return 'high';
    return 'critical';
  }

  /**
   * Generate execution recommendations
   * @param {Object} plan - Migration execution plan
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(plan) {
    const recommendations = [];
    
    // Recommend maintenance window for high-risk migrations
    if (plan.riskLevel === 'high' || plan.riskLevel === 'critical') {
      recommendations.push({
        type: 'maintenance_window',
        priority: 'high',
        message: 'Consider running during maintenance window due to high lock levels'
      });
    }
    
    // Recommend concurrent index creation
    const indexCreations = plan.phases.transactional.filter(s => s.kind === 'create_index');
    if (indexCreations.length > 0) {
      recommendations.push({
        type: 'concurrent_indexes',
        priority: 'medium', 
        message: `Consider using CREATE INDEX CONCURRENTLY for ${indexCreations.length} indexes`
      });
    }
    
    // Warn about data loss potential
    const dataLossOps = plan.phases.transactional.filter(s => s.dataPreservation);
    if (dataLossOps.length > 0) {
      recommendations.push({
        type: 'data_backup',
        priority: 'critical',
        message: `${dataLossOps.length} operations may result in data loss - ensure backups`
      });
    }
    
    // Recommend batching for large operations
    const tableRewrites = plan.phases.transactional.filter(s => 
      s.estimatedDuration === 'table-rewrite'
    );
    if (tableRewrites.length > 0) {
      recommendations.push({
        type: 'batching',
        priority: 'medium',
        message: 'Large table operations detected - consider batching for large tables'
      });
    }
    
    return recommendations;
  }
}