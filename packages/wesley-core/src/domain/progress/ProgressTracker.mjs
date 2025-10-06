/**
 * ProgressTracker - Advanced progress tracking with ETA calculations and performance metrics
 * Tracks operation progress, maintains history, and provides performance analytics
 */

import { EventEmitter } from '../../util/EventEmitter.mjs';

export class ProgressTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      historyLimit: options.historyLimit || 100,
      updateInterval: options.updateInterval || 1000,
      enableMetrics: options.enableMetrics !== false,
      smoothingFactor: options.smoothingFactor || 0.7,
      ...options
    };

    this.operations = new Map();
    this.history = [];
    this.globalStartTime = Date.now();
    this.metrics = new PerformanceMetrics();
    
    // Auto-cleanup timer
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Start tracking a new operation
   */
  startOperation(operationId, config = {}) {
    const operation = new OperationProgress({
      id: operationId,
      name: config.name || operationId,
      totalSteps: config.totalSteps || 0,
      weight: config.weight || 1,
      category: config.category || 'default',
      metadata: config.metadata || {},
      smoothingFactor: this.options.smoothingFactor
    });

    this.operations.set(operationId, operation);
    
    this.emit('operation:started', {
      operationId,
      operation: operation.getSnapshot()
    });

    if (this.options.enableMetrics) {
      this.metrics.recordOperationStart(operationId, config.category);
    }

    return operation;
  }

  /**
   * Update progress for an operation
   */
  updateProgress(operationId, progress, message = '', details = {}) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.updateProgress(progress, message, details);
    
    this.emit('progress:updated', {
      operationId,
      progress: operation.getSnapshot(),
      globalProgress: this.getGlobalProgress()
    });

    if (this.options.enableMetrics) {
      this.metrics.recordProgressUpdate(operationId, progress);
    }
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId, result = {}) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.complete(result);
    
    // Add to history
    this.addToHistory(operation.getSnapshot());
    
    this.emit('operation:completed', {
      operationId,
      operation: operation.getSnapshot(),
      globalProgress: this.getGlobalProgress()
    });

    if (this.options.enableMetrics) {
      this.metrics.recordOperationComplete(operationId, result.success !== false);
    }
  }

  /**
   * Fail an operation
   */
  failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.fail(error);
    
    // Add to history
    this.addToHistory(operation.getSnapshot());
    
    this.emit('operation:failed', {
      operationId,
      operation: operation.getSnapshot(),
      error,
      globalProgress: this.getGlobalProgress()
    });

    if (this.options.enableMetrics) {
      this.metrics.recordOperationComplete(operationId, false);
    }
  }

  /**
   * Get current progress for an operation
   */
  getOperationProgress(operationId) {
    const operation = this.operations.get(operationId);
    return operation ? operation.getSnapshot() : null;
  }

  /**
   * Get global progress across all operations
   */
  getGlobalProgress() {
    const operations = Array.from(this.operations.values());
    if (operations.length === 0) {
      return {
        totalOperations: 0,
        completedOperations: 0,
        activeOperations: 0,
        failedOperations: 0,
        overallProgress: 0,
        eta: null,
        averageOperationTime: null
      };
    }

    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    const completedWeight = operations.reduce((sum, op) => {
      if (op.status === 'completed') return sum + op.weight;
      if (op.status === 'active') return sum + (op.progress * op.weight);
      return sum;
    }, 0);

    const completed = operations.filter(op => op.status === 'completed').length;
    const active = operations.filter(op => op.status === 'active').length;
    const failed = operations.filter(op => op.status === 'failed').length;

    const overallProgress = totalWeight > 0 ? completedWeight / totalWeight : 0;
    const eta = this.calculateGlobalETA(operations, overallProgress);
    const avgTime = this.calculateAverageOperationTime();

    return {
      totalOperations: operations.length,
      completedOperations: completed,
      activeOperations: active,
      failedOperations: failed,
      overallProgress,
      eta,
      averageOperationTime: avgTime
    };
  }

  /**
   * Calculate global ETA based on current operations
   */
  calculateGlobalETA(operations, overallProgress) {
    if (overallProgress === 0 || overallProgress >= 1) {
      return null;
    }

    // Use average completion time of recent operations
    const recentCompletions = this.history
      .filter(op => op.status === 'completed')
      .slice(-10); // Last 10 completions

    if (recentCompletions.length === 0) {
      return null;
    }

    const avgDuration = recentCompletions.reduce((sum, op) => sum + op.duration, 0) / recentCompletions.length;
    const remainingOperations = operations.filter(op => op.status !== 'completed').length;
    
    return Math.round((remainingOperations * avgDuration) / (1 - overallProgress));
  }

  /**
   * Calculate average operation completion time
   */
  calculateAverageOperationTime() {
    const completedOps = this.history.filter(op => op.status === 'completed');
    if (completedOps.length === 0) return null;

    const totalDuration = completedOps.reduce((sum, op) => sum + op.duration, 0);
    return Math.round(totalDuration / completedOps.length);
  }

  /**
   * Get operation history
   */
  getHistory(category = null, limit = null) {
    let filtered = this.history;
    
    if (category) {
      filtered = filtered.filter(op => op.category === category);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return this.options.enableMetrics ? this.metrics.getSnapshot() : null;
  }

  /**
   * Add operation to history
   */
  addToHistory(operationSnapshot) {
    this.history.push({
      ...operationSnapshot,
      timestamp: Date.now()
    });

    // Trim history if needed
    if (this.history.length > this.options.historyLimit) {
      this.history = this.history.slice(-this.options.historyLimit);
    }
  }

  /**
   * Clean up completed operations
   */
  cleanup() {
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    
    for (const [id, operation] of this.operations) {
      if ((operation.status === 'completed' || operation.status === 'failed') && 
          operation.endTime < cutoff) {
        this.operations.delete(id);
      }
    }

    this.emit('cleanup:completed', {
      activeOperations: this.operations.size,
      historySize: this.history.length
    });
  }

  /**
   * Reset all progress tracking
   */
  reset() {
    this.operations.clear();
    this.history = [];
    this.globalStartTime = Date.now();
    this.metrics.reset();
    
    this.emit('tracker:reset');
  }

  /**
   * Dispose of the tracker
   */
  dispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.operations.clear();
    this.removeAllListeners();
  }
}

/**
 * Individual operation progress tracking
 */
class OperationProgress {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.totalSteps = config.totalSteps;
    this.weight = config.weight;
    this.category = config.category;
    this.metadata = config.metadata;
    
    this.status = 'active';
    this.progress = 0;
    this.currentStep = 0;
    this.message = '';
    this.details = {};
    
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = 0;
    
    // ETA calculation
    this.progressHistory = [];
    this.smoothingFactor = config.smoothingFactor;
    this.estimatedRate = 0;
  }

  /**
   * Update progress with smoothing for ETA calculation
   */
  updateProgress(progress, message = '', details = {}) {
    const now = Date.now();
    const oldProgress = this.progress;
    
    this.progress = Math.max(0, Math.min(1, progress));
    this.message = message;
    this.details = { ...this.details, ...details };
    this.duration = now - this.startTime;

    if (this.totalSteps > 0) {
      this.currentStep = Math.floor(this.progress * this.totalSteps);
    }

    // Update progress history for ETA calculation
    this.updateProgressHistory(now, this.progress);
    this.calculateEstimatedRate();
  }

  /**
   * Update progress history for smooth ETA calculation
   */
  updateProgressHistory(timestamp, progress) {
    this.progressHistory.push({ timestamp, progress });
    
    // Keep only last 10 data points for smooth calculation
    if (this.progressHistory.length > 10) {
      this.progressHistory = this.progressHistory.slice(-10);
    }
  }

  /**
   * Calculate estimated completion rate using exponential smoothing
   */
  calculateEstimatedRate() {
    if (this.progressHistory.length < 2) {
      return;
    }

    const recent = this.progressHistory.slice(-5); // Use last 5 data points
    let totalRate = 0;
    let validPoints = 0;

    for (let i = 1; i < recent.length; i++) {
      const timeDiff = recent[i].timestamp - recent[i-1].timestamp;
      const progressDiff = recent[i].progress - recent[i-1].progress;
      
      if (timeDiff > 0 && progressDiff > 0) {
        const rate = progressDiff / timeDiff; // progress per millisecond
        totalRate += rate;
        validPoints++;
      }
    }

    if (validPoints > 0) {
      const newRate = totalRate / validPoints;
      this.estimatedRate = this.estimatedRate === 0 ? newRate : 
        (this.smoothingFactor * this.estimatedRate) + ((1 - this.smoothingFactor) * newRate);
    }
  }

  /**
   * Get estimated time to completion
   */
  getETA() {
    if (this.progress >= 1 || this.estimatedRate === 0) {
      return null;
    }

    const remainingProgress = 1 - this.progress;
    return Math.round(remainingProgress / this.estimatedRate);
  }

  /**
   * Complete the operation
   */
  complete(result = {}) {
    this.status = 'completed';
    this.progress = 1;
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.details = { ...this.details, result };
  }

  /**
   * Fail the operation
   */
  fail(error) {
    this.status = 'failed';
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.details = { ...this.details, error: error.message, stack: error.stack };
  }

  /**
   * Get current operation snapshot
   */
  getSnapshot() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      progress: this.progress,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      weight: this.weight,
      category: this.category,
      message: this.message,
      details: this.details,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      eta: this.getETA(),
      metadata: this.metadata
    };
  }
}

/**
 * Performance metrics collection
 */
class PerformanceMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.operationCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.totalDuration = 0;
    this.categoryStats = new Map();
    this.startTime = Date.now();
  }

  recordOperationStart(operationId, category) {
    this.operationCount++;
    
    if (!this.categoryStats.has(category)) {
      this.categoryStats.set(category, {
        count: 0,
        success: 0,
        failure: 0,
        totalDuration: 0
      });
    }
    
    const stats = this.categoryStats.get(category);
    stats.count++;
  }

  recordProgressUpdate(operationId, progress) {
    // Could track progress velocity here if needed
  }

  recordOperationComplete(operationId, success) {
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
  }

  getSnapshot() {
    const now = Date.now();
    const totalTime = now - this.startTime;
    
    const categoryData = {};
    for (const [category, stats] of this.categoryStats) {
      categoryData[category] = {
        count: stats.count,
        successRate: stats.count > 0 ? (stats.success / stats.count) : 0,
        averageDuration: stats.count > 0 ? (stats.totalDuration / stats.count) : 0
      };
    }

    return {
      totalOperations: this.operationCount,
      successRate: this.operationCount > 0 ? (this.successCount / this.operationCount) : 0,
      averageDuration: this.operationCount > 0 ? (this.totalDuration / this.operationCount) : 0,
      operationsPerMinute: totalTime > 0 ? (this.operationCount / (totalTime / 60000)) : 0,
      categories: categoryData,
      uptime: totalTime
    };
  }
}

export default ProgressTracker;
