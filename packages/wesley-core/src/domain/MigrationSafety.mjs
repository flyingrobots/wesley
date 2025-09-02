/**
 * Migration Safety Rails
 * Provides safety checks and pre-flight snapshots for risky migrations
 */

export class MigrationSafety {
  constructor(options = {}) {
    this.allowDestructive = options.allowDestructive || false;
    this.generateSnapshots = options.generateSnapshots ?? true;
    this.riskThreshold = options.riskThreshold || 50;
  }
  
  /**
   * Analyze migration for risky operations
   */
  analyzeMigration(migrationSteps) {
    const risks = [];
    let totalRiskScore = 0;
    
    for (const step of migrationSteps) {
      const risk = this.assessStepRisk(step);
      if (risk.score > 0) {
        risks.push(risk);
        totalRiskScore += risk.score;
      }
    }
    
    return {
      risks,
      totalRiskScore,
      isDestructive: this.hasDestructiveOperations(migrationSteps),
      requiresConfirmation: totalRiskScore >= this.riskThreshold,
      blockedOperations: this.getBlockedOperations(migrationSteps)
    };
  }
  
  /**
   * Assess risk for a single migration step
   */
  assessStepRisk(step) {
    const riskScores = {
      'drop_table': 100,
      'drop_column': 80,
      'alter_type': 60,
      'add_not_null': 40,
      'rename_table': 30,
      'rename_column': 25,
      'drop_constraint': 20,
      'create_index': 10,
      'add_column': 5,
      'add_constraint': 5
    };
    
    const score = riskScores[step.kind] || 0;
    
    return {
      step: step.kind,
      target: step.table || step.column,
      score,
      severity: this.getSeverity(score),
      mitigation: this.getMitigation(step.kind)
    };
  }
  
  /**
   * Get severity level from risk score
   */
  getSeverity(score) {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    if (score > 0) return 'low';
    return 'none';
  }
  
  /**
   * Get mitigation suggestion for operation
   */
  getMitigation(operation) {
    const mitigations = {
      'drop_table': 'Create backup before dropping table',
      'drop_column': 'Ensure column data is backed up or migrated',
      'alter_type': 'Verify type conversion is safe and lossless',
      'add_not_null': 'Backfill NULL values before adding constraint',
      'rename_table': 'Update all references in application code',
      'rename_column': 'Update all queries and application references',
      'drop_constraint': 'Verify constraint is not enforcing critical business rules',
      'create_index': 'Consider CREATE INDEX CONCURRENTLY for large tables'
    };
    
    return mitigations[operation] || 'Review operation carefully';
  }
  
  /**
   * Check if migration has destructive operations
   */
  hasDestructiveOperations(steps) {
    const destructive = ['drop_table', 'drop_column', 'drop_constraint'];
    return steps.some(step => destructive.includes(step.kind));
  }
  
  /**
   * Get operations that should be blocked without flag
   */
  getBlockedOperations(steps) {
    if (this.allowDestructive) {
      return [];
    }
    
    const blocked = [];
    const destructive = ['drop_table', 'drop_column'];
    
    for (const step of steps) {
      if (destructive.includes(step.kind)) {
        blocked.push({
          operation: step.kind,
          target: step.table || step.column,
          reason: `Destructive operation requires --allow-destructive flag`
        });
      }
    }
    
    return blocked;
  }
  
  /**
   * Generate pre-flight pgTAP snapshot
   */
  generatePreFlightSnapshot(schema, migrationSteps) {
    const snapshots = [];
    const riskySteps = migrationSteps.filter(s => this.assessStepRisk(s).score >= 20);
    
    snapshots.push('-- Pre-flight pgTAP snapshot for risky migration');
    snapshots.push('-- Capture current state before applying changes');
    snapshots.push('BEGIN;');
    snapshots.push('');
    
    // Generate snapshots for risky operations
    for (const step of riskySteps) {
      if (step.kind === 'drop_table') {
        snapshots.push(this.generateTableSnapshot(step.table));
      } else if (step.kind === 'drop_column') {
        snapshots.push(this.generateColumnSnapshot(step.table, step.column));
      } else if (step.kind === 'alter_type') {
        snapshots.push(this.generateTypeSnapshot(step.table, step.column));
      } else if (step.kind === 'rename_table') {
        snapshots.push(this.generateTableStructureSnapshot(step.table));
      } else if (step.kind === 'rename_column') {
        snapshots.push(this.generateColumnMetadataSnapshot(step.table, step.column));
      }
    }
    
    // Add verification tests
    snapshots.push('');
    snapshots.push('-- Verification tests');
    snapshots.push('SELECT plan(999);');
    
    for (const step of riskySteps) {
      if (step.kind === 'drop_table') {
        snapshots.push(`SELECT has_table('${step.table}', 'Table ${step.table} should exist before drop');`);
        snapshots.push(`SELECT table_has_pk('${step.table}', 'Table ${step.table} should have primary key');`);
      } else if (step.kind === 'drop_column') {
        snapshots.push(`SELECT has_column('${step.table}', '${step.column}', 'Column ${step.column} should exist');`);
        snapshots.push(`SELECT col_type_is('${step.table}', '${step.column}', pg_typeof(${step.column})::text);`);
      }
    }
    
    snapshots.push('SELECT * FROM finish();');
    snapshots.push('ROLLBACK;');
    
    return snapshots.join('\n');
  }
  
  /**
   * Generate snapshot for table data
   */
  generateTableSnapshot(tableName) {
    return `
-- Snapshot data from ${tableName}
CREATE TEMP TABLE snapshot_${tableName} AS 
SELECT * FROM "${tableName}";

-- Record row count
SELECT COUNT(*) AS row_count 
FROM "${tableName}" 
\\gset snapshot_${tableName}_

-- Record table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}'
ORDER BY ordinal_position;`;
  }
  
  /**
   * Generate snapshot for column data
   */
  generateColumnSnapshot(tableName, columnName) {
    return `
-- Snapshot column ${columnName} from ${tableName}
CREATE TEMP TABLE snapshot_${tableName}_${columnName} AS
SELECT 
  "${columnName}",
  COUNT(*) as frequency
FROM "${tableName}"
GROUP BY "${columnName}"
ORDER BY frequency DESC
LIMIT 100;

-- Record NULL count
SELECT COUNT(*) AS null_count
FROM "${tableName}"
WHERE "${columnName}" IS NULL
\\gset snapshot_${tableName}_${columnName}_null_`;
  }
  
  /**
   * Generate snapshot for column type
   */
  generateTypeSnapshot(tableName, columnName) {
    return `
-- Snapshot type information for ${tableName}.${columnName}
SELECT 
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = '${tableName}'
  AND column_name = '${columnName}'
\\gset snapshot_${tableName}_${columnName}_type_`;
  }
  
  /**
   * Generate snapshot for table structure
   */
  generateTableStructureSnapshot(tableName) {
    return `
-- Snapshot structure for table ${tableName}
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = '${tableName}'
ORDER BY constraint_type, constraint_name;

-- Snapshot indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = '${tableName}'
ORDER BY indexname;`;
  }
  
  /**
   * Generate snapshot for column metadata
   */
  generateColumnMetadataSnapshot(tableName, columnName) {
    return `
-- Snapshot metadata for ${tableName}.${columnName}
SELECT 
  column_name,
  ordinal_position,
  column_default,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = '${tableName}'
  AND column_name = '${columnName}';`;
  }
  
  /**
   * Hook to Holmes risk scoring
   */
  calculateHolmesRiskScore(migrationSteps) {
    let score = 0;
    const evidence = [];
    
    for (const step of migrationSteps) {
      const risk = this.assessStepRisk(step);
      score += risk.score;
      
      if (risk.score > 0) {
        evidence.push({
          operation: step.kind,
          target: step.table || step.column,
          riskScore: risk.score,
          severity: risk.severity,
          impact: this.getImpactDescription(step)
        });
      }
    }
    
    return {
      mri: score, // Migration Risk Index
      evidence,
      recommendation: this.getRecommendation(score),
      requiresReview: score >= 50,
      blockDeployment: score >= 100 && !this.allowDestructive
    };
  }
  
  /**
   * Get impact description for a step
   */
  getImpactDescription(step) {
    const impacts = {
      'drop_table': 'Permanent data loss - entire table will be deleted',
      'drop_column': 'Permanent data loss - column data will be deleted',
      'alter_type': 'Potential data loss or corruption during type conversion',
      'add_not_null': 'May fail if NULL values exist',
      'rename_table': 'Breaking change - requires application code updates',
      'rename_column': 'Breaking change - requires query updates',
      'drop_constraint': 'May allow invalid data to be inserted',
      'create_index': 'May lock table during creation on large datasets'
    };
    
    return impacts[step.kind] || 'Unknown impact';
  }
  
  /**
   * Get recommendation based on risk score
   */
  getRecommendation(score) {
    if (score >= 100) {
      return 'CRITICAL RISK: Manual review required. Consider breaking into smaller migrations.';
    } else if (score >= 50) {
      return 'HIGH RISK: Test thoroughly in staging. Have rollback plan ready.';
    } else if (score >= 20) {
      return 'MEDIUM RISK: Review changes carefully. Test with production-like data.';
    } else if (score > 0) {
      return 'LOW RISK: Standard testing recommended.';
    }
    return 'SAFE: No risky operations detected.';
  }
}

// Export singleton with default settings
export const migrationSafety = new MigrationSafety();