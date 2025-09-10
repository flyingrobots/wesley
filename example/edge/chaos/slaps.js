/**
 * S.L.A.P.S: Staged, Lock-Aware, Phased Steps
 * Migration executor with idempotency + governor + events
 * @module Slaps
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Execution status for migration plans
 * @readonly
 * @enum {string}
 */
export const ExecutionStatus = {
  PLANNED: 'PLANNED',
  RUNNING: 'RUNNING', 
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK'
};

/**
 * Event types for migration monitoring
 * @readonly
 * @enum {string}
 */
export const EventType = {
  PLAN_ACCEPTED: 'plan.accepted',
  WAVE_START: 'wave.start',
  STEP_START: 'step.start',
  STEP_OK: 'step.ok',
  STEP_FAIL: 'step.fail',
  WAVE_COMPLETE: 'wave.complete',
  ABORT_REASON: 'abort.reason',
  GOVERNOR_BACKPRESSURE: 'governor.backpressure',
  LOCK_ACQUIRED: 'lock.acquired',
  LOCK_TIMEOUT: 'lock.timeout',
  LOCK_RELEASED: 'lock.released'
};

/**
 * Governor health status levels  
 * @readonly
 * @enum {string}
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CIRCUIT_OPEN: 'circuit_open'
};

/**
 * S.L.A.P.S. migration executor with safety rails
 */
export class SlapsExecutor {
  /**
   * Create new migration executor
   * @param {string} supabaseUrl - Supabase project URL
   * @param {string} supabaseKey - Service role key
   */
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.isRunning = false;
    this.currentPlan = null;
    this.currentWave = null;
    this.abortController = new AbortController();
    
    // Governor settings (backpressure thresholds)
    this.governorSettings = {
      maxActiveConnections: 50,
      maxRecentErrors: 5,
      circuitBreakerConnections: 80,
      circuitBreakerErrors: 10,
      healthCheckIntervalMs: 5000
    };
    
    // Real-time subscriptions
    this.eventSubscription = null;
    this.setupRealtime();
  }

  /**
   * Setup real-time event monitoring
   * @private
   */
  setupRealtime() {
    // Subscribe to execution events for monitoring
    this.eventSubscription = this.supabase
      .channel('migration-events')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'migration_execution_events'
      }, (payload) => {
        this.handleExecutionEvent(payload.new);
      })
      .subscribe();
  }

  /**
   * Handle real-time execution events
   * @private
   * @param {Object} event - Migration event
   */
  handleExecutionEvent(event) {
    console.log(`🔄 [${event.event_type}] ${event.message}`);
    
    if (event.metrics) {
      const metrics = JSON.parse(event.metrics);
      console.log('📊 Metrics:', metrics);
    }
    
    // Emit event for UI consumption
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('migration-event', {
        detail: event
      }));
    }
  }

  /**
   * Execute migration plan with full safety rails
   * @param {Object} executionPlan - Plan from T.A.S.K.S. planner
   * @param {string} requesterId - Employee ID executing migration
   * @returns {Promise<Object>} Execution result
   */
  async executePlan(executionPlan, requesterId) {
    if (this.isRunning) {
      throw new Error('Executor already running - only one migration allowed at a time');
    }

    this.isRunning = true;
    this.currentPlan = executionPlan;
    
    try {
      // 1. Acquire advisory lock
      const lockAcquired = await this.acquireMigrationLock(executionPlan.planId);
      if (!lockAcquired) {
        throw new Error('Could not acquire migration lock - another migration in progress');
      }

      // 2. Initialize execution state
      await this.initializeExecutionState(executionPlan, requesterId);

      // 3. Emit plan accepted event
      await this.emitEvent(executionPlan.planId, EventType.PLAN_ACCEPTED, 
        `Plan '${executionPlan.title}' accepted for execution`, {
          totalWaves: executionPlan.waves.length,
          totalSteps: executionPlan.waves.reduce((sum, w) => sum + w.steps.length, 0),
          maxHazardClass: executionPlan.maxHazardClass,
          chaosCompatible: executionPlan.chaosCompatible
        });

      // 4. Execute waves sequentially
      for (const wave of executionPlan.waves) {
        await this.executeWave(executionPlan.planId, wave);
        
        // Check abort signal between waves
        if (this.abortController.signal.aborted) {
          throw new Error('Execution aborted by user');
        }
      }

      // 5. Mark as completed
      await this.completeExecution(executionPlan.planId);
      
      return {
        status: 'success',
        planId: executionPlan.planId,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      await this.handleExecutionError(executionPlan.planId, error);
      throw error;
    } finally {
      await this.releaseMigrationLock(executionPlan.planId);
      this.isRunning = false;
      this.currentPlan = null;
    }
  }

  /**
   * Execute single wave with governor monitoring
   * @private
   * @param {string} planId - Plan identifier
   * @param {Object} wave - Wave to execute
   */
  async executeWave(planId, wave) {
    this.currentWave = wave;
    
    console.log(`🌊 Starting wave: ${wave.name} (${wave.steps.length} steps)`);
    
    await this.emitEvent(planId, EventType.WAVE_START, 
      `Starting wave '${wave.name}'`, {
        waveName: wave.name,
        waveNumber: wave.waveNumber,
        stepCount: wave.steps.length,
        maxHazard: wave.maxHazard,
        estimatedDurationMs: wave.estimatedDurationMs
      });

    // Update execution state
    await this.updateExecutionState(planId, {
      currentWave: wave.name,
      currentWaveNumber: wave.waveNumber
    });

    for (let i = 0; i < wave.steps.length; i++) {
      const step = wave.steps[i];
      
      // Governor health check before each step
      const health = await this.checkGovernorHealth(planId);
      if (health.healthStatus === HealthStatus.CIRCUIT_OPEN) {
        throw new Error(`Circuit breaker open: ${health.actionTaken}`);
      }
      
      if (health.healthStatus === HealthStatus.DEGRADED) {
        console.log('⚠️  System degraded, applying backpressure...');
        await this.sleep(2000); // 2s backpressure delay
      }

      await this.executeStep(planId, wave.name, step);
      
      // Check abort signal after each step
      if (this.abortController.signal.aborted) {
        throw new Error('Execution aborted by user');
      }
    }

    await this.emitEvent(planId, EventType.WAVE_COMPLETE,
      `Wave '${wave.name}' completed`, {
        waveName: wave.name,
        stepsCompleted: wave.steps.length
      });

    console.log(`✅ Wave completed: ${wave.name}`);
  }

  /**
   * Execute single migration step with full safety
   * @private
   * @param {string} planId - Plan identifier  
   * @param {string} waveName - Wave name
   * @param {Object} stepWithObligations - Step with safety metadata
   */
  async executeStep(planId, waveName, stepWithObligations) {
    const { step, stepSha, obligations } = stepWithObligations;
    
    console.log(`🔧 Executing step: ${step.op} (${stepSha})`);

    // Emit step start event
    await this.emitEvent(planId, EventType.STEP_START, 
      `Starting step: ${step.op}`, {
        stepSha,
        operation: step.op,
        lockClassMax: obligations.lockClassMax
      }, waveName, stepSha);

    // Generate SQL for step
    const sql = this.compileStep(step);
    
    try {
      // Call database function with full safety rails
      const { data, error } = await this.supabase.rpc('apply_step', {
        plan_id: planId,
        wave_name: waveName,
        step_sha: stepSha,
        stmt: sql,
        prechecks: obligations.prechecks,
        postchecks: obligations.postchecks,
        max_lock_ms: obligations.maxLockMs,
        max_stmt_ms: obligations.maxStmtMs
      });

      if (error) {
        throw new Error(`Step execution failed: ${error.message}`);
      }

      if (data.status === 'skipped') {
        console.log(`⏭️  Step skipped (already applied): ${stepSha}`);
      } else {
        console.log(`✅ Step completed: ${step.op} (${data.executionTimeMs}ms, ${data.rowsAffected} rows)`);
      }

      // Emit success event (handled by database trigger)
      
    } catch (error) {
      console.error(`❌ Step failed: ${step.op}`, error);
      
      await this.emitEvent(planId, EventType.STEP_FAIL,
        `Step failed: ${error.message}`, {
          stepSha,
          operation: step.op,
          error: error.message
        }, waveName, stepSha);
      
      throw error;
    }
  }

  /**
   * Compile migration step into safe SQL
   * @private  
   * @param {Object} step - Migration step
   * @returns {string} Generated SQL
   */
  compileStep(step) {
    switch (step.op) {
      case 'add_column':
        const nullable = step.nullable !== false ? '' : ' NOT NULL';
        const defaultClause = step.default ? ` DEFAULT ${step.default}` : '';
        return `ALTER TABLE ${step.table} ADD COLUMN IF NOT EXISTS ${step.name} ${step.type}${nullable}${defaultClause};`;
      
      case 'add_index_concurrently':
        const indexName = `${step.table}_${step.cols.join('_')}_idx`;
        return `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${step.table}(${step.cols.join(',')});`;
      
      case 'add_foreign_key_not_valid':
        const constraintName = `${step.src}_${step.col}_fkey`;
        return `ALTER TABLE ${step.src} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${step.col}) REFERENCES ${step.tgt}(${step.tgtCol}) NOT VALID;`;
      
      case 'validate_constraint':
        return `ALTER TABLE ${step.table} VALIDATE CONSTRAINT ${step.name};`;
      
      case 'create_view':
        return `CREATE OR REPLACE VIEW ${step.name} AS ${step.sql};`;
      
      case 'backfill_sql':
        return step.sql;
      
      case 'set_not_null':
        return `ALTER TABLE ${step.table} ALTER COLUMN ${step.column} SET NOT NULL;`;
      
      default:
        throw new Error(`Unsupported operation: ${step.op}`);
    }
  }

  /**
   * Check governor health and apply backpressure
   * @private
   * @param {string} planId - Plan identifier
   * @returns {Promise<Object>} Health status and metrics
   */
  async checkGovernorHealth(planId) {
    const { data, error } = await this.supabase.rpc('check_governor_health', {
      plan_id: planId
    });

    if (error) {
      console.warn('Governor health check failed:', error);
      return { healthStatus: HealthStatus.HEALTHY, actionTaken: 'none' };
    }

    return data;
  }

  /**
   * Acquire advisory lock for migration
   * @private
   * @param {string} planId - Plan identifier
   * @returns {Promise<boolean>} Whether lock was acquired
   */
  async acquireMigrationLock(planId) {
    const { data, error } = await this.supabase.rpc('acquire_migration_lock', {
      plan_id: planId
    });

    if (error) {
      console.error('Failed to acquire lock:', error);
      return false;
    }

    return data;
  }

  /**
   * Release advisory lock
   * @private
   * @param {string} planId - Plan identifier
   */
  async releaseMigrationLock(planId) {
    const { data, error } = await this.supabase.rpc('release_migration_lock', {
      plan_id: planId
    });

    if (error) {
      console.error('Failed to release lock:', error);
    }
  }

  /**
   * Initialize execution state in database
   * @private
   * @param {Object} executionPlan - Migration plan
   * @param {string} requesterId - Requester ID
   */
  async initializeExecutionState(executionPlan, requesterId) {
    const totalSteps = executionPlan.waves.reduce((sum, w) => sum + w.steps.length, 0);
    
    const { error } = await this.supabase
      .from('migration_execution_state')
      .insert({
        plan_id: executionPlan.planId,
        title: executionPlan.title,
        requester_id: requesterId,
        status: ExecutionStatus.PLANNED,
        total_steps: totalSteps,
        plan_json: executionPlan
      });

    if (error) {
      throw new Error(`Failed to initialize execution state: ${error.message}`);
    }
  }

  /**
   * Update execution state
   * @private
   * @param {string} planId - Plan identifier
   * @param {Object} updates - State updates
   */
  async updateExecutionState(planId, updates) {
    const { error } = await this.supabase
      .from('migration_execution_state')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('plan_id', planId);

    if (error) {
      console.error('Failed to update execution state:', error);
    }
  }

  /**
   * Mark execution as completed
   * @private
   * @param {string} planId - Plan identifier
   */
  async completeExecution(planId) {
    await this.updateExecutionState(planId, {
      status: ExecutionStatus.COMPLETED,
      completed_at: new Date().toISOString()
    });
  }

  /**
   * Handle execution error
   * @private
   * @param {string} planId - Plan identifier
   * @param {Error} error - Execution error
   */
  async handleExecutionError(planId, error) {
    await this.updateExecutionState(planId, {
      status: ExecutionStatus.FAILED,
      error_message: error.message,
      completed_at: new Date().toISOString()
    });

    await this.emitEvent(planId, EventType.ABORT_REASON,
      `Execution failed: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
  }

  /**
   * Emit execution event
   * @private
   * @param {string} planId - Plan identifier
   * @param {string} eventType - Event type
   * @param {string} message - Event message
   * @param {Object} metrics - Event metrics
   * @param {string} waveName - Wave name (optional)
   * @param {string} stepSha - Step hash (optional)
   */
  async emitEvent(planId, eventType, message, metrics = {}, waveName = null, stepSha = null) {
    const { error } = await this.supabase
      .from('migration_execution_events')
      .insert({
        plan_id: planId,
        event_type: eventType,
        wave_name: waveName,
        step_sha: stepSha,
        message,
        metrics: JSON.stringify(metrics)
      });

    if (error) {
      console.error('Failed to emit event:', error);
    }
  }

  /**
   * Abort current execution
   */
  abort() {
    if (this.isRunning) {
      console.log('🛑 Aborting migration execution...');
      this.abortController.abort();
    }
  }

  /**
   * Get current execution status
   * @param {string} planId - Plan identifier
   * @returns {Promise<Object|null>} Execution state
   */
  async getExecutionStatus(planId) {
    const { data, error } = await this.supabase
      .from('migration_execution_state')
      .select('*')
      .eq('plan_id', planId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Get recent execution events
   * @param {string} planId - Plan identifier
   * @param {number} limit - Event limit
   * @returns {Promise<Array>} Recent events
   */
  async getExecutionEvents(planId, limit = 50) {
    const { data, error } = await this.supabase
      .from('migration_execution_events')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return data;
  }

  /**
   * Utility sleep function
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.eventSubscription) {
      this.supabase.removeChannel(this.eventSubscription);
    }
  }
}