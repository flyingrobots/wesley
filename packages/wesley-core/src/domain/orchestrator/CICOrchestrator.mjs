/**
 * CICOrchestrator - CREATE INDEX CONCURRENTLY execution orchestrator
 * 
 * Features:
 * - Enforces PostgreSQL CIC execution rules
 * - Runs CIC operations outside transactions
 * - One CIC per table at a time (prevents deadlocks)
 * - Progress tracking and error handling
 * - Automatic cleanup of failed indexes
 * - Retry logic with exponential backoff
 * 
 * Design Philosophy:
 * - Safety first - prevent database deadlocks
 * - Never run CIC inside transactions
 * - Serialize CIC operations per table
 * - Clean up failed indexes automatically
 * - Provide detailed progress feedback
 */

import { DomainEvent } from '../Events.mjs';

export class CICOrchestrationStarted extends DomainEvent {
  constructor(operations, strategy) {
    super('CIC_ORCHESTRATION_STARTED', { 
      operationCount: operations.length,
      strategy,
      affectedTables: [...new Set(operations.map(op => op.tableName))]
    });
  }
}

export class CICOperationStarted extends DomainEvent {
  constructor(operation, position, total) {
    super('CIC_OPERATION_STARTED', { 
      indexName: operation.indexName,
      tableName: operation.tableName,
      position,
      total,
      isPartial: operation.isPartial
    });
  }
}

export class CICOperationCompleted extends DomainEvent {
  constructor(operation, duration, retryCount) {
    super('CIC_OPERATION_COMPLETED', { 
      indexName: operation.indexName,
      tableName: operation.tableName,
      duration,
      retryCount
    });
  }
}

export class CICOperationFailed extends DomainEvent {
  constructor(operation, error, retryCount, willRetry) {
    super('CIC_OPERATION_FAILED', { 
      indexName: operation.indexName,
      tableName: operation.tableName,
      error: error.message,
      retryCount,
      willRetry
    });
  }
}

export class CICOperationSkipped extends DomainEvent {
  constructor(operation, reason) {
    super('CIC_OPERATION_SKIPPED', { 
      indexName: operation.indexName,
      tableName: operation.tableName,
      reason
    });
  }
}

export class CICCleanupStarted extends DomainEvent {
  constructor(invalidIndexes) {
    super('CIC_CLEANUP_STARTED', { 
      invalidIndexCount: invalidIndexes.length,
      indexNames: invalidIndexes.map(idx => idx.name)
    });
  }
}

export class CICOrchestrationCompleted extends DomainEvent {
  constructor(results, totalDuration) {
    super('CIC_ORCHESTRATION_COMPLETED', { 
      totalOperations: results.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      totalDuration
    });
  }
}

/**
 * CREATE INDEX CONCURRENTLY operation definition
 */
export class CICOperation {
  constructor(sql, metadata = {}) {
    this.sql = sql;
    this.indexName = this.extractIndexName(sql);
    this.tableName = this.extractTableName(sql);
    this.columns = this.extractColumns(sql);
    this.isUnique = sql.toUpperCase().includes('UNIQUE INDEX');
    this.isPartial = sql.toUpperCase().includes('WHERE');
    this.predicate = this.extractWherePredicate(sql);
    this.method = this.extractIndexMethod(sql);
    this.metadata = {
      estimatedRows: null,
      priority: 'NORMAL',
      maxRetries: 3,
      retryDelayMs: 5000,
      timeoutMs: 600000, // 10 minutes default
      ...metadata
    };
    
    // Execution tracking
    this.status = 'pending';
    this.startTime = null;
    this.endTime = null;
    this.retryCount = 0;
    this.error = null;
    this.createdIndexName = null; // Actual name if PostgreSQL renames it
  }
  
  /**
   * Extract index name from CREATE INDEX statement
   */
  extractIndexName(sql) {
    const match = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([^"]+)"?|([^\s]+))/i);
    return match ? (match[1] || match[2]) : 'unknown_index';
  }
  
  /**
   * Extract table name from CREATE INDEX statement
   */
  extractTableName(sql) {
    const match = sql.match(/ON\s+(?:"?([^"]+)"?\.)?(?:"?([^"]+)"?|([^\s(]+))/i);
    return match ? (match[2] || match[3]) : 'unknown_table';
  }
  
  /**
   * Extract column names from CREATE INDEX statement
   */
  extractColumns(sql) {
    const match = sql.match(/\(([^)]+)\)/);
    if (!match) return [];
    
    return match[1]
      .split(',')
      .map(col => col.trim().replace(/["'`]/g, ''))
      .filter(col => col.length > 0);
  }
  
  /**
   * Extract WHERE predicate for partial indexes
   */
  extractWherePredicate(sql) {
    const match = sql.match(/WHERE\s+(.+?)(?:$|;)/i);
    return match ? match[1].trim() : null;
  }
  
  /**
   * Extract index method (btree, gin, gist, etc.)
   */
  extractIndexMethod(sql) {
    const match = sql.match(/USING\s+(\w+)/i);
    return match ? match[1].toLowerCase() : 'btree';
  }
  
  /**
   * Get operation priority for scheduling
   */
  getPriority() {
    if (this.isUnique) return 'HIGH';
    if (this.method === 'gin' || this.method === 'gist') return 'MEDIUM';
    return this.metadata.priority;
  }
  
  /**
   * Estimate operation duration based on table size and index complexity
   */
  getEstimatedDuration() {
    let baseMs = 60000; // 1 minute base
    
    // Adjust for estimated table size
    if (this.metadata.estimatedRows) {
      const rows = this.metadata.estimatedRows;
      if (rows > 10000000) baseMs *= 20;      // 10M+ rows
      else if (rows > 1000000) baseMs *= 8;   // 1M+ rows
      else if (rows > 100000) baseMs *= 3;    // 100K+ rows
      else if (rows > 10000) baseMs *= 1.5;   // 10K+ rows
    }
    
    // Adjust for index complexity
    if (this.method === 'gin' || this.method === 'gist') baseMs *= 2;
    if (this.columns.length > 3) baseMs *= 1.5;
    if (this.isPartial) baseMs *= 0.8; // Partial indexes are faster
    
    return Math.min(baseMs, this.metadata.timeoutMs);
  }
  
  /**
   * Generate cleanup SQL for failed index
   */
  getCleanupSql() {
    return `DROP INDEX CONCURRENTLY IF EXISTS "${this.indexName}";`;
  }
  
  /**
   * Check if this operation conflicts with another
   */
  conflictsWith(otherOperation) {
    // Same table - always conflicts
    if (this.tableName === otherOperation.tableName) {
      return true;
    }
    
    // Same index name - conflicts
    if (this.indexName === otherOperation.indexName) {
      return true;
    }
    
    return false;
  }
}

/**
 * Execution strategy for CIC operations
 */
export class CICExecutionStrategy {
  static SEQUENTIAL = 'SEQUENTIAL';           // One at a time globally
  static TABLE_PARALLEL = 'TABLE_PARALLEL';   // Parallel across tables, serial per table
  static PRIORITY_BASED = 'PRIORITY_BASED';   // High priority first
  
  constructor(type = CICExecutionStrategy.TABLE_PARALLEL) {
    this.type = type;
    this.maxParallelTables = 3;
    this.maxRetriesPerOperation = 3;
    this.backoffMultiplier = 2.0;
    this.maxBackoffMs = 60000; // 1 minute max
  }
}

/**
 * Progress tracker for CIC orchestration
 */
export class CICProgressTracker {
  constructor(totalOperations) {
    this.totalOperations = totalOperations;
    this.completed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.inProgress = new Set();
    this.startTime = Date.now();
  }
  
  startOperation(operation) {
    this.inProgress.add(operation.indexName);
  }
  
  completeOperation(operation, success = true) {
    this.inProgress.delete(operation.indexName);
    if (success) {
      this.completed++;
    } else {
      this.failed++;
    }
  }
  
  skipOperation(operation) {
    this.skipped++;
  }
  
  getProgress() {
    const processed = this.completed + this.failed + this.skipped;
    return {
      total: this.totalOperations,
      processed,
      inProgress: this.inProgress.size,
      completed: this.completed,
      failed: this.failed,
      skipped: this.skipped,
      percentage: this.totalOperations > 0 ? (processed / this.totalOperations) * 100 : 0,
      elapsedMs: Date.now() - this.startTime
    };
  }
}

/**
 * Result of a CIC operation execution
 */
export class CICOperationResult {
  constructor(operation, status, duration = null, error = null) {
    this.operation = operation;
    this.status = status; // 'completed', 'failed', 'skipped'
    this.duration = duration;
    this.error = error;
    this.retryCount = operation.retryCount;
    this.timestamp = new Date().toISOString();
  }
  
  isSuccess() {
    return this.status === 'completed';
  }
  
  isFailure() {
    return this.status === 'failed';
  }
  
  wasSkipped() {
    return this.status === 'skipped';
  }
}

/**
 * Main CIC Orchestrator class
 */
export class CICOrchestrator {
  constructor(sqlExecutor, eventEmitter = null) {
    this.sqlExecutor = sqlExecutor;
    this.eventEmitter = eventEmitter;
    this.strategy = new CICExecutionStrategy();
    this.progressTracker = null;
    this.results = [];
    this.activeOperations = new Map(); // table -> operation
    this.operationQueue = [];
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
   * Set execution strategy
   */
  setStrategy(strategy) {
    this.strategy = strategy;
    return this;
  }
  
  /**
   * Orchestrate execution of CIC operations
   */
  async orchestrate(operations, strategy = null) {
    if (strategy) {
      this.setStrategy(strategy);
    }
    
    const startTime = Date.now();
    this.progressTracker = new CICProgressTracker(operations.length);
    this.results = [];
    this.operationQueue = [...operations];
    
    this.emit(new CICOrchestrationStarted(operations, this.strategy.type));
    
    try {
      // Validate operations first
      await this.validateOperations(operations);
      
      // Execute based on strategy
      switch (this.strategy.type) {
        case CICExecutionStrategy.SEQUENTIAL:
          await this.executeSequentially();
          break;
        case CICExecutionStrategy.TABLE_PARALLEL:
          await this.executeTableParallel();
          break;
        case CICExecutionStrategy.PRIORITY_BASED:
          await this.executePriorityBased();
          break;
        default:
          throw new Error(`Unknown execution strategy: ${this.strategy.type}`);
      }
      
      // Clean up any failed indexes
      await this.cleanupFailedIndexes();
      
      const totalDuration = Date.now() - startTime;
      this.emit(new CICOrchestrationCompleted(this.results, totalDuration));
      
      return this.results;
    } catch (error) {
      this.emit(new CICOperationFailed(
        { indexName: 'orchestration', tableName: 'system' },
        error,
        0,
        false
      ));
      throw error;
    }
  }
  
  /**
   * Validate operations before execution
   */
  async validateOperations(operations) {
    for (const operation of operations) {
      // Check for duplicate index names
      const duplicates = operations.filter(op => 
        op !== operation && op.indexName === operation.indexName
      );
      
      if (duplicates.length > 0) {
        this.results.push(new CICOperationResult(
          operation, 
          'skipped', 
          null, 
          new Error('Duplicate index name')
        ));
        this.emit(new CICOperationSkipped(operation, 'Duplicate index name'));
        continue;
      }
      
      // Check if index already exists
      if (await this.indexExists(operation.indexName)) {
        this.results.push(new CICOperationResult(
          operation, 
          'skipped', 
          null, 
          new Error('Index already exists')
        ));
        this.emit(new CICOperationSkipped(operation, 'Index already exists'));
        this.progressTracker.skipOperation(operation);
      }
    }
  }
  
  /**
   * Execute operations sequentially (one at a time)
   */
  async executeSequentially() {
    for (let i = 0; i < this.operationQueue.length; i++) {
      const operation = this.operationQueue[i];
      
      // Skip if already processed
      if (this.results.find(r => r.operation.indexName === operation.indexName)) {
        continue;
      }
      
      const result = await this.executeSingleOperation(operation, i + 1, this.operationQueue.length);
      this.results.push(result);
    }
  }
  
  /**
   * Execute operations with table-level parallelization
   */
  async executeTableParallel() {
    const remainingOperations = this.operationQueue.filter(op => 
      !this.results.find(r => r.operation.indexName === op.indexName)
    );
    
    while (remainingOperations.length > 0) {
      const availableOperations = remainingOperations.filter(op => {
        // Skip if table is already being processed
        return !this.activeOperations.has(op.tableName);
      });
      
      if (availableOperations.length === 0) {
        // Wait for some operations to complete
        await this.waitForAnyCompletion();
        continue;
      }
      
      // Start up to maxParallelTables operations
      const toStart = availableOperations.slice(0, this.strategy.maxParallelTables);
      const promises = toStart.map(async (operation, index) => {
        const result = await this.executeSingleOperation(
          operation, 
          this.results.length + index + 1, 
          this.operationQueue.length
        );
        
        // Remove from remaining and active
        const remainingIndex = remainingOperations.indexOf(operation);
        if (remainingIndex >= 0) {
          remainingOperations.splice(remainingIndex, 1);
        }
        this.activeOperations.delete(operation.tableName);
        
        return result;
      });
      
      // Mark tables as active
      toStart.forEach(op => {
        this.activeOperations.set(op.tableName, op);
      });
      
      // Wait for all to complete
      const batchResults = await Promise.all(promises);
      this.results.push(...batchResults);
    }
  }
  
  /**
   * Execute operations based on priority
   */
  async executePriorityBased() {
    // Sort by priority (HIGH > MEDIUM > NORMAL > LOW)
    const priorityOrder = { HIGH: 4, MEDIUM: 3, NORMAL: 2, LOW: 1 };
    const sortedOperations = [...this.operationQueue].sort((a, b) => {
      const aPriority = priorityOrder[a.getPriority()] || 2;
      const bPriority = priorityOrder[b.getPriority()] || 2;
      return bPriority - aPriority;
    });
    
    // Group by priority and execute each group with table parallelization
    const priorityGroups = {};
    sortedOperations.forEach(op => {
      const priority = op.getPriority();
      if (!priorityGroups[priority]) {
        priorityGroups[priority] = [];
      }
      priorityGroups[priority].push(op);
    });
    
    for (const priority of ['HIGH', 'MEDIUM', 'NORMAL', 'LOW']) {
      const group = priorityGroups[priority];
      if (!group || group.length === 0) continue;
      
      // Execute this priority group with table parallelization
      this.operationQueue = group;
      await this.executeTableParallel();
    }
  }
  
  /**
   * Execute a single CIC operation with retry logic
   */
  async executeSingleOperation(operation, position, total) {
    this.emit(new CICOperationStarted(operation, position, total));
    this.progressTracker.startOperation(operation);
    
    const maxRetries = this.strategy.maxRetriesPerOperation;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      operation.retryCount = attempt;
      
      try {
        const startTime = Date.now();
        operation.status = 'running';
        
        // Execute the CREATE INDEX CONCURRENTLY
        await this.sqlExecutor.executeOperation({
          sql: operation.sql,
          metadata: {
            operation: 'CREATE_INDEX_CONCURRENTLY',
            table: operation.tableName,
            timeoutMs: operation.getEstimatedDuration()
          }
        });
        
        const duration = Date.now() - startTime;
        operation.status = 'completed';
        
        this.emit(new CICOperationCompleted(operation, duration, attempt));
        this.progressTracker.completeOperation(operation, true);
        
        return new CICOperationResult(operation, 'completed', duration);
      } catch (error) {
        lastError = error;
        const willRetry = attempt < maxRetries;
        
        this.emit(new CICOperationFailed(operation, error, attempt, willRetry));
        
        if (willRetry) {
          // Calculate backoff delay
          const baseDelay = this.strategy.backoffMultiplier ** attempt * 1000;
          const delay = Math.min(baseDelay, this.strategy.maxBackoffMs);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          operation.status = 'failed';
          operation.error = error;
          this.progressTracker.completeOperation(operation, false);
          
          return new CICOperationResult(operation, 'failed', null, error);
        }
      }
    }
    
    // This should never be reached, but just in case
    return new CICOperationResult(operation, 'failed', null, lastError);
  }
  
  /**
   * Wait for any active operation to complete
   */
  async waitForAnyCompletion() {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.activeOperations.size < this.strategy.maxParallelTables) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }
  
  /**
   * Check if an index already exists
   */
  async indexExists(indexName) {
    try {
      const sql = `
        SELECT 1 FROM pg_indexes 
        WHERE indexname = $1 
        LIMIT 1;
      `;
      
      const result = await this.sqlExecutor.executeOperation({
        sql: sql.replace('$1', `'${indexName}'`),
        metadata: { operation: 'CHECK_INDEX_EXISTS' }
      });
      
      return result.includes('1 row');
    } catch (error) {
      // If we can't check, assume it doesn't exist
      return false;
    }
  }
  
  /**
   * Clean up failed indexes that are in invalid state
   */
  async cleanupFailedIndexes() {
    const failedOperations = this.results.filter(r => r.isFailure());
    if (failedOperations.length === 0) return;
    
    // Find invalid indexes
    const invalidIndexes = [];
    
    for (const result of failedOperations) {
      const operation = result.operation;
      
      try {
        const sql = `
          SELECT indexname 
          FROM pg_indexes 
          WHERE indexname = '${operation.indexName}' 
          AND NOT indisvalid;
        `;
        
        const checkResult = await this.sqlExecutor.executeOperation({
          sql,
          metadata: { operation: 'CHECK_INVALID_INDEX' }
        });
        
        if (checkResult.includes(operation.indexName)) {
          invalidIndexes.push({ name: operation.indexName, operation });
        }
      } catch (error) {
        // Ignore errors during cleanup check
      }
    }
    
    if (invalidIndexes.length === 0) return;
    
    this.emit(new CICCleanupStarted(invalidIndexes));
    
    // Clean up invalid indexes
    for (const invalid of invalidIndexes) {
      try {
        await this.sqlExecutor.executeOperation({
          sql: invalid.operation.getCleanupSql(),
          metadata: { 
            operation: 'CLEANUP_INVALID_INDEX',
            originalOperation: invalid.name
          }
        });
      } catch (error) {
        // Log but don't fail the whole orchestration for cleanup errors
        this.emit(new CICOperationFailed(
          invalid.operation,
          new Error(`Cleanup failed: ${error.message}`),
          0,
          false
        ));
      }
    }
  }
  
  /**
   * Get current orchestration status
   */
  getStatus() {
    if (!this.progressTracker) {
      return { status: 'not_started' };
    }
    
    const progress = this.progressTracker.getProgress();
    const isComplete = progress.processed === progress.total;
    
    return {
      status: isComplete ? 'completed' : 'running',
      progress,
      strategy: this.strategy.type,
      activeOperations: Array.from(this.activeOperations.keys()),
      results: this.results.map(r => ({
        indexName: r.operation.indexName,
        tableName: r.operation.tableName,
        status: r.status,
        duration: r.duration,
        retryCount: r.retryCount
      }))
    };
  }
  
  /**
   * Cancel orchestration (best effort)
   */
  async cancel() {
    // Note: CIC operations cannot be cancelled once started
    // We can only prevent new operations from starting
    this.operationQueue = [];
    
    // Wait for active operations to complete naturally
    const activeOps = Array.from(this.activeOperations.values());
    
    return {
      message: 'Orchestration cancelled - active operations will complete naturally',
      activeOperations: activeOps.map(op => ({
        indexName: op.indexName,
        tableName: op.tableName,
        estimatedCompletion: new Date(Date.now() + op.getEstimatedDuration())
      }))
    };
  }
}