// T.A.S.K.S: Tasks Are Sequenced Key Steps
// GraphQL diff → MIG-DSL plan → wave'd DAG with proof-obligations

import { z } from "https://esm.sh/zod@3.22.4";
import { createHash } from "https://deno.land/std@0.208.0/crypto/mod.ts";

// MIG-DSL v0.2 with wave execution model
export const MigrationPlan = z.object({
  title: z.string().min(3).max(80),
  reason: z.string().min(10).max(280),
  requester_id: z.string().uuid(),
  waves: z.array(z.object({
    name: z.enum(["plan", "expand", "backfill", "validate", "contract"]),
    steps: z.array(z.union([
      // Expand wave operations (non-blocking)
      z.object({
        op: z.literal("add_column"),
        table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        type: z.string().regex(/^(text|varchar|integer|numeric|boolean|uuid|timestamptz|jsonb)$/),
        nullable: z.boolean().default(true), // Default true for safety
        default: z.string().nullable().optional(),
        comment: z.string().max(200).optional()
      }),
      z.object({
        op: z.literal("add_index_concurrently"),
        table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        cols: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).min(1).max(5)
      }),
      z.object({
        op: z.literal("add_foreign_key_not_valid"),
        src: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        col: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        tgt: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        tgt_col: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      }),
      z.object({
        op: z.literal("create_view"),
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        sql: z.string().toLowerCase().startsWith("select ").max(1000)
      }),
      
      // Backfill wave operations (throttled)
      z.object({
        op: z.literal("backfill_sql"),
        sql: z.string().max(1000),
        description: z.string().optional()
      }),
      
      // Validate wave operations (constraint activation)
      z.object({
        op: z.literal("validate_constraint"),
        table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      }),
      z.object({
        op: z.literal("set_not_null"),
        table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        column: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      }),
      
      // Contract wave operations (BLOCKED in Chaos Mode)
      z.object({
        op: z.literal("drop_column"),
        table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      }),
      z.object({
        op: z.literal("drop_table"),
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      })
    ])).min(1).max(8),
    
    // Wave-specific limits and policies
    limits: z.object({
      max_lock_ms: z.number().int().min(100).max(30000).default(2000),
      max_stmt_ms: z.number().int().min(1000).max(300000).default(10000),
      rows_per_second: z.number().int().min(100).max(50000).optional(),
      max_retries: z.number().int().min(0).max(5).default(2)
    }).optional()
  })).min(1).max(5)
});

// Hazard classification system
export enum HazardClass {
  H0 = 0, // Metadata only (views, comments) - always allowed
  H1 = 1, // Additive, non-blocking (ADD COLUMN NULL, INDEX CONCURRENTLY) 
  H2 = 2, // Data-touching with throttling (BACKFILL)
  H3 = 3  // Blocking shape changes (DROP/SET NOT NULL) - blocked in Chaos
}

export enum LockClass {
  ACCESS_SHARE = 'ACCESS_SHARE',
  ROW_SHARE = 'ROW_SHARE', 
  ROW_EXCLUSIVE = 'ROW_EXCLUSIVE',
  SHARE_UPDATE_EXCLUSIVE = 'SHARE_UPDATE_EXCLUSIVE',
  SHARE = 'SHARE',
  SHARE_ROW_EXCLUSIVE = 'SHARE_ROW_EXCLUSIVE',
  EXCLUSIVE = 'EXCLUSIVE',
  ACCESS_EXCLUSIVE = 'ACCESS_EXCLUSIVE'
}

// Step with computed obligations
export interface StepWithObligations {
  step: z.infer<typeof MigrationPlan>['waves'][0]['steps'][0];
  step_sha: string;
  hazard_class: HazardClass;
  obligations: {
    lock_class_max: LockClass;
    max_stmt_ms: number;
    max_lock_ms: number;
    prechecks: string[];
    postchecks: string[];
    idempotent: boolean;
  };
}

export interface WaveWithObligations {
  name: string;
  wave_number: number;
  steps: StepWithObligations[];
  max_hazard: HazardClass;
  estimated_duration_ms: number;
  can_run_in_chaos: boolean;
}

export interface ExecutionPlan {
  plan_id: string;
  title: string;
  reason: string;
  requester_id: string;
  waves: WaveWithObligations[];
  total_estimated_ms: number;
  max_hazard_class: HazardClass;
  chaos_compatible: boolean;
  created_at: string;
}

// Operation hazard classifier
export function classifyHazard(op: any): HazardClass {
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

// Lock class calculator  
export function calculateLockClass(op: any): LockClass {
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

// Generate prechecks for idempotency
export function generatePrechecks(op: any): string[] {
  const checks: string[] = [];
  
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

// Generate postchecks for verification
export function generatePostchecks(op: any): string[] {
  const checks: string[] = [];
  
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

// Compute step hash for idempotency
export function computeStepHash(step: any, wave_name: string): string {
  const normalized = JSON.stringify({ wave: wave_name, ...step }, Object.keys({ wave: wave_name, ...step }).sort());
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// Add obligations to a step
export function addObligations(step: any, wave_name: string, wave_limits: any): StepWithObligations {
  const hazard_class = classifyHazard(step);
  const lock_class_max = calculateLockClass(step);
  const step_sha = computeStepHash(step, wave_name);
  
  return {
    step,
    step_sha,
    hazard_class,
    obligations: {
      lock_class_max,
      max_stmt_ms: wave_limits?.max_stmt_ms || 10000,
      max_lock_ms: wave_limits?.max_lock_ms || 2000,
      prechecks: generatePrechecks(step),
      postchecks: generatePostchecks(step),
      idempotent: true // All operations designed to be idempotent
    }
  };
}

// Main T.A.S.K.S. planner function
export function planMigration(plan: z.infer<typeof MigrationPlan>): ExecutionPlan {
  const plan_id = `PLAN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const waves: WaveWithObligations[] = [];
  
  let wave_number = 1;
  let total_estimated_ms = 0;
  let max_hazard_class = HazardClass.H0;
  
  for (const wave_def of plan.waves) {
    const steps_with_obligations: StepWithObligations[] = [];
    let max_hazard = HazardClass.H0;
    let estimated_duration_ms = 0;
    
    for (const step of wave_def.steps) {
      const step_with_obligations = addObligations(step, wave_def.name, wave_def.limits);
      steps_with_obligations.push(step_with_obligations);
      
      // Track max hazard for wave and overall
      if (step_with_obligations.hazard_class > max_hazard) {
        max_hazard = step_with_obligations.hazard_class;
      }
      if (step_with_obligations.hazard_class > max_hazard_class) {
        max_hazard_class = step_with_obligations.hazard_class;
      }
      
      // Estimate duration based on operation type
      switch (step.op) {
        case 'add_column':
          estimated_duration_ms += step.nullable === false ? 5000 : 1000;
          break;
        case 'add_index_concurrently':
          estimated_duration_ms += 30000; // Index builds are slow
          break;
        case 'backfill_sql':
          estimated_duration_ms += 15000; // Data operations take time
          break;
        case 'validate_constraint':
          estimated_duration_ms += 10000; // Validation requires scan
          break;
        default:
          estimated_duration_ms += 2000;
      }
    }
    
    const can_run_in_chaos = max_hazard <= HazardClass.H2; // Block H3 in chaos
    
    waves.push({
      name: wave_def.name,
      wave_number: wave_number++,
      steps: steps_with_obligations,
      max_hazard,
      estimated_duration_ms,
      can_run_in_chaos
    });
    
    total_estimated_ms += estimated_duration_ms;
  }
  
  const chaos_compatible = max_hazard_class <= HazardClass.H2;
  
  return {
    plan_id,
    title: plan.title,
    reason: plan.reason,
    requester_id: plan.requester_id,
    waves,
    total_estimated_ms,
    max_hazard_class,
    chaos_compatible,
    created_at: new Date().toISOString()
  };
}

// Chaos Mode validator - extends the basic validator
export function validateForChaos(plan: z.infer<typeof MigrationPlan>): void {
  // First run basic validation
  const validPlan = MigrationPlan.parse(plan);
  
  // Generate execution plan to check hazards
  const executionPlan = planMigration(validPlan);
  
  if (!executionPlan.chaos_compatible) {
    const dangerousOps = executionPlan.waves
      .flatMap(w => w.steps)
      .filter(s => s.hazard_class > HazardClass.H2)
      .map(s => s.step.op);
    
    throw new Error(`Plan contains H3 operations blocked in Chaos Mode: ${dangerousOps.join(', ')}`);
  }
  
  // Additional chaos-specific checks
  for (const wave of executionPlan.waves) {
    if (wave.name === 'contract') {
      throw new Error('CONTRACT wave is disabled in Chaos Mode for safety');
    }
    
    if (wave.estimated_duration_ms > 300000) { // 5 minutes
      throw new Error(`Wave '${wave.name}' estimated at ${wave.estimated_duration_ms}ms exceeds 5min Chaos Mode limit`);
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
}

export type ValidatedPlan = z.infer<typeof MigrationPlan>;
export type { ExecutionPlan, WaveWithObligations, StepWithObligations };