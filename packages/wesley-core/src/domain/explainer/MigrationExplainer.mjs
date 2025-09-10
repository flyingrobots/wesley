/**
 * MigrationExplainer - Human-readable migration impact analysis
 * 
 * Features:
 * - PostgreSQL lock level analysis
 * - Blocking potential assessment (reads/writes)
 * - Time estimates per operation
 * - Markdown formatted output
 * - Risk scoring and recommendations
 * 
 * Design Philosophy:
 * - Surface lock impacts before execution
 * - Help developers understand migration consequences
 * - Provide actionable recommendations
 * - Support both technical and business stakeholder needs
 */

import { DomainEvent } from '../Events.mjs';

export class MigrationAnalysisStarted extends DomainEvent {
  constructor(operations) {
    super('MIGRATION_ANALYSIS_STARTED', { operationCount: operations.length });
  }
}

export class MigrationAnalysisCompleted extends DomainEvent {
  constructor(analysis, riskScore) {
    super('MIGRATION_ANALYSIS_COMPLETED', { 
      riskScore,
      highRiskOperations: analysis.operations.filter(op => op.riskLevel === 'HIGH').length,
      estimatedDuration: analysis.summary.estimatedDurationMs
    });
  }
}

/**
 * PostgreSQL lock levels and their impacts
 */
export const PostgreSQLLockLevels = {
  ACCESS_SHARE: {
    name: 'ACCESS SHARE',
    level: 1,
    blocksWrites: false,
    blocksReads: false,
    description: 'Lightest lock - only conflicts with ACCESS EXCLUSIVE',
    commonOperations: ['SELECT', 'COPY FROM']
  },
  
  ROW_SHARE: {
    name: 'ROW SHARE',
    level: 2,
    blocksWrites: false,
    blocksReads: false,
    description: 'Allows concurrent reads and writes, prevents exclusive table locks',
    commonOperations: ['SELECT FOR UPDATE', 'SELECT FOR SHARE']
  },
  
  ROW_EXCLUSIVE: {
    name: 'ROW EXCLUSIVE',
    level: 3,
    blocksWrites: false,
    blocksReads: false,
    description: 'Allows concurrent reads, prevents share and exclusive locks',
    commonOperations: ['INSERT', 'UPDATE', 'DELETE']
  },
  
  SHARE_UPDATE_EXCLUSIVE: {
    name: 'SHARE UPDATE EXCLUSIVE',
    level: 4,
    blocksWrites: true,
    blocksReads: false,
    description: 'Blocks other writes and DDL, allows reads',
    commonOperations: ['VACUUM', 'ANALYZE', 'CREATE INDEX CONCURRENTLY']
  },
  
  SHARE: {
    name: 'SHARE',
    level: 5,
    blocksWrites: true,
    blocksReads: false,
    description: 'Allows concurrent reads, blocks all writes',
    commonOperations: ['CREATE INDEX (non-concurrent)']
  },
  
  SHARE_ROW_EXCLUSIVE: {
    name: 'SHARE ROW EXCLUSIVE',
    level: 6,
    blocksWrites: true,
    blocksReads: false,
    description: 'More restrictive than SHARE, used by some DDL',
    commonOperations: ['CREATE TRIGGER', 'ALTER TABLE (some operations)']
  },
  
  EXCLUSIVE: {
    name: 'EXCLUSIVE',
    level: 7,
    blocksWrites: true,
    blocksReads: false,
    description: 'Blocks writes, allows reads, prevents concurrent schema changes',
    commonOperations: ['REFRESH MATERIALIZED VIEW', 'LOCK TABLE IN EXCLUSIVE MODE']
  },
  
  ACCESS_EXCLUSIVE: {
    name: 'ACCESS EXCLUSIVE',
    level: 8,
    blocksWrites: true,
    blocksReads: true,
    description: 'Strongest lock - blocks everything',
    commonOperations: ['DROP TABLE', 'TRUNCATE', 'ALTER TABLE (structural changes)', 'REINDEX']
  }
};

/**
 * Migration operation analysis with lock impact
 */
export class MigrationOperation {
  constructor(sql, metadata = {}) {
    this.sql = sql;
    this.operationType = this.determineOperationType(sql);
    this.affectedTables = this.extractAffectedTables(sql);
    this.lockLevel = this.determineLockLevel();
    this.riskLevel = this.calculateRiskLevel();
    this.estimatedDurationMs = this.estimateDuration();
    this.metadata = metadata;
  }
  
  /**
   * Determine the type of operation from SQL
   */
  determineOperationType(sql) {
    const normalizedSql = sql.trim().toUpperCase();
    
    // DDL Operations
    if (normalizedSql.startsWith('CREATE TABLE')) return 'CREATE_TABLE';
    if (normalizedSql.startsWith('DROP TABLE')) return 'DROP_TABLE';
    if (normalizedSql.startsWith('ALTER TABLE')) {
      if (normalizedSql.includes('ADD COLUMN')) return 'ADD_COLUMN';
      if (normalizedSql.includes('DROP COLUMN')) return 'DROP_COLUMN';
      if (normalizedSql.includes('ALTER COLUMN')) return 'ALTER_COLUMN';
      if (normalizedSql.includes('ADD CONSTRAINT')) return 'ADD_CONSTRAINT';
      if (normalizedSql.includes('DROP CONSTRAINT')) return 'DROP_CONSTRAINT';
      return 'ALTER_TABLE';
    }
    
    // Index Operations
    if (normalizedSql.includes('CREATE INDEX CONCURRENTLY')) return 'CREATE_INDEX_CONCURRENT';
    if (normalizedSql.startsWith('CREATE INDEX')) return 'CREATE_INDEX';
    if (normalizedSql.startsWith('DROP INDEX')) return 'DROP_INDEX';
    if (normalizedSql.startsWith('REINDEX')) return 'REINDEX';
    
    // Other DDL
    if (normalizedSql.startsWith('CREATE')) return 'CREATE_OBJECT';
    if (normalizedSql.startsWith('DROP')) return 'DROP_OBJECT';
    
    // DML Operations
    if (normalizedSql.startsWith('INSERT')) return 'INSERT';
    if (normalizedSql.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedSql.startsWith('DELETE')) return 'DELETE';
    
    return 'UNKNOWN';
  }
  
  /**
   * Extract affected table names from SQL
   */
  extractAffectedTables(sql) {
    const tables = new Set();
    const normalizedSql = sql.toUpperCase();
    
    // Common patterns for table names
    const patterns = [
      /(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?\"?([a-zA-Z_][a-zA-Z0-9_]*)\"?/gi,
      /ALTER\s+TABLE\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?\"?([a-zA-Z_][a-zA-Z0-9_]*)\"?/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(sql)) !== null) {
        const tableName = match[2] || match[1]; // Handle schema.table or just table
        if (tableName && !['SELECT', 'FROM', 'WHERE', 'ORDER', 'GROUP'].includes(tableName.toUpperCase())) {
          tables.add(tableName.toLowerCase());
        }
      }
    }
    
    return Array.from(tables);
  }
  
  /**
   * Determine PostgreSQL lock level for this operation
   */
  determineLockLevel() {
    switch (this.operationType) {
      case 'CREATE_TABLE':
      case 'CREATE_INDEX_CONCURRENT':
        return PostgreSQLLockLevels.SHARE_UPDATE_EXCLUSIVE;
        
      case 'CREATE_INDEX':
        return PostgreSQLLockLevels.SHARE;
        
      case 'DROP_TABLE':
      case 'DROP_COLUMN':
      case 'ALTER_COLUMN':
      case 'REINDEX':
        return PostgreSQLLockLevels.ACCESS_EXCLUSIVE;
        
      case 'ADD_COLUMN':
        // Non-null columns with defaults require rewrite
        if (this.sql.toUpperCase().includes('NOT NULL') && this.sql.toUpperCase().includes('DEFAULT')) {
          return PostgreSQLLockLevels.ACCESS_EXCLUSIVE;
        }
        // Nullable columns are usually quick
        return PostgreSQLLockLevels.SHARE_ROW_EXCLUSIVE;
        
      case 'ADD_CONSTRAINT':
        // NOT VALID constraints are less disruptive
        if (this.sql.toUpperCase().includes('NOT VALID')) {
          return PostgreSQLLockLevels.SHARE_ROW_EXCLUSIVE;
        }
        return PostgreSQLLockLevels.ACCESS_EXCLUSIVE;
        
      case 'DROP_CONSTRAINT':
      case 'DROP_INDEX':
        return PostgreSQLLockLevels.SHARE_ROW_EXCLUSIVE;
        
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
        return PostgreSQLLockLevels.ROW_EXCLUSIVE;
        
      default:
        return PostgreSQLLockLevels.ACCESS_EXCLUSIVE; // Conservative default
    }
  }
  
  /**
   * Calculate risk level based on lock impact and operation type
   */
  calculateRiskLevel() {
    const lock = this.lockLevel;
    
    // Critical operations that can cause outages
    if (['DROP_TABLE', 'REINDEX', 'ALTER_COLUMN'].includes(this.operationType)) {
      return 'CRITICAL';
    }
    
    // High risk - blocks reads or writes
    if (lock.blocksReads || (lock.blocksWrites && lock.level >= 5)) {
      return 'HIGH';
    }
    
    // Medium risk - blocks writes only
    if (lock.blocksWrites) {
      return 'MEDIUM';
    }
    
    // Low risk - minimal blocking
    return 'LOW';
  }
  
  /**
   * Estimate operation duration based on operation type and table size
   */
  estimateDuration() {
    const baseEstimates = {
      CREATE_TABLE: 100,              // 100ms for empty table
      DROP_TABLE: 50,                 // 50ms
      ADD_COLUMN: 500,                // 500ms nullable column
      DROP_COLUMN: 10000,             // 10s table rewrite
      ALTER_COLUMN: 30000,            // 30s table rewrite
      CREATE_INDEX: 60000,            // 1 minute for average table
      CREATE_INDEX_CONCURRENT: 120000, // 2 minutes concurrent
      DROP_INDEX: 1000,               // 1s
      ADD_CONSTRAINT: 15000,          // 15s validation
      DROP_CONSTRAINT: 500,           // 500ms
      INSERT: 10,                     // 10ms per row
      UPDATE: 20,                     // 20ms per row
      DELETE: 15,                     // 15ms per row
      REINDEX: 180000,                // 3 minutes
      UNKNOWN: 30000                  // 30s conservative
    };
    
    let baseEstimate = baseEstimates[this.operationType] || 30000;
    
    // Adjust for table size hints in metadata
    if (this.metadata && this.metadata.estimatedRows) {
      const rows = this.metadata.estimatedRows;
      if (rows > 1000000) baseEstimate *= 10;      // 1M+ rows
      else if (rows > 100000) baseEstimate *= 3;    // 100K+ rows
      else if (rows > 10000) baseEstimate *= 1.5;   // 10K+ rows
    }
    
    return baseEstimate;
  }
  
  /**
   * Get human-readable explanation of this operation
   */
  getExplanation() {
    const lock = this.lockLevel;
    const duration = this.formatDuration(this.estimatedDurationMs);
    const tables = this.affectedTables.length > 0 
      ? this.affectedTables.join(', ') 
      : 'unknown tables';
    
    return {
      operation: this.operationType.replace(/_/g, ' ').toLowerCase(),
      tables,
      lockLevel: lock.name,
      lockDescription: lock.description,
      blocksReads: lock.blocksReads,
      blocksWrites: lock.blocksWrites,
      estimatedDuration: duration,
      riskLevel: this.riskLevel,
      impact: this.getImpactDescription()
    };
  }
  
  /**
   * Get impact description for this operation
   */
  getImpactDescription() {
    const lock = this.lockLevel;
    
    if (lock.blocksReads && lock.blocksWrites) {
      return '🚨 **BLOCKS ALL ACCESS** - Application will be unavailable for affected tables';
    } else if (lock.blocksReads) {
      return '🚨 **BLOCKS READS** - Application cannot read from affected tables';
    } else if (lock.blocksWrites) {
      return '⚠️ **BLOCKS WRITES** - Application cannot modify affected tables';
    } else {
      return '✅ **LOW IMPACT** - Minimal blocking of concurrent operations';
    }
  }
  
  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

/**
 * Migration analysis summary
 */
export class MigrationAnalysisSummary {
  constructor(operations) {
    this.operations = operations;
    this.totalOperations = operations.length;
    this.riskDistribution = this.calculateRiskDistribution();
    this.estimatedDurationMs = this.calculateTotalDuration();
    this.affectedTables = this.getAffectedTables();
    this.blockingOperations = this.getBlockingOperations();
    this.recommendations = this.generateRecommendations();
    this.overallRiskScore = this.calculateOverallRisk();
  }
  
  calculateRiskDistribution() {
    return this.operations.reduce((dist, op) => {
      dist[op.riskLevel] = (dist[op.riskLevel] || 0) + 1;
      return dist;
    }, {});
  }
  
  calculateTotalDuration() {
    return this.operations.reduce((total, op) => total + op.estimatedDurationMs, 0);
  }
  
  getAffectedTables() {
    const tables = new Set();
    this.operations.forEach(op => {
      op.affectedTables.forEach(table => tables.add(table));
    });
    return Array.from(tables);
  }
  
  getBlockingOperations() {
    return this.operations.filter(op => 
      op.lockLevel.blocksReads || op.lockLevel.blocksWrites
    );
  }
  
  calculateOverallRisk() {
    const weights = { CRITICAL: 100, HIGH: 50, MEDIUM: 25, LOW: 5 };
    const totalWeight = this.operations.reduce((sum, op) => 
      sum + weights[op.riskLevel], 0
    );
    
    if (totalWeight >= 100) return 'CRITICAL';
    if (totalWeight >= 50) return 'HIGH';
    if (totalWeight >= 25) return 'MEDIUM';
    return 'LOW';
  }
  
  generateRecommendations() {
    const recommendations = [];
    
    // Check for blocking operations
    const blockingOps = this.blockingOperations;
    if (blockingOps.length > 0) {
      recommendations.push({
        type: 'SCHEDULING',
        priority: 'HIGH',
        message: `${blockingOps.length} operations will block application access. Schedule during maintenance window.`
      });
    }
    
    // Check for CREATE INDEX operations
    const indexOps = this.operations.filter(op => 
      op.operationType === 'CREATE_INDEX'
    );
    if (indexOps.length > 0) {
      recommendations.push({
        type: 'CONCURRENCY',
        priority: 'MEDIUM',
        message: `Consider using CREATE INDEX CONCURRENTLY for ${indexOps.length} index operations to reduce blocking.`
      });
    }
    
    // Check for constraint additions
    const constraintOps = this.operations.filter(op => 
      op.operationType === 'ADD_CONSTRAINT'
    );
    if (constraintOps.length > 0) {
      recommendations.push({
        type: 'VALIDATION',
        priority: 'MEDIUM',
        message: `Consider adding constraints with NOT VALID, then validating separately to reduce lock time.`
      });
    }
    
    // Check migration duration
    if (this.estimatedDurationMs > 300000) { // 5 minutes
      recommendations.push({
        type: 'DURATION',
        priority: 'HIGH',
        message: `Migration estimated to take ${this.formatDuration(this.estimatedDurationMs)}. Consider breaking into smaller batches.`
      });
    }
    
    return recommendations;
  }
  
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

/**
 * Main MigrationExplainer class
 */
export class MigrationExplainer {
  constructor(eventEmitter = null) {
    this.eventEmitter = eventEmitter;
  }
  
  /**
   * Emit domain event
   */
  emit(event) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit('domain-event', event);
    }
  }
  
  /**
   * Analyze a migration's impact
   */
  analyzeMigration(sqlOperations, metadata = {}) {
    this.emit(new MigrationAnalysisStarted(sqlOperations));
    
    // Convert SQL strings to MigrationOperation objects
    const operations = sqlOperations.map(sql => {
      if (typeof sql === 'string') {
        return new MigrationOperation(sql, metadata);
      }
      return sql; // Already a MigrationOperation
    });
    
    // Create analysis summary
    const summary = new MigrationAnalysisSummary(operations);
    
    const analysis = {
      operations,
      summary,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    this.emit(new MigrationAnalysisCompleted(analysis, summary.overallRiskScore));
    
    return analysis;
  }
  
  /**
   * Generate markdown report of migration analysis
   */
  generateMarkdownReport(analysis) {
    const { operations, summary } = analysis;
    const report = [];
    
    // Header
    report.push('# Migration Impact Analysis\n');
    report.push(`**Generated:** ${new Date(analysis.timestamp).toLocaleString()}`);
    report.push(`**Overall Risk:** ${this.getRiskBadge(summary.overallRiskScore)}`);
    report.push(`**Estimated Duration:** ${summary.formatDuration(summary.estimatedDurationMs)}`);
    report.push(`**Operations:** ${summary.totalOperations}`);
    report.push(`**Affected Tables:** ${summary.affectedTables.join(', ') || 'None'}\n`);
    
    // Risk Summary
    report.push('## Risk Summary\n');
    report.push('| Risk Level | Count | Percentage |');
    report.push('|------------|-------|------------|');
    
    const riskLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    for (const level of riskLevels) {
      const count = summary.riskDistribution[level] || 0;
      const percentage = summary.totalOperations > 0 
        ? ((count / summary.totalOperations) * 100).toFixed(1) 
        : '0.0';
      report.push(`| ${this.getRiskBadge(level)} | ${count} | ${percentage}% |`);
    }
    report.push('');
    
    // Blocking Operations Summary
    if (summary.blockingOperations.length > 0) {
      report.push('## ⚠️ Blocking Operations\n');
      report.push(`**${summary.blockingOperations.length} operations will block application access:**\n`);
      
      for (const op of summary.blockingOperations) {
        const explanation = op.getExplanation();
        report.push(`- **${explanation.operation}** on \`${explanation.tables}\``);
        report.push(`  - Lock: ${explanation.lockLevel}`);
        report.push(`  - Duration: ${explanation.estimatedDuration}`);
        report.push(`  - Impact: ${explanation.impact}\n`);
      }
    }
    
    // Recommendations
    if (summary.recommendations.length > 0) {
      report.push('## 💡 Recommendations\n');
      
      const highPriority = summary.recommendations.filter(r => r.priority === 'HIGH');
      const mediumPriority = summary.recommendations.filter(r => r.priority === 'MEDIUM');
      
      if (highPriority.length > 0) {
        report.push('### High Priority\n');
        for (const rec of highPriority) {
          report.push(`- **${rec.type}:** ${rec.message}`);
        }
        report.push('');
      }
      
      if (mediumPriority.length > 0) {
        report.push('### Medium Priority\n');
        for (const rec of mediumPriority) {
          report.push(`- **${rec.type}:** ${rec.message}`);
        }
        report.push('');
      }
    }
    
    // Detailed Operations
    report.push('## Detailed Operation Analysis\n');
    
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const explanation = op.getExplanation();
      
      report.push(`### ${i + 1}. ${explanation.operation.toUpperCase()}\n`);
      report.push(`**Risk Level:** ${this.getRiskBadge(op.riskLevel)}`);
      report.push(`**Affected Tables:** \`${explanation.tables}\``);
      report.push(`**Lock Level:** ${explanation.lockLevel}`);
      report.push(`**Estimated Duration:** ${explanation.estimatedDuration}`);
      report.push(`**Impact:** ${explanation.impact}\n`);
      
      // Show SQL (truncated)
      const sqlPreview = op.sql.length > 200 
        ? op.sql.slice(0, 200) + '...'
        : op.sql;
      report.push('**SQL:**');
      report.push('```sql');
      report.push(sqlPreview);
      report.push('```\n');
      
      // Lock details
      report.push('**Lock Details:**');
      report.push(`- Blocks Reads: ${explanation.blocksReads ? '❌ Yes' : '✅ No'}`);
      report.push(`- Blocks Writes: ${explanation.blocksWrites ? '❌ Yes' : '✅ No'}`);
      report.push(`- Description: ${explanation.lockDescription}\n`);
      
      report.push('---\n');
    }
    
    // Footer
    report.push('## Summary\n');
    report.push(`This migration contains **${operations.length} operations** affecting **${summary.affectedTables.length} tables**.`);
    report.push(`The estimated total duration is **${summary.formatDuration(summary.estimatedDurationMs)}**.`);
    
    if (summary.blockingOperations.length > 0) {
      report.push(`\n⚠️ **WARNING:** ${summary.blockingOperations.length} operations will block application access. Plan accordingly.`);
    } else {
      report.push('\n✅ **GOOD:** No operations will block application access.');
    }
    
    return report.join('\n');
  }
  
  /**
   * Get risk level badge for markdown
   */
  getRiskBadge(riskLevel) {
    const badges = {
      CRITICAL: '🔴 CRITICAL',
      HIGH: '🟠 HIGH',
      MEDIUM: '🟡 MEDIUM',
      LOW: '🟢 LOW'
    };
    return badges[riskLevel] || '⚪ UNKNOWN';
  }
  
  /**
   * Generate JSON report for programmatic use
   */
  generateJsonReport(analysis) {
    return {
      timestamp: analysis.timestamp,
      summary: {
        totalOperations: analysis.summary.totalOperations,
        overallRiskScore: analysis.summary.overallRiskScore,
        estimatedDurationMs: analysis.summary.estimatedDurationMs,
        affectedTables: analysis.summary.affectedTables,
        riskDistribution: analysis.summary.riskDistribution,
        blockingOperations: analysis.summary.blockingOperations.length,
        recommendations: analysis.summary.recommendations
      },
      operations: analysis.operations.map(op => ({
        sql: op.sql,
        operationType: op.operationType,
        affectedTables: op.affectedTables,
        lockLevel: {
          name: op.lockLevel.name,
          level: op.lockLevel.level,
          blocksReads: op.lockLevel.blocksReads,
          blocksWrites: op.lockLevel.blocksWrites
        },
        riskLevel: op.riskLevel,
        estimatedDurationMs: op.estimatedDurationMs,
        explanation: op.getExplanation()
      }))
    };
  }
  
  /**
   * Quick risk assessment for a single SQL operation
   */
  quickAssessment(sql, metadata = {}) {
    const operation = new MigrationOperation(sql, metadata);
    const explanation = operation.getExplanation();
    
    return {
      riskLevel: operation.riskLevel,
      lockLevel: operation.lockLevel.name,
      estimatedDuration: explanation.estimatedDuration,
      impact: explanation.impact,
      blocksReads: operation.lockLevel.blocksReads,
      blocksWrites: operation.lockLevel.blocksWrites,
      affectedTables: operation.affectedTables
    };
  }
}