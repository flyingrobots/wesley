/**
 * ErrorRecovery - Comprehensive error recovery system
 * Provides automatic retry logic, rollback capabilities, and intelligent error handling
 */

import { EventEmitter } from '../../util/EventEmitter.mjs';
import CheckpointManager from './CheckpointManager.mjs';

export class ErrorRecovery extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 1000,
      backoffMultiplier: options.backoffMultiplier || 2,
      maxBackoffMs: options.maxBackoffMs || 30000,
      enableAutoRollback: options.enableAutoRollback !== false,
      rollbackTimeoutMs: options.rollbackTimeoutMs || 30000,
      checkpointInterval: options.checkpointInterval || 5000,
      ...options
    };

    this.checkpointManager = options.checkpointManager || new CheckpointManager();
    this.operations = new Map();
    this.errorCategorizer = new ErrorCategorizer();
    this.retryStrategies = new Map();
    
    this.setupDefaultStrategies();
  }

  /**
   * Execute operation with comprehensive error recovery
   */
  async executeWithRecovery(operationId, operation, context = {}) {
    const recoveryContext = new RecoveryContext({
      operationId,
      operation,
      context,
      recovery: this,
      checkpointManager: this.checkpointManager
    });

    this.operations.set(operationId, recoveryContext);

    try {
      this.emit('operation:started', {
        operationId,
        context: context.metadata || {}
      });

      const result = await this.executeWithRetry(recoveryContext);
      
      this.emit('operation:succeeded', {
        operationId,
        result: result.metadata || {}
      });

      // Clean up successful operation checkpoints
      this.checkpointManager.clearOperationCheckpoints(operationId);
      this.operations.delete(operationId);

      return result;

    } catch (error) {
      this.emit('operation:failed', {
        operationId,
        error: error.message,
        attempts: recoveryContext.attempts
      });

      if (this.options.enableAutoRollback) {
        try {
          await this.rollbackOperation(operationId);
        } catch (rollbackError) {
          this.emit('rollback:failed', {
            operationId,
            originalError: error.message,
            rollbackError: rollbackError.message
          });
        }
      }

      this.operations.delete(operationId);
      throw error;
    }
  }

  /**
   * Execute operation with intelligent retry logic
   */
  async executeWithRetry(recoveryContext) {
    const { operationId, operation } = recoveryContext;
    let lastError = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        recoveryContext.attempts = attempt;
        
        // Create checkpoint before each attempt (except first)
        if (attempt > 1) {
          await recoveryContext.createCheckpoint(`attempt_${attempt}`);
        }

        this.emit('retry:attempting', {
          operationId,
          attempt,
          maxAttempts: this.options.maxRetries
        });

        const result = await this.executeOperationWithTimeout(operation, recoveryContext);
        
        this.emit('retry:succeeded', {
          operationId,
          attempt,
          result: result.metadata || {}
        });

        return result;

      } catch (error) {
        lastError = error;
        
        const errorCategory = this.errorCategorizer.categorize(error);
        const shouldRetry = this.shouldRetry(error, attempt, errorCategory);

        this.emit('retry:failed', {
          operationId,
          attempt,
          error: error.message,
          category: errorCategory.type,
          willRetry: shouldRetry && attempt < this.options.maxRetries
        });

        if (!shouldRetry || attempt >= this.options.maxRetries) {
          throw error;
        }

        // Apply recovery strategy
        await this.applyRecoveryStrategy(recoveryContext, error, errorCategory);

        // Wait before next retry with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute operation with timeout protection
   */
  async executeOperationWithTimeout(operation, recoveryContext) {
    const timeout = recoveryContext.context.timeoutMs || 60000;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(operation(recoveryContext))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Determine if operation should be retried based on error
   */
  shouldRetry(error, attempt, errorCategory) {
    if (attempt >= this.options.maxRetries) {
      return false;
    }

    switch (errorCategory.type) {
      case 'network':
      case 'timeout':
      case 'rate_limit':
        return errorCategory.retryable;
      case 'database':
        return errorCategory.retryable && !errorCategory.fatal;
      case 'system':
        return errorCategory.retryable;
      case 'validation':
      case 'business_logic':
        return false; // Don't retry logical errors
      default:
        return errorCategory.retryable;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.options.retryDelayMs;
    const multiplier = Math.pow(this.options.backoffMultiplier, attempt - 1);
    const delay = Math.min(baseDelay * multiplier, this.options.maxBackoffMs);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Apply recovery strategy based on error type
   */
  async applyRecoveryStrategy(recoveryContext, error, errorCategory) {
    const strategyName = this.getStrategyForError(errorCategory);
    const strategy = this.retryStrategies.get(strategyName);

    if (strategy) {
      this.emit('strategy:applying', {
        operationId: recoveryContext.operationId,
        strategy: strategyName,
        error: error.message
      });

      try {
        await strategy(recoveryContext, error, errorCategory);
      } catch (strategyError) {
        this.emit('strategy:failed', {
          operationId: recoveryContext.operationId,
          strategy: strategyName,
          error: strategyError.message
        });
      }
    }
  }

  /**
   * Get appropriate recovery strategy for error type
   */
  getStrategyForError(errorCategory) {
    switch (errorCategory.type) {
      case 'network':
        return 'network_recovery';
      case 'database':
        return 'database_recovery';
      case 'rate_limit':
        return 'rate_limit_recovery';
      case 'timeout':
        return 'timeout_recovery';
      default:
        return 'default_recovery';
    }
  }

  /**
   * Rollback operation to last known good state
   */
  async rollbackOperation(operationId) {
    const recoveryContext = this.operations.get(operationId);
    if (!recoveryContext) {
      throw new Error(`No recovery context found for operation ${operationId}`);
    }

    this.emit('rollback:started', { operationId });

    try {
      const timeout = setTimeout(() => {
        throw new Error(`Rollback timeout after ${this.options.rollbackTimeoutMs}ms`);
      }, this.options.rollbackTimeoutMs);

      // Find the latest checkpoint before the failure
      const checkpoint = this.checkpointManager.getLatestCheckpoint(operationId);
      if (!checkpoint) {
        throw new Error(`No checkpoint found for rollback of operation ${operationId}`);
      }

      // Restore state
      const restored = await this.checkpointManager.restoreCheckpoint(checkpoint.id);
      
      // Apply rollback operations if provided
      if (recoveryContext.context.rollbackOperation) {
        await recoveryContext.context.rollbackOperation(restored.state, recoveryContext);
      }

      clearTimeout(timeout);

      this.emit('rollback:completed', {
        operationId,
        checkpointId: checkpoint.id,
        restoredState: restored.metadata || {}
      });

    } catch (error) {
      this.emit('rollback:failed', {
        operationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Register a custom retry strategy
   */
  registerRetryStrategy(name, strategy) {
    if (typeof strategy !== 'function') {
      throw new Error('Strategy must be a function');
    }
    this.retryStrategies.set(name, strategy);
  }

  /**
   * Setup default recovery strategies
   */
  setupDefaultStrategies() {
    // Network recovery strategy
    this.registerRetryStrategy('network_recovery', async (context, error, category) => {
      // Reset network connections, clear caches, etc.
      this.emit('strategy:network_reset', { operationId: context.operationId });
    });

    // Database recovery strategy  
    this.registerRetryStrategy('database_recovery', async (context, error, category) => {
      // Reset database connections, clear transaction state
      this.emit('strategy:database_reset', { operationId: context.operationId });
    });

    // Rate limit recovery strategy
    this.registerRetryStrategy('rate_limit_recovery', async (context, error, category) => {
      // Wait longer, implement backoff
      const extraDelay = category.retryAfter || 5000;
      await this.sleep(extraDelay);
    });

    // Timeout recovery strategy
    this.registerRetryStrategy('timeout_recovery', async (context, error, category) => {
      // Increase timeout for next attempt
      if (context.context.timeoutMs) {
        context.context.timeoutMs *= 1.5;
      }
    });

    // Default recovery strategy
    this.registerRetryStrategy('default_recovery', async (context, error, category) => {
      // Basic cleanup and reset
      this.emit('strategy:default_cleanup', { operationId: context.operationId });
    });
  }

  /**
   * Get recovery statistics
   */
  getStatistics() {
    const stats = {
      activeOperations: this.operations.size,
      checkpointStats: this.checkpointManager.getStatistics(),
      errorCategories: this.errorCategorizer.getStatistics()
    };

    return stats;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of the error recovery system
   */
  dispose() {
    this.operations.clear();
    this.checkpointManager.dispose();
    this.removeAllListeners();
  }
}

/**
 * Recovery context for individual operations
 */
class RecoveryContext {
  constructor({ operationId, operation, context, recovery, checkpointManager }) {
    this.operationId = operationId;
    this.operation = operation;
    this.context = context;
    this.recovery = recovery;
    this.checkpointManager = checkpointManager;
    this.attempts = 0;
    this.checkpoints = [];
    this.startTime = Date.now();
  }

  /**
   * Create a checkpoint for current state
   */
  async createCheckpoint(name, state = null) {
    const checkpointData = state || this.context.getCurrentState?.() || {};
    const checkpointId = await this.checkpointManager.createCheckpoint(
      `${this.operationId}:${name}`,
      checkpointData,
      { attempt: this.attempts, name }
    );
    
    this.checkpoints.push({ id: checkpointId, name, timestamp: Date.now() });
    return checkpointId;
  }

  /**
   * Restore from a specific checkpoint
   */
  async restoreCheckpoint(checkpointId) {
    return await this.checkpointManager.restoreCheckpoint(checkpointId);
  }

  /**
   * Get operation metadata
   */
  getMetadata() {
    return {
      operationId: this.operationId,
      attempts: this.attempts,
      checkpointCount: this.checkpoints.length,
      duration: Date.now() - this.startTime
    };
  }
}

/**
 * Error categorization system
 */
class ErrorCategorizer {
  constructor() {
    this.stats = new Map();
  }

  /**
   * Categorize error for appropriate handling
   */
  categorize(error) {
    const category = this.determineCategory(error);
    
    // Update statistics
    const current = this.stats.get(category.type) || 0;
    this.stats.set(category.type, current + 1);

    return category;
  }

  /**
   * Determine error category based on error characteristics
   */
  determineCategory(error) {
    const message = error.message.toLowerCase();
    const code = error.code || error.status || '';

    // Network errors
    if (this.isNetworkError(message, code)) {
      return {
        type: 'network',
        retryable: true,
        fatal: false,
        retryAfter: this.parseRetryAfter(error)
      };
    }

    // Database errors
    if (this.isDatabaseError(message, code)) {
      return {
        type: 'database',
        retryable: this.isDatabaseRetryable(message, code),
        fatal: this.isDatabaseFatal(message, code)
      };
    }

    // Timeout errors
    if (this.isTimeoutError(message, code)) {
      return {
        type: 'timeout',
        retryable: true,
        fatal: false
      };
    }

    // Rate limit errors
    if (this.isRateLimitError(message, code)) {
      return {
        type: 'rate_limit',
        retryable: true,
        fatal: false,
        retryAfter: this.parseRetryAfter(error)
      };
    }

    // Validation errors
    if (this.isValidationError(message, code)) {
      return {
        type: 'validation',
        retryable: false,
        fatal: false
      };
    }

    // System errors
    if (this.isSystemError(message, code)) {
      return {
        type: 'system',
        retryable: true,
        fatal: false
      };
    }

    // Default: business logic error
    return {
      type: 'business_logic',
      retryable: false,
      fatal: false
    };
  }

  isNetworkError(message, code) {
    const networkPatterns = [
      'network', 'connection', 'socket', 'timeout', 'dns',
      'econnreset', 'enotfound', 'etimedout', 'econnrefused'
    ];
    const networkCodes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
    
    return networkPatterns.some(pattern => message.includes(pattern)) ||
           networkCodes.includes(code);
  }

  isDatabaseError(message, code) {
    const dbPatterns = ['database', 'sql', 'postgres', 'connection pool', 'deadlock'];
    const dbCodes = ['23000', '23001', '23505', '40001', '40P01'];
    
    return dbPatterns.some(pattern => message.includes(pattern)) ||
           dbCodes.includes(code);
  }

  isDatabaseRetryable(message, code) {
    const retryableCodes = ['40001', '40P01']; // Deadlock, serialization failure
    const nonRetryablePatterns = ['unique constraint', 'foreign key', 'check constraint'];
    
    return retryableCodes.includes(code) && 
           !nonRetryablePatterns.some(pattern => message.includes(pattern));
  }

  isDatabaseFatal(message, code) {
    const fatalPatterns = ['syntax error', 'permission denied', 'does not exist'];
    return fatalPatterns.some(pattern => message.includes(pattern));
  }

  isTimeoutError(message, code) {
    return message.includes('timeout') || code === 'ETIMEDOUT';
  }

  isRateLimitError(message, code) {
    return message.includes('rate limit') || 
           message.includes('too many requests') ||
           code === '429';
  }

  isValidationError(message, code) {
    const validationPatterns = ['validation', 'invalid', 'required', 'format'];
    const validationCodes = ['400', '422'];
    
    return validationPatterns.some(pattern => message.includes(pattern)) ||
           validationCodes.includes(String(code));
  }

  isSystemError(message, code) {
    const systemPatterns = ['memory', 'disk space', 'file system', 'permission'];
    return systemPatterns.some(pattern => message.includes(pattern));
  }

  parseRetryAfter(error) {
    // Try to extract retry-after header or similar
    if (error.headers && error.headers['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after']);
      return isNaN(retryAfter) ? null : retryAfter * 1000;
    }
    return null;
  }

  getStatistics() {
    return Object.fromEntries(this.stats);
  }
}

export default ErrorRecovery;
