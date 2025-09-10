/**
 * Lock-Aware PostgreSQL Executor
 * 
 * Executes SQL operations with awareness of PostgreSQL lock levels,
 * concurrent safety, and resource contention management.
 */

export class LockAwareExecutor {
  constructor(connectionPool, options = {}) {
    this.pool = connectionPool;
    this.maxConcurrency = options.maxConcurrency || 4;
    this.lockTimeout = options.lockTimeout || 30000; // 30 seconds
    this.deadlockRetries = options.deadlockRetries || 3;
    this.backpressureThreshold = options.backpressureThreshold || 0.8;
    
    // Track active operations by lock level
    this.activeLocks = new Map();
    this.lockQueue = new Map();
    this.operationHistory = [];
  }
  
  /**
   * Execute a SQL operation with lock awareness
   */
  async execute(operation, context = {}) {
    const lockLevel = this.analyzeLockLevel(operation.sql);
    const resourceKey = this.getResourceKey(operation);
    
    // Check for conflicts and queue if necessary
    if (await this.hasConflicts(lockLevel, resourceKey)) {
      return this.queueOperation(operation, context);
    }
    
    // Reserve resources and execute
    return this.executeWithLockManagement(operation, context, lockLevel, resourceKey);
  }
  
  /**
   * Analyze the lock level required for a SQL statement
   */
  analyzeLockLevel(sql) {
    const upperSql = sql.toUpperCase().trim();
    
    // DDL Operations - typically require ACCESS EXCLUSIVE
    if (this.isDDLOperation(upperSql)) {
      return {
        type: 'DDL',
        level: 'ACCESS_EXCLUSIVE',
        canRunConcurrently: false,
        blocksReads: true,
        blocksWrites: true
      };
    }
    
    // CREATE INDEX CONCURRENTLY - special case
    if (upperSql.includes('CREATE') && upperSql.includes('INDEX') && upperSql.includes('CONCURRENTLY')) {
      return {
        type: 'CIC',
        level: 'SHARE_UPDATE_EXCLUSIVE',
        canRunConcurrently: false, // Only one CIC per table
        blocksReads: false,
        blocksWrites: false,
        requiresSpecialHandling: true
      };
    }
    
    // DML Operations
    if (upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE')) {
      return {
        type: 'DML',
        level: 'ROW_EXCLUSIVE',
        canRunConcurrently: true,
        blocksReads: false,
        blocksWrites: false
      };
    }
    
    // SELECT operations
    if (upperSql.startsWith('SELECT')) {
      return {
        type: 'SELECT',
        level: 'ACCESS_SHARE',
        canRunConcurrently: true,
        blocksReads: false,
        blocksWrites: false
      };
    }
    
    // Default to safest assumption
    return {
      type: 'UNKNOWN',
      level: 'EXCLUSIVE',
      canRunConcurrently: false,
      blocksReads: true,
      blocksWrites: true
    };
  }
  
  /**
   * Check if operation is DDL
   */
  isDDLOperation(sql) {
    const ddlKeywords = [
      'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
      'CREATE INDEX', 'DROP INDEX',
      'ADD CONSTRAINT', 'DROP CONSTRAINT',
      'ADD COLUMN', 'DROP COLUMN',
      'TRUNCATE'
    ];
    
    return ddlKeywords.some(keyword => sql.includes(keyword));
  }
  
  /**
   * Get resource key for conflict detection
   */
  getResourceKey(operation) {
    // Extract table names from SQL
    const tables = this.extractTableNames(operation.sql);
    return tables.sort().join(',');
  }
  
  /**
   * Extract table names from SQL statement
   */
  extractTableNames(sql) {
    const tables = new Set();
    const upperSql = sql.toUpperCase();
    
    // Simple regex-based extraction (could be enhanced with proper parsing)
    const tablePatterns = [
      /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(?:"([^"]+)"|(\w+))/g,
      /(?:ALTER|DROP)\s+TABLE\s+(?:"([^"]+)"|(\w+))/g
    ];
    
    for (const pattern of tablePatterns) {
      let match;
      while ((match = pattern.exec(upperSql)) !== null) {
        const tableName = match[1] || match[2];
        if (tableName) {
          tables.add(tableName.toLowerCase());
        }
      }
    }
    
    return Array.from(tables);
  }
  
  /**
   * Check for lock conflicts
   */
  async hasConflicts(lockLevel, resourceKey) {
    const activeOps = this.activeLocks.get(resourceKey) || [];
    
    // ACCESS EXCLUSIVE blocks everything
    if (lockLevel.level === 'ACCESS_EXCLUSIVE') {
      return activeOps.length > 0;
    }
    
    // Check for conflicting operations
    for (const activeOp of activeOps) {
      if (this.locksConflict(lockLevel, activeOp.lockLevel)) {
        return true;
      }
    }
    
    // Special handling for CREATE INDEX CONCURRENTLY
    if (lockLevel.type === 'CIC') {
      // Only one CIC per table at a time
      const hasCIC = activeOps.some(op => op.lockLevel.type === 'CIC');
      if (hasCIC) return true;
    }
    
    // Check connection pool capacity
    const poolStats = await this.pool.getStats();
    if (poolStats.active / poolStats.total > this.backpressureThreshold) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if two lock levels conflict
   */
  locksConflict(lock1, lock2) {
    // Simplified conflict matrix
    const conflicts = {
      'ACCESS_EXCLUSIVE': ['*'], // Blocks everything
      'EXCLUSIVE': ['ACCESS_SHARE', 'ROW_SHARE', 'ROW_EXCLUSIVE', 'SHARE_UPDATE_EXCLUSIVE', 'SHARE', 'EXCLUSIVE'],
      'SHARE_UPDATE_EXCLUSIVE': ['ROW_EXCLUSIVE', 'SHARE_UPDATE_EXCLUSIVE', 'SHARE', 'EXCLUSIVE'],
      'SHARE': ['ROW_EXCLUSIVE', 'SHARE_UPDATE_EXCLUSIVE', 'EXCLUSIVE'],
      'ROW_EXCLUSIVE': ['SHARE', 'SHARE_UPDATE_EXCLUSIVE', 'EXCLUSIVE'],
      'ROW_SHARE': ['EXCLUSIVE'],
      'ACCESS_SHARE': ['ACCESS_EXCLUSIVE', 'EXCLUSIVE']
    };
    
    const lock1Conflicts = conflicts[lock1.level] || [];
    if (lock1Conflicts.includes('*') || lock1Conflicts.includes(lock2.level)) {
      return true;
    }
    
    const lock2Conflicts = conflicts[lock2.level] || [];
    if (lock2Conflicts.includes('*') || lock2Conflicts.includes(lock1.level)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Queue operation for later execution
   */
  async queueOperation(operation, context) {
    const resourceKey = this.getResourceKey(operation);
    
    if (!this.lockQueue.has(resourceKey)) {
      this.lockQueue.set(resourceKey, []);
    }
    
    return new Promise((resolve, reject) => {
      this.lockQueue.get(resourceKey).push({
        operation,
        context,
        resolve,
        reject,
        queuedAt: Date.now()
      });
      
      // Set timeout
      setTimeout(() => {
        reject(new Error(`Operation timed out waiting for lock on ${resourceKey}`));
      }, this.lockTimeout);
    });
  }
  
  /**
   * Execute operation with full lock management
   */
  async executeWithLockManagement(operation, context, lockLevel, resourceKey) {
    const startTime = Date.now();
    let connection = null;
    
    try {
      // Reserve lock tracking
      if (!this.activeLocks.has(resourceKey)) {
        this.activeLocks.set(resourceKey, []);
      }
      
      const lockInfo = {
        operation: operation.id || `op_${Date.now()}`,
        lockLevel,
        startTime,
        resourceKey
      };
      
      this.activeLocks.get(resourceKey).push(lockInfo);
      
      // Get connection from pool
      connection = await this.pool.acquire();
      
      // Set lock timeout
      await connection.query(`SET lock_timeout = ${this.lockTimeout}`);
      
      // Execute the operation
      const result = await this.executeOperation(connection, operation, context);
      
      // Record success
      this.recordOperationResult(operation, 'success', Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      this.recordOperationResult(operation, 'error', Date.now() - startTime, error);
      
      // Handle deadlocks with retry
      if (this.isDeadlock(error) && (context.retryCount || 0) < this.deadlockRetries) {
        const delay = Math.pow(2, context.retryCount || 0) * 1000; // Exponential backoff
        await this.sleep(delay);
        
        return this.execute(operation, { ...context, retryCount: (context.retryCount || 0) + 1 });
      }
      
      throw error;
      
    } finally {
      // Clean up lock tracking
      if (this.activeLocks.has(resourceKey)) {
        const locks = this.activeLocks.get(resourceKey);
        const index = locks.findIndex(l => l.startTime === startTime);
        if (index >= 0) {
          locks.splice(index, 1);
        }
        
        if (locks.length === 0) {
          this.activeLocks.delete(resourceKey);
        }
      }
      
      // Release connection
      if (connection) {
        await this.pool.release(connection);
      }
      
      // Process queued operations
      await this.processQueue(resourceKey);
    }
  }
  
  /**
   * Execute the actual SQL operation
   */
  async executeOperation(connection, operation, context) {
    if (operation.transaction) {
      return this.executeTransaction(connection, operation, context);
    } else {
      return connection.query(operation.sql, operation.params);
    }
  }
  
  /**
   * Execute operation within a transaction
   */
  async executeTransaction(connection, operation, context) {
    await connection.query('BEGIN');
    
    try {
      const result = await connection.query(operation.sql, operation.params);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  }
  
  /**
   * Check if error is a deadlock
   */
  isDeadlock(error) {
    return error.code === '40P01' || error.message.includes('deadlock detected');
  }
  
  /**
   * Record operation result for monitoring
   */
  recordOperationResult(operation, status, duration, error = null) {
    this.operationHistory.push({
      operation: operation.id || operation.sql.substring(0, 50),
      status,
      duration,
      timestamp: Date.now(),
      error: error ? error.message : null
    });
    
    // Keep only last 1000 operations
    if (this.operationHistory.length > 1000) {
      this.operationHistory.shift();
    }
  }
  
  /**
   * Process queued operations for a resource
   */
  async processQueue(resourceKey) {
    const queue = this.lockQueue.get(resourceKey);
    if (!queue || queue.length === 0) return;
    
    // Try to execute next operation in queue
    const next = queue.shift();
    if (next) {
      try {
        const result = await this.execute(next.operation, next.context);
        next.resolve(result);
      } catch (error) {
        next.reject(error);
      }
    }
  }
  
  /**
   * Get executor statistics
   */
  getStats() {
    const now = Date.now();
    const recentOps = this.operationHistory.filter(op => now - op.timestamp < 60000); // Last minute
    
    return {
      activeLocks: this.activeLocks.size,
      queuedOperations: Array.from(this.lockQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      recentOperations: recentOps.length,
      successRate: recentOps.length > 0 ? recentOps.filter(op => op.status === 'success').length / recentOps.length : 1,
      averageDuration: recentOps.length > 0 ? recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length : 0
    };
  }
  
  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}