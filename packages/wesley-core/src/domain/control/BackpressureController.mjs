/**
 * Backpressure Controller
 * Adaptive rate limiting based on database load, connection pool pressure monitoring,
 * and automatic throttling during high load conditions
 * 
 * @license Apache-2.0
 */

import { EventEmitter } from '../../util/EventEmitter.mjs';
import { DomainEvent } from '../Events.mjs';

/**
 * Custom error types for backpressure control
 */
export class BackpressureError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'BackpressureError';
    this.code = code;
    this.context = context;
  }
}

export class CircuitBreakerError extends BackpressureError {
  constructor(state, failures) {
    super(`Circuit breaker is ${state} after ${failures} failures`, 'CIRCUIT_BREAKER_OPEN', {
      state,
      failures
    });
  }
}

export class RateLimitExceededError extends BackpressureError {
  constructor(currentRate, limit) {
    super(`Rate limit exceeded: ${currentRate} > ${limit}`, 'RATE_LIMIT_EXCEEDED', {
      currentRate,
      limit
    });
  }
}

export class ConnectionPoolExhaustedError extends BackpressureError {
  constructor(activeConnections, maxConnections) {
    super(`Connection pool exhausted: ${activeConnections}/${maxConnections}`, 'POOL_EXHAUSTED', {
      activeConnections,
      maxConnections
    });
  }
}

/**
 * Domain Events for backpressure control
 */
export class BackpressureActivated extends DomainEvent {
  constructor(level, reason) {
    super('BACKPRESSURE_ACTIVATED', { level, reason });
  }
}

export class BackpressureDeactivated extends DomainEvent {
  constructor(duration) {
    super('BACKPRESSURE_DEACTIVATED', { duration });
  }
}

export class CircuitBreakerStateChanged extends DomainEvent {
  constructor(previousState, newState, reason) {
    super('CIRCUIT_BREAKER_STATE_CHANGED', { previousState, newState, reason });
  }
}

export class ThrottlingAdjusted extends DomainEvent {
  constructor(previousRate, newRate, reason) {
    super('THROTTLING_ADJUSTED', { previousRate, newRate, reason });
  }
}

/**
 * Circuit breaker states
 */
export const CircuitBreakerState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

/**
 * Backpressure Controller
 * Monitors database load and implements adaptive backpressure mechanisms
 */
export class BackpressureController extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.maxConcurrentOperations = options.maxConcurrentOperations || 50;
    this.maxConnectionPoolSize = options.maxConnectionPoolSize || 20;
    this.baseRateLimit = options.baseRateLimit || 100; // operations per second
    this.adaptiveRateLimiting = options.adaptiveRateLimiting ?? true;
    this.enable = options.enable ?? true;

    // Circuit breaker configuration
    this.circuitBreakerOptions = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000, // 30 seconds
      halfOpenMaxCalls: options.halfOpenMaxCalls || 3,
      ...options.circuitBreaker
    };

    // Backpressure thresholds
    this.thresholds = {
      connectionPoolWarning: options.connectionPoolWarning || 0.8,
      connectionPoolCritical: options.connectionPoolCritical || 0.95,
      responseTimeWarning: options.responseTimeWarning || 1000, // 1 second
      responseTimeCritical: options.responseTimeCritical || 5000, // 5 seconds
      queueDepthWarning: options.queueDepthWarning || 100,
      queueDepthCritical: options.queueDepthCritical || 500,
      errorRateWarning: options.errorRateWarning || 0.05, // 5%
      errorRateCritical: options.errorRateCritical || 0.15, // 15%
      ...options.thresholds
    };

    // State
    this.isBackpressureActive = false;
    this.backpressureLevel = 0; // 0-1 scale
    this.currentRateLimit = this.baseRateLimit;
    this.activeOperations = 0;
    this.queuedOperations = [];
    this.operationQueue = new Map();
    this.backpressureStartTime = null;

    // Circuit breaker state
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailureTime = null;
    this.circuitBreakerHalfOpenCalls = 0;

    // Metrics tracking
    this.metrics = {
      totalOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      connectionPoolUtilization: 0,
      queueDepth: 0,
      errorRate: 0,
      throughput: 0,
      lastUpdateTime: Date.now(),
      responseTimeHistory: [],
      errorHistory: [],
      throughputHistory: []
    };

    // Rate limiting state
    this.rateLimitTokens = this.baseRateLimit;
    this.rateLimitLastRefill = Date.now();

    // Periodic monitoring
    this.monitoringInterval = null;
    if (this.enable) {
      this.startMonitoring();
    }
  }

  /**
   * Start the backpressure monitoring system
   */
  startMonitoring() {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.evaluateBackpressure();
      this.adjustRateLimit();
      this.refillRateLimitTokens();
    }, 1000); // Monitor every second
  }

  /**
   * Stop the backpressure monitoring system
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Request permission to execute an operation
   * @param {Object} operation - Operation details
   * @returns {Promise<Object>} Permission result
   */
  async requestPermission(operation = {}) {
    if (!this.enable) {
      return { granted: true, delay: 0, reason: 'backpressure disabled' };
    }

    // Check circuit breaker
    const circuitBreakerResult = this.checkCircuitBreaker();
    if (!circuitBreakerResult.allowed) {
      throw new CircuitBreakerError(this.circuitBreakerState, this.circuitBreakerFailures);
    }

    // Check rate limit
    const rateLimitResult = this.checkRateLimit();
    if (!rateLimitResult.allowed) {
      const delay = this.calculateDelay();
      if (delay > 0) {
        await this.sleep(delay);
        return this.requestPermission(operation); // Retry after delay
      }
      throw new RateLimitExceededError(rateLimitResult.currentRate, this.currentRateLimit);
    }

    // Check connection pool
    const poolResult = this.checkConnectionPool();
    if (!poolResult.allowed) {
      if (poolResult.canQueue) {
        return this.enqueueOperation(operation);
      }
      throw new ConnectionPoolExhaustedError(poolResult.activeConnections, this.maxConnectionPoolSize);
    }

    // Check concurrent operations limit
    if (this.activeOperations >= this.maxConcurrentOperations) {
      const delay = this.calculateConcurrencyDelay();
      return { granted: true, delay, reason: 'concurrency_limit' };
    }

    // Permission granted
    this.activeOperations++;
    this.consumeRateLimitToken();
    
    return {
      granted: true,
      delay: 0,
      reason: 'permission_granted',
      operationId: operation.id || this.generateOperationId()
    };
  }

  /**
   * Report completion of an operation
   * @param {Object} result - Operation result
   */
  async reportCompletion(result) {
    if (!this.enable) {
      return;
    }

    this.activeOperations = Math.max(0, this.activeOperations - 1);
    this.metrics.totalOperations++;

    // Update circuit breaker state
    if (result.success) {
      this.recordCircuitBreakerSuccess();
    } else {
      this.recordCircuitBreakerFailure();
      this.metrics.failedOperations++;
    }

    // Update response time metrics
    if (result.responseTime) {
      this.updateResponseTimeMetrics(result.responseTime);
    }

    // Process queued operations if capacity available
    if (this.activeOperations < this.maxConcurrentOperations && this.queuedOperations.length > 0) {
      this.processQueue();
    }

    // Update error rate
    this.updateErrorRate();
  }

  /**
   * Check circuit breaker state
   * @returns {Object} Circuit breaker result
   */
  checkCircuitBreaker() {
    const now = Date.now();

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return { allowed: true };

      case CircuitBreakerState.OPEN:
        if (now - this.circuitBreakerLastFailureTime >= this.circuitBreakerOptions.resetTimeout) {
          this.transitionCircuitBreaker(CircuitBreakerState.HALF_OPEN, 'timeout_expired');
          return { allowed: true };
        }
        return { allowed: false, reason: 'circuit_breaker_open' };

      case CircuitBreakerState.HALF_OPEN:
        if (this.circuitBreakerHalfOpenCalls < this.circuitBreakerOptions.halfOpenMaxCalls) {
          this.circuitBreakerHalfOpenCalls++;
          return { allowed: true };
        }
        return { allowed: false, reason: 'half_open_limit_exceeded' };

      default:
        return { allowed: false, reason: 'unknown_circuit_breaker_state' };
    }
  }

  /**
   * Check rate limiting
   * @returns {Object} Rate limit result
   */
  checkRateLimit() {
    const currentRate = this.calculateCurrentRate();
    const allowed = this.rateLimitTokens > 0;

    return {
      allowed,
      currentRate,
      limit: this.currentRateLimit,
      tokensRemaining: this.rateLimitTokens
    };
  }

  /**
   * Check connection pool availability
   * @returns {Object} Connection pool result
   */
  checkConnectionPool() {
    const utilization = this.metrics.connectionPoolUtilization;
    const activeConnections = Math.floor(utilization * this.maxConnectionPoolSize);

    if (utilization >= this.thresholds.connectionPoolCritical) {
      return {
        allowed: false,
        canQueue: this.queuedOperations.length < this.thresholds.queueDepthCritical,
        activeConnections,
        maxConnections: this.maxConnectionPoolSize,
        utilization
      };
    }

    return {
      allowed: true,
      activeConnections,
      maxConnections: this.maxConnectionPoolSize,
      utilization
    };
  }

  /**
   * Enqueue an operation when resources are constrained
   * @param {Object} operation - Operation to enqueue
   * @returns {Promise<Object>} Queued operation result
   */
  async enqueueOperation(operation) {
    const queuedOperation = {
      operation,
      timestamp: Date.now(),
      priority: operation.priority || 0,
      id: operation.id || this.generateOperationId()
    };

    // Insert in priority order
    const insertIndex = this.queuedOperations.findIndex(op => op.priority < queuedOperation.priority);
    if (insertIndex === -1) {
      this.queuedOperations.push(queuedOperation);
    } else {
      this.queuedOperations.splice(insertIndex, 0, queuedOperation);
    }

    this.metrics.queueDepth = this.queuedOperations.length;

    return {
      granted: false,
      queued: true,
      queuePosition: this.queuedOperations.indexOf(queuedOperation),
      estimatedDelay: this.estimateQueueDelay(queuedOperation),
      reason: 'queued_due_to_backpressure'
    };
  }

  /**
   * Process queued operations
   */
  async processQueue() {
    while (this.queuedOperations.length > 0 && this.activeOperations < this.maxConcurrentOperations) {
      const queuedOp = this.queuedOperations.shift();
      this.metrics.queueDepth = this.queuedOperations.length;

      // Grant permission to queued operation
      this.activeOperations++;
      this.emit('queuedOperationProcessed', {
        operationId: queuedOp.id,
        queueTime: Date.now() - queuedOp.timestamp
      });
    }
  }

  /**
   * Record circuit breaker success
   */
  recordCircuitBreakerSuccess() {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreakerHalfOpenCalls--;
      if (this.circuitBreakerHalfOpenCalls <= 0) {
        this.transitionCircuitBreaker(CircuitBreakerState.CLOSED, 'success_threshold_met');
        this.circuitBreakerFailures = 0;
      }
    }
  }

  /**
   * Record circuit breaker failure
   */
  recordCircuitBreakerFailure() {
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailureTime = Date.now();

    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.transitionCircuitBreaker(CircuitBreakerState.OPEN, 'failure_in_half_open');
    } else if (this.circuitBreakerFailures >= this.circuitBreakerOptions.failureThreshold) {
      this.transitionCircuitBreaker(CircuitBreakerState.OPEN, 'failure_threshold_exceeded');
    }
  }

  /**
   * Transition circuit breaker state
   * @param {string} newState - New circuit breaker state
   * @param {string} reason - Reason for transition
   */
  transitionCircuitBreaker(newState, reason) {
    const previousState = this.circuitBreakerState;
    this.circuitBreakerState = newState;
    this.circuitBreakerHalfOpenCalls = 0;

    this.emit('circuitBreakerStateChanged', 
      new CircuitBreakerStateChanged(previousState, newState, reason));
  }

  /**
   * Update response time metrics
   * @param {number} responseTime - Response time in milliseconds
   */
  updateResponseTimeMetrics(responseTime) {
    this.metrics.responseTimeHistory.push({
      time: Date.now(),
      value: responseTime
    });

    // Keep only last 100 measurements
    if (this.metrics.responseTimeHistory.length > 100) {
      this.metrics.responseTimeHistory.shift();
    }

    // Calculate average
    const totalTime = this.metrics.responseTimeHistory.reduce((sum, entry) => sum + entry.value, 0);
    this.metrics.averageResponseTime = totalTime / this.metrics.responseTimeHistory.length;
  }

  /**
   * Update error rate metrics
   */
  updateErrorRate() {
    this.metrics.errorRate = this.metrics.totalOperations > 0 
      ? this.metrics.failedOperations / this.metrics.totalOperations
      : 0;

    this.metrics.errorHistory.push({
      time: Date.now(),
      rate: this.metrics.errorRate
    });

    // Keep only last hour of data
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.errorHistory = this.metrics.errorHistory.filter(entry => entry.time > oneHourAgo);
  }

  /**
   * Update system metrics
   */
  updateMetrics() {
    const now = Date.now();
    const timeDiff = now - this.metrics.lastUpdateTime;

    // Calculate throughput (operations per second)
    if (timeDiff > 0) {
      this.metrics.throughput = (this.metrics.totalOperations * 1000) / timeDiff;
      this.metrics.throughputHistory.push({
        time: now,
        value: this.metrics.throughput
      });

      // Keep only last 60 measurements (1 minute at 1 second intervals)
      if (this.metrics.throughputHistory.length > 60) {
        this.metrics.throughputHistory.shift();
      }
    }

    // Update connection pool utilization (simulated - in real implementation would query actual pool)
    this.metrics.connectionPoolUtilization = Math.min(1, this.activeOperations / this.maxConnectionPoolSize);

    // Update queue depth
    this.metrics.queueDepth = this.queuedOperations.length;

    this.metrics.lastUpdateTime = now;
  }

  /**
   * Evaluate current backpressure conditions
   */
  evaluateBackpressure() {
    const conditions = [
      {
        name: 'connection_pool_utilization',
        value: this.metrics.connectionPoolUtilization,
        warning: this.thresholds.connectionPoolWarning,
        critical: this.thresholds.connectionPoolCritical
      },
      {
        name: 'response_time',
        value: this.metrics.averageResponseTime,
        warning: this.thresholds.responseTimeWarning,
        critical: this.thresholds.responseTimeCritical
      },
      {
        name: 'queue_depth',
        value: this.metrics.queueDepth,
        warning: this.thresholds.queueDepthWarning,
        critical: this.thresholds.queueDepthCritical
      },
      {
        name: 'error_rate',
        value: this.metrics.errorRate,
        warning: this.thresholds.errorRateWarning,
        critical: this.thresholds.errorRateCritical
      }
    ];

    let maxLevel = 0;
    let triggeringConditions = [];

    for (const condition of conditions) {
      let level = 0;
      if (condition.value >= condition.critical) {
        level = 1.0;
      } else if (condition.value >= condition.warning) {
        level = 0.5;
      }

      if (level > 0) {
        triggeringConditions.push({
          name: condition.name,
          level,
          value: condition.value,
          threshold: level === 1.0 ? condition.critical : condition.warning
        });
      }

      maxLevel = Math.max(maxLevel, level);
    }

    // Update backpressure state
    const wasActive = this.isBackpressureActive;
    this.isBackpressureActive = maxLevel > 0;
    this.backpressureLevel = maxLevel;

    if (!wasActive && this.isBackpressureActive) {
      this.backpressureStartTime = Date.now();
      this.emit('backpressureActivated', 
        new BackpressureActivated(maxLevel, triggeringConditions));
    } else if (wasActive && !this.isBackpressureActive) {
      const duration = Date.now() - (this.backpressureStartTime || Date.now());
      this.backpressureStartTime = null;
      this.emit('backpressureDeactivated', new BackpressureDeactivated(duration));
    }
  }

  /**
   * Adjust rate limiting based on current conditions
   */
  adjustRateLimit() {
    if (!this.adaptiveRateLimiting) {
      return;
    }

    const previousRate = this.currentRateLimit;
    let newRate = this.baseRateLimit;

    if (this.isBackpressureActive) {
      // Reduce rate limit based on backpressure level
      const reductionFactor = 1 - (this.backpressureLevel * 0.7);
      newRate = Math.max(1, Math.floor(this.baseRateLimit * reductionFactor));
    } else if (this.metrics.errorRate < 0.01 && this.metrics.averageResponseTime < this.thresholds.responseTimeWarning / 2) {
      // Conditions are good, can increase rate limit slightly
      newRate = Math.min(this.baseRateLimit * 1.5, this.baseRateLimit + 10);
    }

    if (newRate !== previousRate) {
      this.currentRateLimit = newRate;
      this.emit('throttlingAdjusted', 
        new ThrottlingAdjusted(previousRate, newRate, 'adaptive_adjustment'));
    }
  }

  /**
   * Refill rate limiting tokens
   */
  refillRateLimitTokens() {
    const now = Date.now();
    const timeDiff = now - this.rateLimitLastRefill;
    const tokensToAdd = Math.floor((timeDiff / 1000) * this.currentRateLimit);

    if (tokensToAdd > 0) {
      this.rateLimitTokens = Math.min(this.currentRateLimit, this.rateLimitTokens + tokensToAdd);
      this.rateLimitLastRefill = now;
    }
  }

  /**
   * Consume a rate limit token
   */
  consumeRateLimitToken() {
    this.rateLimitTokens = Math.max(0, this.rateLimitTokens - 1);
  }

  /**
   * Calculate current operation rate
   * @returns {number} Operations per second
   */
  calculateCurrentRate() {
    if (this.metrics.throughputHistory.length === 0) {
      return 0;
    }

    // Average throughput over last 10 seconds
    const recentHistory = this.metrics.throughputHistory.slice(-10);
    const totalThroughput = recentHistory.reduce((sum, entry) => sum + entry.value, 0);
    return totalThroughput / recentHistory.length;
  }

  /**
   * Calculate delay for rate limiting
   * @returns {number} Delay in milliseconds
   */
  calculateDelay() {
    if (this.rateLimitTokens <= 0) {
      return Math.max(100, 1000 / this.currentRateLimit); // Minimum 100ms, or time for one token
    }
    return 0;
  }

  /**
   * Calculate delay for concurrency limiting
   * @returns {number} Delay in milliseconds
   */
  calculateConcurrencyDelay() {
    const excessOperations = this.activeOperations - this.maxConcurrentOperations;
    return Math.min(5000, excessOperations * 100); // 100ms per excess operation, max 5s
  }

  /**
   * Estimate delay for queued operation
   * @param {Object} queuedOperation - Queued operation
   * @returns {number} Estimated delay in milliseconds
   */
  estimateQueueDelay(queuedOperation) {
    const position = this.queuedOperations.indexOf(queuedOperation);
    const averageProcessingTime = this.metrics.averageResponseTime || 1000;
    return position * averageProcessingTime;
  }

  /**
   * Generate unique operation ID
   * @returns {string} Operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      enabled: this.enable,
      backpressure: {
        active: this.isBackpressureActive,
        level: this.backpressureLevel,
        duration: this.backpressureStartTime ? Date.now() - this.backpressureStartTime : 0
      },
      circuitBreaker: {
        state: this.circuitBreakerState,
        failures: this.circuitBreakerFailures,
        lastFailureTime: this.circuitBreakerLastFailureTime
      },
      rateLimit: {
        current: this.currentRateLimit,
        base: this.baseRateLimit,
        tokensRemaining: this.rateLimitTokens
      },
      operations: {
        active: this.activeOperations,
        max: this.maxConcurrentOperations,
        queued: this.queuedOperations.length
      },
      metrics: { ...this.metrics },
      thresholds: { ...this.thresholds }
    };
  }

  /**
   * Reset all state and metrics
   */
  reset() {
    this.isBackpressureActive = false;
    this.backpressureLevel = 0;
    this.currentRateLimit = this.baseRateLimit;
    this.activeOperations = 0;
    this.queuedOperations = [];
    this.backpressureStartTime = null;

    // Reset circuit breaker
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailureTime = null;
    this.circuitBreakerHalfOpenCalls = 0;

    // Reset metrics
    this.metrics = {
      totalOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      connectionPoolUtilization: 0,
      queueDepth: 0,
      errorRate: 0,
      throughput: 0,
      lastUpdateTime: Date.now(),
      responseTimeHistory: [],
      errorHistory: [],
      throughputHistory: []
    };

    // Reset rate limiting
    this.rateLimitTokens = this.baseRateLimit;
    this.rateLimitLastRefill = Date.now();
  }

  /**
   * Gracefully shutdown the controller
   */
  async shutdown() {
    this.stopMonitoring();
    
    // Wait for active operations to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeOperations > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await this.sleep(100);
    }

    // Clear queued operations
    this.queuedOperations = [];
    this.metrics.queueDepth = 0;

    this.emit('shutdown', { 
      remainingOperations: this.activeOperations,
      forcedShutdown: this.activeOperations > 0
    });
  }

  /**
   * Destroy the controller and clean up resources
   */
  destroy() {
    this.stopMonitoring();
    this.removeAllListeners();
    this.queuedOperations = [];
    this.operationQueue.clear();
  }
}

export default BackpressureController;
