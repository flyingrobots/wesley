/**
 * BatchOptimizer - Performance & Testing Component
 * 
 * Intelligent operation batching for performance optimization
 * - Minimize lock contention through ordering  
 * - Combine compatible operations
 * - Optimize transaction boundaries
 * - Memory-aware batch sizing
 * 
 * Licensed under Apache-2.0
 */

import { DomainEvent } from '../Events.mjs';

/**
 * Custom error types for batch optimization
 */
export class BatchOptimizationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BatchOptimizationError';
    this.details = details;
  }
}

export class BatchSizeExceededError extends BatchOptimizationError {
  constructor(actualSize, maxSize) {
    super(`Batch size ${actualSize} exceeds maximum ${maxSize}`);
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

export class IncompatibleOperationsError extends BatchOptimizationError {
  constructor(op1, op2) {
    super(`Operations ${op1.kind} and ${op2.kind} are incompatible`);
    this.operation1 = op1;
    this.operation2 = op2;
  }
}

/**
 * Domain events for batch optimization
 */
export class BatchOptimizationRequested extends DomainEvent {
  constructor(operations, options) {
    super('BATCH_OPTIMIZATION_REQUESTED', { operations, options });
  }
}

export class BatchOptimized extends DomainEvent {
  constructor(batches, metrics) {
    super('BATCH_OPTIMIZED', { batches, metrics });
  }
}

export class BatchExecutionStarted extends DomainEvent {
  constructor(batchId, operations) {
    super('BATCH_EXECUTION_STARTED', { batchId, operations });
  }
}

export class BatchExecutionCompleted extends DomainEvent {
  constructor(batchId, result, metrics) {
    super('BATCH_EXECUTION_COMPLETED', { batchId, result, metrics });
  }
}

/**
 * BatchOptimizer - Intelligent operation batching for performance
 */
export class BatchOptimizer {
  constructor(options = {}) {
    this.maxBatchSize = options.maxBatchSize || 100;
    this.maxMemoryMB = options.maxMemoryMB || 256;
    this.allowConcurrentSchema = options.allowConcurrentSchema ?? false;
    this.lockTimeout = options.lockTimeout || 30000; // 30 seconds
    this.eventEmitter = options.eventEmitter || null;
  }

  /**
   * Optimize operations into efficient batches
   * @param {Array} operations - Migration operations to optimize
   * @param {Object} options - Optimization options
   * @returns {Array} Array of optimized batches
   */
  async optimizeOperations(operations, options = {}) {
    if (!Array.isArray(operations)) {
      throw new BatchOptimizationError('Operations must be an array');
    }

    this._emit(new BatchOptimizationRequested(operations, options));

    const startTime = performance.now();
    
    // Step 1: Analyze operation dependencies and conflicts
    const analysis = this._analyzeOperations(operations);
    
    // Step 2: Sort operations to minimize lock contention
    const sortedOperations = this._sortForLockMinimization(operations, analysis);
    
    // Step 3: Group compatible operations
    const groups = this._groupCompatibleOperations(sortedOperations, analysis);
    
    // Step 4: Create memory-aware batches
    const batches = this._createMemoryAwareBatches(groups);
    
    // Step 5: Optimize transaction boundaries
    const optimizedBatches = this._optimizeTransactionBoundaries(batches);
    
    const endTime = performance.now();
    const metrics = {
      originalOperationCount: operations.length,
      batchCount: optimizedBatches.length,
      optimizationTime: endTime - startTime,
      averageBatchSize: operations.length / optimizedBatches.length,
      lockConflictReduction: this._calculateLockReduction(analysis),
      memoryEfficiency: this._calculateMemoryEfficiency(optimizedBatches)
    };

    this._emit(new BatchOptimized(optimizedBatches, metrics));

    return {
      batches: optimizedBatches,
      metrics,
      analysis
    };
  }

  /**
   * Execute a batch of operations with monitoring
   * @param {Array} batch - Batch of operations to execute
   * @param {Function} executor - Function to execute operations
   * @param {Object} options - Execution options
   * @returns {Object} Execution result with metrics
   */
  async executeBatch(batch, executor, options = {}) {
    if (!Array.isArray(batch) || batch.length === 0) {
      throw new BatchOptimizationError('Batch must be a non-empty array');
    }

    if (typeof executor !== 'function') {
      throw new BatchOptimizationError('Executor must be a function');
    }

    const batchId = crypto.randomUUID?.() || Math.random().toString(36);
    const startTime = performance.now();

    this._emit(new BatchExecutionStarted(batchId, batch));

    try {
      // Execute with timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Batch execution timeout')), 
                  options.timeout || this.lockTimeout);
      });

      const executionPromise = executor(batch, {
        batchId,
        concurrency: options.concurrency || 1,
        rollbackOnError: options.rollbackOnError ?? true
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const endTime = performance.now();

      const metrics = {
        batchId,
        executionTime: endTime - startTime,
        operationCount: batch.length,
        throughput: batch.length / (endTime - startTime) * 1000, // ops/sec
        success: true
      };

      this._emit(new BatchExecutionCompleted(batchId, result, metrics));

      return {
        result,
        metrics,
        batchId
      };

    } catch (error) {
      const endTime = performance.now();
      const metrics = {
        batchId,
        executionTime: endTime - startTime,
        operationCount: batch.length,
        error: error.message,
        success: false
      };

      this._emit(new BatchExecutionCompleted(batchId, null, metrics));
      
      throw new BatchOptimizationError(`Batch execution failed: ${error.message}`, {
        batchId,
        originalError: error,
        metrics
      });
    }
  }

  /**
   * Analyze operations for dependencies and conflicts
   * @private
   */
  _analyzeOperations(operations) {
    const analysis = {
      dependencies: new Map(),
      conflicts: new Map(),
      tableOperations: new Map(),
      riskScore: 0,
      schemaChanges: 0,
      dataChanges: 0
    };

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      
      // Track operations by table
      const table = op.table || op.schema || 'global';
      if (!analysis.tableOperations.has(table)) {
        analysis.tableOperations.set(table, []);
      }
      analysis.tableOperations.get(table).push({ operation: op, index: i });

      // Analyze dependencies
      const deps = this._findDependencies(op, operations.slice(0, i));
      if (deps.length > 0) {
        analysis.dependencies.set(i, deps);
      }

      // Analyze conflicts
      const conflicts = this._findConflicts(op, operations.slice(i + 1));
      if (conflicts.length > 0) {
        analysis.conflicts.set(i, conflicts.map(c => c.index + i + 1));
      }

      // Track change types
      if (this._isSchemaChange(op)) {
        analysis.schemaChanges++;
      }
      if (this._isDataChange(op)) {
        analysis.dataChanges++;
      }

      // Add to risk score
      analysis.riskScore += this._calculateOperationRisk(op);
    }

    return analysis;
  }

  /**
   * Sort operations to minimize lock contention
   * @private
   */
  _sortForLockMinimization(operations, analysis) {
    // Create a copy for sorting
    const indexed = operations.map((op, i) => ({ operation: op, originalIndex: i }));

    // Sort by lock priority: DDL before DML, table creation before modification
    return indexed.sort((a, b) => {
      const priorityA = this._getLockPriority(a.operation);
      const priorityB = this._getLockPriority(b.operation);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, maintain dependency order
      const depsA = analysis.dependencies.get(a.originalIndex) || [];
      const depsB = analysis.dependencies.get(b.originalIndex) || [];

      if (depsA.includes(b.originalIndex)) return 1;
      if (depsB.includes(a.originalIndex)) return -1;

      // Otherwise maintain original order
      return a.originalIndex - b.originalIndex;
    }).map(item => item.operation);
  }

  /**
   * Group compatible operations that can be batched together
   * @private
   */
  _groupCompatibleOperations(operations, analysis) {
    const groups = [];
    let currentGroup = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      if (currentGroup.length === 0) {
        currentGroup.push(operation);
        continue;
      }

      // Check if operation is compatible with current group
      const compatible = currentGroup.every(groupOp => 
        this._areCompatible(groupOp, operation)
      );

      if (compatible && currentGroup.length < this.maxBatchSize) {
        currentGroup.push(operation);
      } else {
        // Start new group
        groups.push([...currentGroup]);
        currentGroup = [operation];
      }
    }

    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Create batches with memory awareness
   * @private
   */
  _createMemoryAwareBatches(groups) {
    const batches = [];

    for (const group of groups) {
      let currentBatch = [];
      let currentMemory = 0;

      for (const operation of group) {
        const opMemory = this._estimateOperationMemory(operation);

        if (currentBatch.length === 0 ||
            (currentMemory + opMemory <= this.maxMemoryMB && 
             currentBatch.length < this.maxBatchSize)) {
          currentBatch.push(operation);
          currentMemory += opMemory;
        } else {
          // Start new batch
          batches.push({
            operations: [...currentBatch],
            estimatedMemoryMB: currentMemory,
            batchType: this._determineBatchType(currentBatch)
          });
          currentBatch = [operation];
          currentMemory = opMemory;
        }
      }

      // Add final batch
      if (currentBatch.length > 0) {
        batches.push({
          operations: [...currentBatch],
          estimatedMemoryMB: currentMemory,
          batchType: this._determineBatchType(currentBatch)
        });
      }
    }

    return batches;
  }

  /**
   * Optimize transaction boundaries for performance
   * @private
   */
  _optimizeTransactionBoundaries(batches) {
    return batches.map(batch => {
      const hasSchemaChanges = batch.operations.some(op => this._isSchemaChange(op));
      const hasDataChanges = batch.operations.some(op => this._isDataChange(op));
      const hasRiskyOperations = batch.operations.some(op => 
        this._calculateOperationRisk(op) >= 50
      );

      return {
        ...batch,
        transactionMode: hasRiskyOperations ? 'explicit' : 'auto',
        isolationLevel: hasSchemaChanges ? 'serializable' : 'read_committed',
        requiresExclusiveLock: hasSchemaChanges,
        canRunConcurrently: !hasSchemaChanges && !hasRiskyOperations,
        rollbackPolicy: hasRiskyOperations ? 'immediate' : 'deferred'
      };
    });
  }

  /**
   * Find operations that this operation depends on
   * @private
   */
  _findDependencies(operation, previousOperations) {
    const dependencies = [];

    for (let i = 0; i < previousOperations.length; i++) {
      const prevOp = previousOperations[i];

      // Table creation dependency
      if (operation.table && prevOp.kind === 'create_table' && 
          prevOp.table === operation.table) {
        dependencies.push(i);
      }

      // Foreign key dependency
      if (operation.kind === 'add_constraint' && 
          operation.constraintType === 'foreign_key' &&
          prevOp.kind === 'create_table' &&
          prevOp.table === operation.references) {
        dependencies.push(i);
      }

      // Column dependency
      if (operation.column && prevOp.kind === 'add_column' &&
          prevOp.table === operation.table && 
          prevOp.column === operation.column) {
        dependencies.push(i);
      }
    }

    return dependencies;
  }

  /**
   * Find operations that conflict with this operation
   * @private
   */
  _findConflicts(operation, laterOperations) {
    const conflicts = [];

    for (let i = 0; i < laterOperations.length; i++) {
      const laterOp = laterOperations[i];

      // Same table, incompatible operations
      if (operation.table === laterOp.table) {
        if ((operation.kind === 'drop_table' && laterOp.table === operation.table) ||
            (operation.kind === 'rename_table' && laterOp.table === operation.table) ||
            (operation.kind === 'drop_column' && laterOp.column === operation.column)) {
          conflicts.push({ operation: laterOp, index: i });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two operations are compatible for batching
   * @private
   */
  _areCompatible(op1, op2) {
    // Schema changes generally can't be batched with data changes
    if (this._isSchemaChange(op1) !== this._isSchemaChange(op2)) {
      return this.allowConcurrentSchema;
    }

    // Same table operations need careful ordering
    if (op1.table === op2.table) {
      const incompatiblePairs = [
        ['drop_table', 'create_table'],
        ['drop_column', 'add_column'],
        ['rename_table', 'create_table'],
        ['rename_column', 'add_column']
      ];

      for (const [first, second] of incompatiblePairs) {
        if ((op1.kind === first && op2.kind === second) ||
            (op1.kind === second && op2.kind === first)) {
          return false;
        }
      }
    }

    // High-risk operations should be isolated
    const risk1 = this._calculateOperationRisk(op1);
    const risk2 = this._calculateOperationRisk(op2);
    
    if (risk1 >= 80 || risk2 >= 80) {
      return false;
    }

    return true;
  }

  /**
   * Get lock priority for operation (lower = higher priority)
   * @private
   */
  _getLockPriority(operation) {
    const priorities = {
      'create_table': 1,
      'create_index': 2,
      'add_column': 3,
      'add_constraint': 4,
      'alter_type': 5,
      'rename_column': 6,
      'rename_table': 7,
      'drop_constraint': 8,
      'drop_column': 9,
      'drop_table': 10
    };

    return priorities[operation.kind] || 5;
  }

  /**
   * Estimate memory usage for operation
   * @private
   */
  _estimateOperationMemory(operation) {
    // Base memory estimates in MB
    const baseMemory = {
      'create_table': 5,
      'drop_table': 2,
      'add_column': 3,
      'drop_column': 1,
      'alter_type': 10, // Type conversion can be expensive
      'create_index': 20, // Index creation is memory intensive
      'add_constraint': 5,
      'drop_constraint': 1,
      'rename_table': 1,
      'rename_column': 1
    };

    return baseMemory[operation.kind] || 2;
  }

  /**
   * Determine batch type based on operations
   * @private
   */
  _determineBatchType(operations) {
    const hasSchema = operations.some(op => this._isSchemaChange(op));
    const hasData = operations.some(op => this._isDataChange(op));
    const hasIndex = operations.some(op => op.kind.includes('index'));

    if (hasSchema && hasData) return 'mixed';
    if (hasSchema) return 'schema';
    if (hasData) return 'data';
    if (hasIndex) return 'index';
    return 'utility';
  }

  /**
   * Check if operation is a schema change
   * @private
   */
  _isSchemaChange(operation) {
    const schemaOps = [
      'create_table', 'drop_table', 'rename_table',
      'add_column', 'drop_column', 'rename_column', 'alter_type',
      'add_constraint', 'drop_constraint'
    ];
    return schemaOps.includes(operation.kind);
  }

  /**
   * Check if operation is a data change
   * @private
   */
  _isDataChange(operation) {
    const dataOps = ['insert', 'update', 'delete', 'truncate'];
    return dataOps.includes(operation.kind);
  }

  /**
   * Calculate risk score for operation
   * @private
   */
  _calculateOperationRisk(operation) {
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

    return riskScores[operation.kind] || 0;
  }

  /**
   * Calculate lock conflict reduction percentage
   * @private
   */
  _calculateLockReduction(analysis) {
    const totalConflicts = Array.from(analysis.conflicts.values())
      .reduce((sum, conflicts) => sum + conflicts.length, 0);
    
    if (totalConflicts === 0) return 0;
    
    // Estimate reduction based on ordering and grouping
    return Math.min(75, totalConflicts * 5); // Up to 75% reduction
  }

  /**
   * Calculate memory efficiency score
   * @private
   */
  _calculateMemoryEfficiency(batches) {
    const totalMemory = batches.reduce((sum, batch) => sum + batch.estimatedMemoryMB, 0);
    const avgMemoryPerBatch = totalMemory / batches.length;
    const efficiency = (avgMemoryPerBatch / this.maxMemoryMB) * 100;
    
    return Math.min(100, efficiency);
  }

  /**
   * Emit event if emitter is configured
   * @private
   */
  _emit(event) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit(event.type, event);
    }
  }
}

// Export singleton with default settings
export const batchOptimizer = new BatchOptimizer();