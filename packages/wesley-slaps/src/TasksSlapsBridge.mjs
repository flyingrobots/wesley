/**
 * T.A.S.K.S. / S.L.A.P.S. Integration Bridge
 * 
 * Connects the task scheduling system (T.A.S.K.S.) with the execution engine (S.L.A.P.S.)
 * to provide comprehensive orchestration of Wesley operations.
 */

import { LockAwareExecutor } from './LockAwareExecutor.mjs';

export class TasksSlapsBridge {
  constructor(connectionPool, tasksKernel, options = {}) {
    this.tasksKernel = tasksKernel;
    this.executor = new LockAwareExecutor(connectionPool, options.executor || {});
    this.maxConcurrentTasks = options.maxConcurrentTasks || 3;
    this.runningTasks = new Map();
    this.completedTasks = new Set();
    this.failedTasks = new Map();
    this.taskHistory = [];
  }
  
  /**
   * Execute a task graph with full orchestration
   */
  async executeTaskGraph(taskGraph, options = {}) {
    const startTime = Date.now();
    const results = new Map();
    
    try {
      // Validate task graph
      const cycles = taskGraph.detectCycles();
      if (cycles.length > 0) {
        throw new Error(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
      }
      
      // Get execution order with dependency resolution
      const executionOrder = taskGraph.getExecutionOrder();
      
      // Execute tasks with concurrency control
      while (this.completedTasks.size < taskGraph.tasks.size) {
        const readyTasks = taskGraph.getReadyTasks(this.completedTasks);
        const availableTasks = readyTasks.filter(task => 
          !this.runningTasks.has(task.id) && 
          !this.completedTasks.has(task.id) &&
          !this.failedTasks.has(task.id)
        );
        
        // Start new tasks up to concurrency limit
        const slotsAvailable = this.maxConcurrentTasks - this.runningTasks.size;
        const tasksToStart = availableTasks.slice(0, slotsAvailable);
        
        // Start tasks
        const taskPromises = tasksToStart.map(task => 
          this.executeTask(task, options)
        );
        
        if (taskPromises.length === 0 && this.runningTasks.size === 0) {
          // No tasks running and none can start - check for failures
          if (this.failedTasks.size > 0) {
            throw new Error(`Tasks failed: ${Array.from(this.failedTasks.keys()).join(', ')}`);
          }
          break;
        }
        
        // Wait for at least one task to complete
        if (this.runningTasks.size > 0) {
          await Promise.race(Array.from(this.runningTasks.values()));
        }
        
        // Small delay to prevent tight loop
        await this.sleep(10);
      }
      
      return {
        success: true,
        duration: Date.now() - startTime,
        completedTasks: this.completedTasks.size,
        failedTasks: this.failedTasks.size,
        results: Object.fromEntries(results)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        completedTasks: this.completedTasks.size,
        failedTasks: this.failedTasks.size,
        results: Object.fromEntries(results)
      };
    }
  }
  
  /**
   * Execute a single task with S.L.A.P.S. orchestration
   */
  async executeTask(taskDef, options = {}) {
    const taskId = taskDef.id;
    const startTime = Date.now();
    
    try {
      // Create task execution promise
      const executionPromise = this.performTaskExecution(taskDef, options);
      this.runningTasks.set(taskId, executionPromise);
      
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Task ${taskId} timed out`)), taskDef.timeout);
      });
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Mark as completed
      this.completedTasks.add(taskId);
      this.runningTasks.delete(taskId);
      
      // Record success
      this.recordTaskResult(taskDef, 'success', Date.now() - startTime, result);
      
      return result;
      
    } catch (error) {
      // Mark as failed
      this.failedTasks.set(taskId, error);
      this.runningTasks.delete(taskId);
      
      // Record failure
      this.recordTaskResult(taskDef, 'failed', Date.now() - startTime, null, error);
      
      // Decide if we should retry
      const retryCount = (taskDef.metadata.retryCount || 0);
      if (retryCount < taskDef.maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await this.sleep(delay);
        
        // Create retry task
        const retryTask = taskDef.extend({
          metadata: { ...taskDef.metadata, retryCount: retryCount + 1 }
        });
        
        this.failedTasks.delete(taskId); // Remove from failed to allow retry
        return this.executeTask(retryTask, options);
      }
      
      throw error;
    }
  }
  
  /**
   * Perform the actual task execution logic
   */
  async performTaskExecution(taskDef, options) {
    const context = {
      taskId: taskDef.id,
      metadata: taskDef.metadata,
      options: options
    };
    
    // Determine execution strategy based on task type
    const taskType = taskDef.metadata.type || 'sql';
    
    switch (taskType) {
      case 'sql':
        return this.executeSQLTask(taskDef, context);
        
      case 'migration':
        return this.executeMigrationTask(taskDef, context);
        
      case 'generation':
        return this.executeGenerationTask(taskDef, context);
        
      case 'validation':
        return this.executeValidationTask(taskDef, context);
        
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  }
  
  /**
   * Execute SQL-based task
   */
  async executeSQLTask(taskDef, context) {
    const operation = {
      id: taskDef.id,
      sql: taskDef.metadata.sql,
      params: taskDef.metadata.params || [],
      transaction: taskDef.metadata.transaction || false
    };
    
    return this.executor.execute(operation, context);
  }
  
  /**
   * Execute migration task
   */
  async executeMigrationTask(taskDef, context) {
    const operations = taskDef.metadata.operations || [];
    const results = [];
    
    for (const op of operations) {
      const result = await this.executor.execute(op, context);
      results.push(result);
    }
    
    return { operations: results.length, results };
  }
  
  /**
   * Execute code generation task
   */
  async executeGenerationTask(taskDef, context) {
    // This would integrate with Wesley's generators
    const generatorType = taskDef.metadata.generator;
    const schema = taskDef.metadata.schema;
    
    // For now, simulate generation
    return {
      generator: generatorType,
      filesGenerated: taskDef.metadata.expectedFiles || 1,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute validation task
   */
  async executeValidationTask(taskDef, context) {
    const validationType = taskDef.metadata.validationType;
    
    switch (validationType) {
      case 'schema':
        return this.validateSchema(taskDef.metadata.schema);
      case 'migration':
        return this.validateMigration(taskDef.metadata.migration);
      default:
        throw new Error(`Unknown validation type: ${validationType}`);
    }
  }
  
  /**
   * Validate schema
   */
  async validateSchema(schema) {
    // Simulate schema validation
    return {
      valid: true,
      tables: schema?.tables?.length || 0,
      errors: []
    };
  }
  
  /**
   * Validate migration
   */
  async validateMigration(migration) {
    // Simulate migration validation
    return {
      valid: true,
      operations: migration?.operations?.length || 0,
      warnings: [],
      lockAnalysis: {
        highRiskOperations: 0,
        estimatedDuration: '< 1s'
      }
    };
  }
  
  /**
   * Record task execution result
   */
  recordTaskResult(taskDef, status, duration, result = null, error = null) {
    this.taskHistory.push({
      taskId: taskDef.id,
      taskType: taskDef.metadata.type || 'unknown',
      status,
      duration,
      timestamp: Date.now(),
      result: result ? { type: typeof result, success: true } : null,
      error: error ? error.message : null,
      retryCount: taskDef.metadata.retryCount || 0
    });
    
    // Keep only last 1000 task results
    if (this.taskHistory.length > 1000) {
      this.taskHistory.shift();
    }
  }
  
  /**
   * Get orchestration statistics
   */
  getStats() {
    const now = Date.now();
    const recentTasks = this.taskHistory.filter(task => now - task.timestamp < 60000); // Last minute
    
    return {
      runningTasks: this.runningTasks.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.failedTasks.size,
      recentTasks: recentTasks.length,
      successRate: recentTasks.length > 0 ? recentTasks.filter(t => t.status === 'success').length / recentTasks.length : 1,
      averageTaskDuration: recentTasks.length > 0 ? recentTasks.reduce((sum, t) => sum + t.duration, 0) / recentTasks.length : 0,
      executorStats: this.executor.getStats()
    };
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    // Wait for running tasks to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.runningTasks.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await this.sleep(100);
    }
    
    // Force cleanup of remaining tasks
    for (const [taskId, promise] of this.runningTasks) {
      try {
        promise.catch(() => {}); // Ignore errors during shutdown
      } catch (e) {
        // Ignore
      }
    }
    
    this.runningTasks.clear();
  }
  
  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}