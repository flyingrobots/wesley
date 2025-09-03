/**
 * T.A.S.K.S: Tasks Are Sequenced Key Steps
 * GraphQL diff → MIG-DSL plan → wave'd DAG with proof-obligations
 * @module Tasks
 */

/**
 * Hazard classification levels for migration operations
 * @readonly
 * @enum {number}
 */
export const HazardClass = {
  /** Metadata only (views, comments) - always allowed */
  H0: 0,
  /** Additive, non-blocking (ADD COLUMN NULL, INDEX CONCURRENTLY) */
  H1: 1,
  /** Data-touching with throttling (BACKFILL) */
  H2: 2,
  /** Blocking shape changes (DROP/SET NOT NULL) - blocked in Chaos */
  H3: 3
};

/**
 * PostgreSQL lock classification levels
 * @readonly
 * @enum {string}
 */
export const LockClass = {
  ACCESS_SHARE: 'ACCESS_SHARE',
  ROW_SHARE: 'ROW_SHARE',
  ROW_EXCLUSIVE: 'ROW_EXCLUSIVE',
  SHARE_UPDATE_EXCLUSIVE: 'SHARE_UPDATE_EXCLUSIVE',
  SHARE: 'SHARE',
  SHARE_ROW_EXCLUSIVE: 'SHARE_ROW_EXCLUSIVE',
  EXCLUSIVE: 'EXCLUSIVE',
  ACCESS_EXCLUSIVE: 'ACCESS_EXCLUSIVE'
};

/**
 * Wave execution phases in order
 * @readonly
 * @enum {string}
 */
export const WavePhase = {
  PLAN: 'plan',
  EXPAND: 'expand',
  BACKFILL: 'backfill',
  VALIDATE: 'validate',
  CONTRACT: 'contract'
};

/**
 * Migration step with computed obligations and safety metadata
 */
export class StepWithObligations {
  /**
   * @param {Object} step - Raw migration step
   * @param {string} stepSha - Idempotency hash
   * @param {number} hazardClass - HazardClass enum value
   * @param {Object} obligations - Safety obligations
   */
  constructor(step, stepSha, hazardClass, obligations) {
    this.step = step;
    this.stepSha = stepSha;
    this.hazardClass = hazardClass;
    this.obligations = obligations;
  }
}

/**
 * Wave of migration steps with aggregated metadata
 */
export class WaveWithObligations {
  /**
   * @param {string} name - Wave phase name
   * @param {number} waveNumber - Sequential wave number
   * @param {StepWithObligations[]} steps - Steps in this wave
   * @param {number} maxHazard - Highest hazard class in wave
   * @param {number} estimatedDurationMs - Total estimated execution time
   * @param {boolean} canRunInChaos - Safe for chaos mode
   */
  constructor(name, waveNumber, steps, maxHazard, estimatedDurationMs, canRunInChaos) {
    this.name = name;
    this.waveNumber = waveNumber;
    this.steps = steps;
    this.maxHazard = maxHazard;
    this.estimatedDurationMs = estimatedDurationMs;
    this.canRunInChaos = canRunInChaos;
  }
}

/**
 * Complete migration execution plan with all waves and metadata
 */
export class ExecutionPlan {
  /**
   * @param {string} planId - Unique plan identifier
   * @param {string} title - Human-readable title
   * @param {string} reason - Justification for migration
   * @param {string} requesterId - Employee who requested migration
   * @param {WaveWithObligations[]} waves - Execution waves
   * @param {number} totalEstimatedMs - Total execution time estimate
   * @param {number} maxHazardClass - Highest hazard in entire plan
   * @param {boolean} chaosCompatible - Safe for chaos mode execution
   */
  constructor(planId, title, reason, requesterId, waves, totalEstimatedMs, maxHazardClass, chaosCompatible) {
    this.planId = planId;
    this.title = title;
    this.reason = reason;
    this.requesterId = requesterId;
    this.waves = waves;
    this.totalEstimatedMs = totalEstimatedMs;
    this.maxHazardClass = maxHazardClass;
    this.chaosCompatible = chaosCompatible;
    this.createdAt = new Date().toISOString();
  }
}

/**
 * Migration planner that transforms DSL into safe execution plans
 */
export class TasksPlanner {
  /**
   * Create new migration planner
   */
  constructor() {
    this.allowedTables = new Set([
      'employee', 'activity_event', 'plate_item', 'delegation_event',
      'touchpoint_message', 'touchpoint_channel', 'ideation_slide',
      'deep_dive_session', 'deep_dive_participant', 'live_cursor',
      'bandwidth_pairing', 'migration_audit'
    ]);

    this.blockedOps = new Set([
      'drop_table', 'drop_column', 'alter_type', 'drop_constraint',
      'truncate', 'delete', 'update'
    ]);
  }

  /**
   * Classify operation hazard level
   * @param {Object} op - Migration operation
   * @returns {number} HazardClass enum value
   */
  classifyHazard(op) {
    switch (op.op) {
      // H0: Metadata only
      case 'create_view':
        return HazardClass.H0;
      
      // H1: Additive, non-blocking
      case 'add_column':
        return op.nullable === false ? HazardClass.H2 : HazardClass.H1;
      case 'add_index_concurrently':
      case 'add_foreign_key_not_valid':
        return HazardClass.H1;
      
      // H2: Data-touching with throttling
      case 'backfill_sql':
        return HazardClass.H2;
      
      // H3: Blocking operations
      case 'validate_constraint':
      case 'set_not_null':
      case 'drop_column':
      case 'drop_table':
        return HazardClass.H3;
      
      default:
        return HazardClass.H3; // Conservative default
    }
  }

  /**
   * Calculate required PostgreSQL lock level
   * @param {Object} op - Migration operation
   * @returns {string} LockClass enum value
   */
  calculateLockClass(op) {
    switch (op.op) {
      case 'create_view':
        return LockClass.ACCESS_SHARE;
      
      case 'add_column':
        return op.nullable === false 
          ? LockClass.ACCESS_EXCLUSIVE  // Needs table rewrite
          : LockClass.SHARE_UPDATE_EXCLUSIVE; // Just metadata
      
      case 'add_index_concurrently':
        return LockClass.SHARE_UPDATE_EXCLUSIVE; // CONCURRENTLY uses weaker locks
      
      case 'add_foreign_key_not_valid':
        return LockClass.SHARE_ROW_EXCLUSIVE; // NOT VALID avoids full scan
      
      case 'backfill_sql':
        return LockClass.ROW_EXCLUSIVE; // Updates data
      
      case 'validate_constraint':
        return LockClass.SHARE_UPDATE_EXCLUSIVE; // Just metadata update
      
      case 'set_not_null':
        return LockClass.ACCESS_EXCLUSIVE; // Needs table scan + rewrite
      
      case 'drop_column':
      case 'drop_table':
        return LockClass.ACCESS_EXCLUSIVE;
      
      default:
        return LockClass.ACCESS_EXCLUSIVE; // Conservative
    }
  }

  /**
   * Generate idempotency prechecks for operation
   * @param {Object} op - Migration operation
   * @returns {string[]} SQL precheck expressions
   */
  generatePrechecks(op) {
    const checks = [];
    
    switch (op.op) {
      case 'add_column':
        checks.push(`table_exists('${op.table}')`);
        checks.push(`NOT column_exists('${op.table}', '${op.name}')`);
        break;
        
      case 'add_index_concurrently':
        checks.push(`table_exists('${op.table}')`);
        op.cols.forEach(col => 
          checks.push(`column_exists('${op.table}', '${col}')`)
        );
        const idxName = `${op.table}_${op.cols.join('_')}_idx`;
        checks.push(`NOT index_exists('${idxName}')`);
        break;
        
      case 'add_foreign_key_not_valid':
        checks.push(`table_exists('${op.src}')`);
        checks.push(`table_exists('${op.tgt}')`);
        checks.push(`column_exists('${op.src}', '${op.col}')`);
        checks.push(`column_exists('${op.tgt}', '${op.tgt_col}')`);
        const fkName = `${op.src}_${op.col}_fkey`;
        checks.push(`NOT constraint_exists('${op.src}', '${fkName}')`);
        break;
        
      case 'validate_constraint':
        checks.push(`table_exists('${op.table}')`);
        checks.push(`constraint_exists('${op.table}', '${op.name}')`);
        checks.push(`NOT constraint_valid('${op.table}', '${op.name}')`);
        break;
        
      case 'set_not_null':
        checks.push(`table_exists('${op.table}')`);
        checks.push(`column_exists('${op.table}', '${op.column}')`);
        checks.push(`column_nullable('${op.table}', '${op.column}')`);
        checks.push(`count_nulls('${op.table}', '${op.column}') = 0`);
        break;
    }
    
    return checks;
  }

  /**
   * Generate verification postchecks for operation
   * @param {Object} op - Migration operation
   * @returns {string[]} SQL postcheck expressions
   */
  generatePostchecks(op) {
    const checks = [];
    
    switch (op.op) {
      case 'add_column':
        checks.push(`column_exists('${op.table}', '${op.name}')`);
        if (op.type) {
          checks.push(`column_type('${op.table}', '${op.name}') = '${op.type}'`);
        }
        break;
        
      case 'add_index_concurrently':
        const idxName = `${op.table}_${op.cols.join('_')}_idx`;
        checks.push(`index_exists('${idxName}')`);
        checks.push(`index_valid('${idxName}')`);
        break;
        
      case 'add_foreign_key_not_valid':
        const fkName = `${op.src}_${op.col}_fkey`;
        checks.push(`constraint_exists('${op.src}', '${fkName}')`);
        break;
        
      case 'validate_constraint':
        checks.push(`constraint_valid('${op.table}', '${op.name}')`);
        break;
        
      case 'set_not_null':
        checks.push(`NOT column_nullable('${op.table}', '${op.column}')`);
        break;
    }
    
    return checks;
  }

  /**
   * Compute deterministic hash for step idempotency
   * @param {Object} step - Migration step
   * @param {string} waveName - Wave phase name
   * @returns {string} 16-character hex hash
   */
  computeStepHash(step, waveName) {
    const normalized = JSON.stringify({ wave: waveName, ...step }, Object.keys({ wave: waveName, ...step }).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
      const hashArray = new Uint8Array(hashBuffer);
      return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16);
    });
  }

  /**
   * Add safety obligations to a migration step
   * @param {Object} step - Raw migration step
   * @param {string} waveName - Wave phase name
   * @param {Object} waveLimits - Wave-specific limits
   * @returns {Promise<StepWithObligations>}
   */
  async addObligations(step, waveName, waveLimits) {
    const hazardClass = this.classifyHazard(step);
    const lockClassMax = this.calculateLockClass(step);
    const stepSha = await this.computeStepHash(step, waveName);
    
    const obligations = {
      lockClassMax,
      maxStmtMs: waveLimits?.maxStmtMs || 10000,
      maxLockMs: waveLimits?.maxLockMs || 2000,
      prechecks: this.generatePrechecks(step),
      postchecks: this.generatePostchecks(step),
      idempotent: true // All operations designed to be idempotent
    };
    
    return new StepWithObligations(step, stepSha, hazardClass, obligations);
  }

  /**
   * Estimate execution time for operation type
   * @param {Object} step - Migration step
   * @returns {number} Estimated milliseconds
   */
  estimateDuration(step) {
    switch (step.op) {
      case 'add_column':
        return step.nullable === false ? 5000 : 1000;
      case 'add_index_concurrently':
        return 30000; // Index builds are slow
      case 'backfill_sql':
        return 15000; // Data operations take time
      case 'validate_constraint':
        return 10000; // Validation requires scan
      default:
        return 2000;
    }
  }

  /**
   * Transform MIG-DSL plan into safe execution plan
   * @param {Object} plan - Raw migration plan
   * @returns {Promise<ExecutionPlan>}
   */
  async planMigration(plan) {
    const planId = `PLAN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const waves = [];
    
    let waveNumber = 1;
    let totalEstimatedMs = 0;
    let maxHazardClass = HazardClass.H0;
    
    for (const waveDef of plan.waves) {
      const stepsWithObligations = [];
      let maxHazard = HazardClass.H0;
      let estimatedDurationMs = 0;
      
      for (const step of waveDef.steps) {
        const stepWithObligations = await this.addObligations(step, waveDef.name, waveDef.limits);
        stepsWithObligations.push(stepWithObligations);
        
        // Track max hazard for wave and overall
        if (stepWithObligations.hazardClass > maxHazard) {
          maxHazard = stepWithObligations.hazardClass;
        }
        if (stepWithObligations.hazardClass > maxHazardClass) {
          maxHazardClass = stepWithObligations.hazardClass;
        }
        
        estimatedDurationMs += this.estimateDuration(step);
      }
      
      const canRunInChaos = maxHazard <= HazardClass.H2; // Block H3 in chaos
      
      waves.push(new WaveWithObligations(
        waveDef.name,
        waveNumber++,
        stepsWithObligations,
        maxHazard,
        estimatedDurationMs,
        canRunInChaos
      ));
      
      totalEstimatedMs += estimatedDurationMs;
    }
    
    const chaosCompatible = maxHazardClass <= HazardClass.H2;
    
    return new ExecutionPlan(
      planId,
      plan.title,
      plan.reason,
      plan.requesterId,
      waves,
      totalEstimatedMs,
      maxHazardClass,
      chaosCompatible
    );
  }

  /**
   * Validate plan for Chaos Mode execution
   * @param {Object} plan - Migration plan to validate
   * @throws {Error} If plan not safe for chaos mode
   */
  async validateForChaos(plan) {
    // Basic structure validation
    if (!plan.title || plan.title.length < 3 || plan.title.length > 80) {
      throw new Error('Title must be 3-80 characters');
    }
    
    if (!plan.reason || plan.reason.length < 10 || plan.reason.length > 280) {
      throw new Error('Reason must be 10-280 characters');
    }
    
    if (!plan.waves || plan.waves.length === 0 || plan.waves.length > 5) {
      throw new Error('Plan must have 1-5 waves');
    }
    
    // Generate execution plan to check hazards
    const executionPlan = await this.planMigration(plan);
    
    if (!executionPlan.chaosCompatible) {
      const dangerousOps = executionPlan.waves
        .flatMap(w => w.steps)
        .filter(s => s.hazardClass > HazardClass.H2)
        .map(s => s.step.op);
      
      throw new Error(`Plan contains H3 operations blocked in Chaos Mode: ${dangerousOps.join(', ')}`);
    }
    
    // Additional chaos-specific checks
    for (const wave of executionPlan.waves) {
      if (wave.name === 'contract') {
        throw new Error('CONTRACT wave is disabled in Chaos Mode for safety');
      }
      
      if (wave.estimatedDurationMs > 300000) { // 5 minutes
        throw new Error(`Wave '${wave.name}' estimated at ${wave.estimatedDurationMs}ms exceeds 5min Chaos Mode limit`);
      }
      
      // Check step count per wave  
      if (wave.steps.length > 5) {
        throw new Error(`Wave '${wave.name}' has ${wave.steps.length} steps, max 5 allowed in Chaos Mode`);
      }
    }
    
    // Validate wave ordering follows safe progression
    const waveOrder = ['plan', 'expand', 'backfill', 'validate'];
    const planWaveOrder = executionPlan.waves.map(w => w.name);
    
    for (let i = 0; i < planWaveOrder.length - 1; i++) {
      const currentIdx = waveOrder.indexOf(planWaveOrder[i]);
      const nextIdx = waveOrder.indexOf(planWaveOrder[i + 1]);
      
      if (currentIdx >= nextIdx) {
        throw new Error(`Invalid wave sequence: ${planWaveOrder[i]} → ${planWaveOrder[i + 1]} violates safe progression`);
      }
    }
    
    // Validate table allowlist
    const allTables = plan.waves
      .flatMap(w => w.steps)
      .map(s => s.table || s.src || s.name)
      .filter(Boolean);
    
    for (const table of allTables) {
      if (!this.allowedTables.has(table)) {
        throw new Error(`Table '${table}' not allowed in chaos mode`);
      }
    }
    
    // Check for blocked operations
    const allOps = plan.waves
      .flatMap(w => w.steps)
      .map(s => s.op);
    
    for (const op of allOps) {
      if (this.blockedOps.has(op)) {
        throw new Error(`Operation '${op}' blocked for safety`);
      }
    }
  }
}

// Create singleton instance
export const tasksPlanner = new TasksPlanner();