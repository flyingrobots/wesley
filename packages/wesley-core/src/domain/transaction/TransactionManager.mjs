/**
 * TransactionManager
 * Provides advanced transaction management with savepoints, deadlock detection, and nested transactions
 */

import { DomainEvent } from '../Events.mjs';

/**
 * Transaction error classes
 */
export class TransactionError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'TransactionError';
    this.originalError = originalError;
    this.code = originalError?.code;
    this.details = originalError?.details;
  }
}

export class DeadlockError extends TransactionError {
  constructor(message, originalError, retryCount) {
    super(message, originalError);
    this.name = 'DeadlockError';
    this.retryCount = retryCount;
  }
}

export class SavepointError extends TransactionError {
  constructor(message, savepointName, originalError) {
    super(message, originalError);
    this.name = 'SavepointError';
    this.savepointName = savepointName;
  }
}

/**
 * Transaction Events
 */
export class TransactionStarted extends DomainEvent {
  constructor(transactionId, isolationLevel) {
    super('TRANSACTION_STARTED', { transactionId, isolationLevel });
  }
}

export class TransactionCommitted extends DomainEvent {
  constructor(transactionId, duration) {
    super('TRANSACTION_COMMITTED', { transactionId, duration });
  }
}

export class TransactionRolledBack extends DomainEvent {
  constructor(transactionId, reason, savepointName = null) {
    super('TRANSACTION_ROLLED_BACK', { transactionId, reason, savepointName });
  }
}

export class SavepointCreated extends DomainEvent {
  constructor(transactionId, savepointName) {
    super('SAVEPOINT_CREATED', { transactionId, savepointName });
  }
}

export class DeadlockDetected extends DomainEvent {
  constructor(transactionId, retryCount, maxRetries) {
    super('DEADLOCK_DETECTED', { transactionId, retryCount, maxRetries });
  }
}

/**
 * Transaction isolation levels
 */
export const IsolationLevel = {
  READ_UNCOMMITTED: 'READ UNCOMMITTED',
  READ_COMMITTED: 'READ COMMITTED', 
  REPEATABLE_READ: 'REPEATABLE READ',
  SERIALIZABLE: 'SERIALIZABLE'
};

/**
 * TransactionManager - Manages database transactions with advanced features
 */
export class TransactionManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 100; // milliseconds
    this.maxSavepoints = options.maxSavepoints || 32; // PostgreSQL limit
    this.defaultIsolationLevel = options.defaultIsolationLevel || IsolationLevel.READ_COMMITTED;
    this.deadlockTimeout = options.deadlockTimeout || 30000; // 30 seconds
    this.eventEmitter = options.eventEmitter || null;
    
    // Active transactions and savepoints
    this.activeTransactions = new Map();
    this.savepointStack = new Map(); // transactionId -> savepoint stack
  }

  /**
   * Start a new transaction with optional isolation level
   */
  async beginTransaction(client, options = {}) {
    const transactionId = this.generateTransactionId();
    const isolationLevel = options.isolationLevel || this.defaultIsolationLevel;
    const startTime = Date.now();

    try {
      await client.query('BEGIN');
      
      if (isolationLevel !== IsolationLevel.READ_COMMITTED) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      }

      const transaction = {
        id: transactionId,
        client,
        startTime,
        isolationLevel,
        savepoints: [],
        status: 'active'
      };

      this.activeTransactions.set(transactionId, transaction);
      this.savepointStack.set(transactionId, []);

      this.emitEvent(new TransactionStarted(transactionId, isolationLevel));

      return transactionId;
    } catch (error) {
      throw new TransactionError(`Failed to begin transaction: ${error.message}`, error);
    }
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new TransactionError(`Transaction ${transactionId} is not active`);
    }

    try {
      const startTime = transaction.startTime;
      await transaction.client.query('COMMIT');
      
      const duration = Date.now() - startTime;
      transaction.status = 'committed';

      this.activeTransactions.delete(transactionId);
      this.savepointStack.delete(transactionId);

      this.emitEvent(new TransactionCommitted(transactionId, duration));

      return duration;
    } catch (error) {
      transaction.status = 'error';
      throw new TransactionError(`Failed to commit transaction: ${error.message}`, error);
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId, reason = 'Manual rollback') {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`);
    }

    try {
      await transaction.client.query('ROLLBACK');
      transaction.status = 'rolled_back';

      this.activeTransactions.delete(transactionId);
      this.savepointStack.delete(transactionId);

      this.emitEvent(new TransactionRolledBack(transactionId, reason));
    } catch (error) {
      transaction.status = 'error';
      throw new TransactionError(`Failed to rollback transaction: ${error.message}`, error);
    }
  }

  /**
   * Create a savepoint within a transaction
   */
  async createSavepoint(transactionId, savepointName = null) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new TransactionError(`Transaction ${transactionId} is not active`);
    }

    const savepoints = this.savepointStack.get(transactionId);
    if (savepoints.length >= this.maxSavepoints) {
      throw new SavepointError(`Maximum savepoints (${this.maxSavepoints}) reached for transaction ${transactionId}`);
    }

    const name = savepointName || `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await transaction.client.query(`SAVEPOINT ${name}`);
      
      const savepoint = {
        name,
        createdAt: new Date(),
        transactionId
      };

      savepoints.push(savepoint);
      transaction.savepoints.push(savepoint);

      this.emitEvent(new SavepointCreated(transactionId, name));

      return name;
    } catch (error) {
      throw new SavepointError(`Failed to create savepoint: ${error.message}`, name, error);
    }
  }

  /**
   * Rollback to a specific savepoint
   */
  async rollbackToSavepoint(transactionId, savepointName) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`);
    }

    const savepoints = this.savepointStack.get(transactionId);
    const savepointIndex = savepoints.findIndex(sp => sp.name === savepointName);
    
    if (savepointIndex === -1) {
      throw new SavepointError(`Savepoint ${savepointName} not found in transaction ${transactionId}`, savepointName);
    }

    try {
      await transaction.client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);

      // Remove savepoints created after this one
      const removedSavepoints = savepoints.splice(savepointIndex + 1);
      transaction.savepoints = transaction.savepoints.filter(
        sp => !removedSavepoints.some(removed => removed.name === sp.name)
      );

      this.emitEvent(new TransactionRolledBack(transactionId, 'Rollback to savepoint', savepointName));
    } catch (error) {
      throw new SavepointError(`Failed to rollback to savepoint: ${error.message}`, savepointName, error);
    }
  }

  /**
   * Release a savepoint (remove it from the stack)
   */
  async releaseSavepoint(transactionId, savepointName) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`);
    }

    const savepoints = this.savepointStack.get(transactionId);
    const savepointIndex = savepoints.findIndex(sp => sp.name === savepointName);
    
    if (savepointIndex === -1) {
      throw new SavepointError(`Savepoint ${savepointName} not found`, savepointName);
    }

    try {
      await transaction.client.query(`RELEASE SAVEPOINT ${savepointName}`);

      // Remove this savepoint and all newer ones
      const removedSavepoints = savepoints.splice(savepointIndex);
      transaction.savepoints = transaction.savepoints.filter(
        sp => !removedSavepoints.some(removed => removed.name === sp.name)
      );
    } catch (error) {
      throw new SavepointError(`Failed to release savepoint: ${error.message}`, savepointName, error);
    }
  }

  /**
   * Execute a function with retry logic for deadlock handling
   */
  async executeWithDeadlockRetry(transactionId, operation, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        if (this.isDeadlockError(error) && retryCount < maxRetries) {
          retryCount++;
          
          this.emitEvent(new DeadlockDetected(transactionId, retryCount, maxRetries));

          // Exponential backoff with jitter
          const delay = this.retryDelay * Math.pow(2, retryCount - 1) + Math.random() * 100;
          await this.sleep(delay);
          
          continue;
        }

        // If it's a deadlock and we've exhausted retries, throw DeadlockError
        if (this.isDeadlockError(error)) {
          throw new DeadlockError(
            `Deadlock occurred after ${retryCount} retries: ${error.message}`,
            error,
            retryCount
          );
        }

        // Re-throw non-deadlock errors immediately
        throw error;
      }
    }
  }

  /**
   * Execute a function within a transaction with automatic rollback on error
   */
  async executeInTransaction(client, operation, options = {}) {
    const transactionId = await this.beginTransaction(client, options);

    try {
      const result = await this.executeWithDeadlockRetry(transactionId, operation, options);
      await this.commitTransaction(transactionId);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transactionId, error.message);
      throw error;
    }
  }

  /**
   * Execute with nested savepoint protection
   */
  async executeWithSavepoint(transactionId, operation, savepointName = null) {
    const savepoint = await this.createSavepoint(transactionId, savepointName);

    try {
      return await operation();
    } catch (error) {
      await this.rollbackToSavepoint(transactionId, savepoint);
      throw error;
    }
  }

  /**
   * Get transaction status and info
   */
  getTransactionInfo(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      status: transaction.status,
      isolationLevel: transaction.isolationLevel,
      startTime: transaction.startTime,
      duration: Date.now() - transaction.startTime,
      savepointCount: transaction.savepoints.length,
      savepoints: transaction.savepoints.map(sp => ({
        name: sp.name,
        createdAt: sp.createdAt
      }))
    };
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.keys()).map(id => this.getTransactionInfo(id));
  }

  /**
   * Check if an error is a deadlock error
   */
  isDeadlockError(error) {
    return error.code === '40P01' || // deadlock_detected
           error.code === '40001' || // serialization_failure  
           (error.message && error.message.includes('deadlock'));
  }

  /**
   * Generate a unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit event if event emitter is configured
   */
  emitEvent(event) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit('transaction_event', event);
    }
  }

  /**
   * Cleanup - rollback any active transactions (for graceful shutdown)
   */
  async cleanup() {
    const activeIds = Array.from(this.activeTransactions.keys());
    
    for (const transactionId of activeIds) {
      try {
        await this.rollbackTransaction(transactionId, 'Cleanup on shutdown');
      } catch (error) {
        // Log error but don't throw - we're cleaning up
        console.warn(`Failed to cleanup transaction ${transactionId}:`, error.message);
      }
    }

    this.activeTransactions.clear();
    this.savepointStack.clear();
  }
}

// Export singleton for convenience
export const transactionManager = new TransactionManager();