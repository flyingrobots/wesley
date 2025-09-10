/**
 * SQLExecutor - Streams SQL to psql without loading entire schema in memory
 * 
 * Features:
 * - Node.js spawn for psql subprocess management
 * - Transaction and advisory lock handling
 * - Progress events per operation
 * - Timeout management
 * - Memory-efficient streaming
 * 
 * Design Philosophy:
 * - Never load entire schemas into memory
 * - Stream SQL directly to psql subprocess
 * - Handle PostgreSQL connections cleanly
 * - Emit detailed progress events
 */

import { spawn } from 'child_process';
import { DomainEvent } from '../Events.mjs';

export class SQLExecutorStarted extends DomainEvent {
  constructor(connectionString, options) {
    super('SQL_EXECUTOR_STARTED', { connectionString: SQLExecutorStarted.maskPassword(connectionString), options });
  }
  
  static maskPassword(connStr) {
    return connStr?.replace(/:([^@:]+)@/, ':***@') || 'masked';
  }
}

export class SQLOperationStarted extends DomainEvent {
  constructor(operation, sqlPreview) {
    super('SQL_OPERATION_STARTED', { 
      operation, 
      sqlPreview: sqlPreview.length > 100 ? sqlPreview.slice(0, 100) + '...' : sqlPreview 
    });
  }
}

export class SQLOperationCompleted extends DomainEvent {
  constructor(operation, rowsAffected, duration) {
    super('SQL_OPERATION_COMPLETED', { operation, rowsAffected, duration });
  }
}

export class SQLExecutorError extends DomainEvent {
  constructor(error, operation) {
    super('SQL_EXECUTOR_ERROR', { error: error.message, operation });
  }
}

export class SQLTransactionStarted extends DomainEvent {
  constructor(isolationLevel) {
    super('SQL_TRANSACTION_STARTED', { isolationLevel });
  }
}

export class SQLTransactionCommitted extends DomainEvent {
  constructor() {
    super('SQL_TRANSACTION_COMMITTED', {});
  }
}

export class SQLTransactionRolledBack extends DomainEvent {
  constructor(reason) {
    super('SQL_TRANSACTION_ROLLED_BACK', { reason });
  }
}

export class SQLAdvisoryLockAcquired extends DomainEvent {
  constructor(lockId, lockType) {
    super('SQL_ADVISORY_LOCK_ACQUIRED', { lockId, lockType });
  }
}

export class SQLAdvisoryLockReleased extends DomainEvent {
  constructor(lockId) {
    super('SQL_ADVISORY_LOCK_RELEASED', { lockId });
  }
}

/**
 * PostgreSQL connection configuration
 */
export class PostgreSQLConnection {
  constructor(connectionString, options = {}) {
    this.connectionString = connectionString;
    this.host = options.host;
    this.port = options.port || 5432;
    this.database = options.database;
    this.username = options.username;
    this.password = options.password;
    this.sslMode = options.sslMode || 'prefer';
    this.applicationName = options.applicationName || 'wesley-sql-executor';
  }
  
  /**
   * Build psql command arguments
   */
  toPsqlArgs() {
    const args = [];
    
    if (this.connectionString) {
      args.push(this.connectionString);
    } else {
      if (this.host) args.push('-h', this.host);
      if (this.port) args.push('-p', this.port.toString());
      if (this.database) args.push('-d', this.database);
      if (this.username) args.push('-U', this.username);
    }
    
    // psql options for non-interactive execution
    args.push(
      '-v', 'ON_ERROR_STOP=1',  // Stop on first error
      '--no-psqlrc',            // Don't load ~/.psqlrc
      '--single-transaction',   // Wrap in transaction
      '--quiet'                 // Minimize output noise
    );
    
    return args;
  }
  
  /**
   * Build environment variables for psql
   */
  toEnv() {
    const env = { ...process.env };
    
    if (this.password) {
      env.PGPASSWORD = this.password;
    }
    
    if (this.applicationName) {
      env.PGAPPNAME = this.applicationName;
    }
    
    if (this.sslMode) {
      env.PGSSLMODE = this.sslMode;
    }
    
    return env;
  }
}

/**
 * SQL execution operation with metadata
 */
export class SQLOperation {
  constructor(sql, metadata = {}) {
    this.sql = sql;
    this.metadata = {
      operation: metadata.operation || 'UNKNOWN',
      table: metadata.table,
      lockLevel: metadata.lockLevel,
      timeoutMs: metadata.timeoutMs || 30000,
      retryable: metadata.retryable || false,
      ...metadata
    };
    this.startTime = null;
    this.endTime = null;
    this.rowsAffected = 0;
    this.error = null;
  }
  
  /**
   * Get operation duration in milliseconds
   */
  getDuration() {
    if (!this.startTime || !this.endTime) return null;
    return this.endTime - this.startTime;
  }
  
  /**
   * Mark operation as started
   */
  start() {
    this.startTime = Date.now();
  }
  
  /**
   * Mark operation as completed
   */
  complete(rowsAffected = 0) {
    this.endTime = Date.now();
    this.rowsAffected = rowsAffected;
  }
  
  /**
   * Mark operation as failed
   */
  fail(error) {
    this.endTime = Date.now();
    this.error = error;
  }
  
  /**
   * Get SQL preview for logging (truncated)
   */
  getSqlPreview() {
    const preview = this.sql.replace(/\s+/g, ' ').trim();
    return preview.length > 200 ? preview.slice(0, 200) + '...' : preview;
  }
}

/**
 * Main SQLExecutor class for streaming SQL execution
 */
export class SQLExecutor {
  constructor(connection, eventEmitter = null) {
    this.connection = connection;
    this.eventEmitter = eventEmitter;
    this.psqlProcess = null;
    this.operations = [];
    this.currentOperation = null;
    this.transactionActive = false;
    this.advisoryLocks = new Set();
    this.timeoutHandle = null;
    this.abortController = new AbortController();
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
   * Start psql subprocess
   */
  async start() {
    const args = this.connection.toPsqlArgs();
    const env = this.connection.toEnv();
    
    this.emit(new SQLExecutorStarted(this.connection.connectionString, { 
      args: args.filter(arg => !arg.includes('password')),
      applicationName: this.connection.applicationName 
    }));
    
    try {
      this.psqlProcess = spawn('psql', args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        signal: this.abortController.signal
      });
      
      // Handle subprocess events
      this.psqlProcess.on('error', (error) => {
        this.emit(new SQLExecutorError(error, 'PROCESS_START'));
      });
      
      this.psqlProcess.on('exit', (code, signal) => {
        if (code !== 0) {
          const error = new Error(`psql process exited with code ${code}, signal: ${signal}`);
          this.emit(new SQLExecutorError(error, 'PROCESS_EXIT'));
        }
      });
      
      // Wait for process to be ready
      await this.waitForReady();
      
      return true;
    } catch (error) {
      this.emit(new SQLExecutorError(error, 'PROCESS_SPAWN'));
      throw error;
    }
  }
  
  /**
   * Wait for psql process to be ready
   */
  async waitForReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for psql process to be ready'));
      }, 5000);
      
      if (this.psqlProcess && this.psqlProcess.pid) {
        clearTimeout(timeout);
        resolve();
      } else {
        this.psqlProcess?.on('spawn', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.psqlProcess?.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      }
    });
  }
  
  /**
   * Execute a single SQL operation
   */
  async executeOperation(operation) {
    if (!this.psqlProcess) {
      throw new Error('SQLExecutor not started. Call start() first.');
    }
    
    this.currentOperation = operation;
    operation.start();
    
    this.emit(new SQLOperationStarted(operation.metadata.operation, operation.getSqlPreview()));
    
    try {
      // Set operation timeout
      this.setOperationTimeout(operation.metadata.timeoutMs);
      
      // Execute the SQL
      const result = await this.executeSql(operation.sql);
      
      // Parse rows affected from psql output
      const rowsAffected = this.parseRowsAffected(result);
      operation.complete(rowsAffected);
      
      this.emit(new SQLOperationCompleted(
        operation.metadata.operation,
        rowsAffected,
        operation.getDuration()
      ));
      
      this.clearOperationTimeout();
      this.currentOperation = null;
      this.operations.push(operation);
      
      return result;
    } catch (error) {
      operation.fail(error);
      this.emit(new SQLExecutorError(error, operation.metadata.operation));
      this.clearOperationTimeout();
      this.currentOperation = null;
      throw error;
    }
  }
  
  /**
   * Execute SQL string via psql stdin
   */
  async executeSql(sql) {
    return new Promise((resolve, reject) => {
      if (!this.psqlProcess || !this.psqlProcess.stdin || !this.psqlProcess.stdout) {
        reject(new Error('psql process not available'));
        return;
      }
      
      let output = '';
      let errorOutput = '';
      
      // Collect stdout
      const onData = (chunk) => {
        output += chunk.toString();
      };
      
      // Collect stderr
      const onError = (chunk) => {
        errorOutput += chunk.toString();
      };
      
      this.psqlProcess.stdout.on('data', onData);
      this.psqlProcess.stderr.on('data', onError);
      
      // Write SQL to stdin
      try {
        this.psqlProcess.stdin.write(sql);
        this.psqlProcess.stdin.write('\n');
        
        // Signal end of this batch
        this.psqlProcess.stdin.write('\\echo "WESLEY_OPERATION_COMPLETE"\n');
        
        // Wait for completion marker
        const checkComplete = () => {
          if (output.includes('WESLEY_OPERATION_COMPLETE')) {
            this.psqlProcess.stdout.removeListener('data', onData);
            this.psqlProcess.stderr.removeListener('data', onError);
            
            if (errorOutput.trim() && !errorOutput.includes('NOTICE:')) {
              reject(new Error(`SQL Error: ${errorOutput.trim()}`));
            } else {
              resolve(output);
            }
          } else {
            // Keep waiting
            setTimeout(checkComplete, 100);
          }
        };
        
        checkComplete();
      } catch (writeError) {
        this.psqlProcess.stdout.removeListener('data', onData);
        this.psqlProcess.stderr.removeListener('data', onError);
        reject(writeError);
      }
    });
  }
  
  /**
   * Start a database transaction
   */
  async startTransaction(isolationLevel = 'READ COMMITTED') {
    const sql = `BEGIN ISOLATION LEVEL ${isolationLevel};`;
    const operation = new SQLOperation(sql, { 
      operation: 'BEGIN_TRANSACTION',
      isolationLevel 
    });
    
    this.emit(new SQLTransactionStarted(isolationLevel));
    await this.executeOperation(operation);
    this.transactionActive = true;
  }
  
  /**
   * Commit the current transaction
   */
  async commitTransaction() {
    if (!this.transactionActive) {
      throw new Error('No active transaction to commit');
    }
    
    const operation = new SQLOperation('COMMIT;', { operation: 'COMMIT_TRANSACTION' });
    await this.executeOperation(operation);
    
    this.transactionActive = false;
    this.emit(new SQLTransactionCommitted());
  }
  
  /**
   * Rollback the current transaction
   */
  async rollbackTransaction(reason = 'Explicit rollback') {
    if (!this.transactionActive) {
      throw new Error('No active transaction to rollback');
    }
    
    const operation = new SQLOperation('ROLLBACK;', { 
      operation: 'ROLLBACK_TRANSACTION',
      reason 
    });
    await this.executeOperation(operation);
    
    this.transactionActive = false;
    this.emit(new SQLTransactionRolledBack(reason));
  }
  
  /**
   * Acquire advisory lock
   */
  async acquireAdvisoryLock(lockId, shared = false) {
    const lockType = shared ? 'SHARED' : 'EXCLUSIVE';
    const functionName = shared ? 'pg_advisory_lock_shared' : 'pg_advisory_lock';
    
    const sql = `SELECT ${functionName}(${lockId});`;
    const operation = new SQLOperation(sql, {
      operation: 'ACQUIRE_ADVISORY_LOCK',
      lockId,
      lockType
    });
    
    await this.executeOperation(operation);
    this.advisoryLocks.add(lockId);
    this.emit(new SQLAdvisoryLockAcquired(lockId, lockType));
  }
  
  /**
   * Release advisory lock
   */
  async releaseAdvisoryLock(lockId, shared = false) {
    const functionName = shared ? 'pg_advisory_unlock_shared' : 'pg_advisory_unlock';
    
    const sql = `SELECT ${functionName}(${lockId});`;
    const operation = new SQLOperation(sql, {
      operation: 'RELEASE_ADVISORY_LOCK',
      lockId
    });
    
    await this.executeOperation(operation);
    this.advisoryLocks.delete(lockId);
    this.emit(new SQLAdvisoryLockReleased(lockId));
  }
  
  /**
   * Execute multiple operations in sequence
   */
  async executeOperations(operations) {
    const results = [];
    
    for (const operation of operations) {
      const result = await this.executeOperation(operation);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Set timeout for current operation
   */
  setOperationTimeout(timeoutMs) {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    
    this.timeoutHandle = setTimeout(() => {
      const error = new Error(`Operation timeout after ${timeoutMs}ms`);
      if (this.currentOperation) {
        this.currentOperation.fail(error);
        this.emit(new SQLExecutorError(error, this.currentOperation.metadata.operation));
      }
    }, timeoutMs);
  }
  
  /**
   * Clear operation timeout
   */
  clearOperationTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
  
  /**
   * Parse rows affected from psql output
   */
  parseRowsAffected(output) {
    // Look for patterns like "INSERT 0 5", "UPDATE 3", "DELETE 2"
    const patterns = [
      /INSERT \d+ (\d+)/,
      /UPDATE (\d+)/,
      /DELETE (\d+)/,
      /(\d+) rows? affected/i
    ];
    
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return 0;
  }
  
  /**
   * Clean shutdown of executor
   */
  async shutdown() {
    try {
      // Release all advisory locks
      for (const lockId of this.advisoryLocks) {
        await this.releaseAdvisoryLock(lockId).catch(() => {
          // Ignore lock release errors during shutdown
        });
      }
      
      // Rollback any active transaction
      if (this.transactionActive) {
        await this.rollbackTransaction('Shutdown').catch(() => {
          // Ignore rollback errors during shutdown
        });
      }
      
      // Clear timeout
      this.clearOperationTimeout();
      
      // Gracefully close psql process
      if (this.psqlProcess && !this.psqlProcess.killed) {
        this.psqlProcess.stdin.write('\\q\n');
        
        // Wait for graceful exit or force kill after 2 seconds
        const exitPromise = new Promise((resolve) => {
          this.psqlProcess.on('exit', resolve);
        });
        
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            if (!this.psqlProcess.killed) {
              this.abortController.abort();
              this.psqlProcess.kill('SIGTERM');
            }
            resolve();
          }, 2000);
        });
        
        await Promise.race([exitPromise, timeoutPromise]);
      }
    } catch (error) {
      this.emit(new SQLExecutorError(error, 'SHUTDOWN'));
    } finally {
      this.psqlProcess = null;
      this.transactionActive = false;
      this.advisoryLocks.clear();
      this.currentOperation = null;
    }
  }
  
  /**
   * Get execution statistics
   */
  getStats() {
    const completed = this.operations.filter(op => !op.error);
    const failed = this.operations.filter(op => op.error);
    
    return {
      totalOperations: this.operations.length,
      completed: completed.length,
      failed: failed.length,
      averageDuration: completed.length > 0 
        ? completed.reduce((sum, op) => sum + op.getDuration(), 0) / completed.length 
        : 0,
      totalRowsAffected: completed.reduce((sum, op) => sum + op.rowsAffected, 0),
      transactionActive: this.transactionActive,
      advisoryLocks: Array.from(this.advisoryLocks)
    };
  }
}