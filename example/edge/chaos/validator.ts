// S.E.O. Chaos Mode Migration Validator
// Validates DSL → safe DDL operations (no arbitrary SQL allowed)

import { z } from "https://esm.sh/zod@3.22.4";

// Zod schema for safe migration DSL
export const Plan = z.object({
  title: z.string().min(3).max(80),
  reason: z.string().min(10).max(280),
  ops: z.array(z.union([
    z.object({ 
      op: z.literal("add_column"), 
      table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      type: z.string().regex(/^(text|varchar|integer|numeric|boolean|uuid|timestamptz|jsonb)$/), 
      nullable: z.boolean().optional(), 
      default: z.string().nullable().optional(), 
      comment: z.string().max(200).optional() 
    }),
    z.object({ 
      op: z.literal("add_index_concurrently"), 
      table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      cols: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).min(1).max(5) 
    }),
    z.object({ 
      op: z.literal("create_table"), 
      name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      cols: z.array(z.object({
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        type: z.string().regex(/^(text|varchar|integer|numeric|boolean|uuid|timestamptz|jsonb)$/),
        nullable: z.boolean().optional()
      })).min(1).max(10), 
      pkey: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/) 
    }),
    z.object({ 
      op: z.literal("rename_column"), 
      table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      old: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      new: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/) 
    }),
    z.object({ 
      op: z.literal("add_foreign_key_not_valid"), 
      src: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      col: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      tgt: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      tgt_col: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/) 
    }),
    z.object({ 
      op: z.literal("validate_constraint"), 
      table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/) 
    }),
    z.object({ 
      op: z.literal("create_view"), 
      name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), 
      sql: z.string().toLowerCase().startsWith("select ").max(1000)
    })
  ])).min(1).max(5)  // Limit chaos to reasonable size
});

// Allowed core tables for demo (prevent breaking system tables)
const ALLOWED_TABLES = new Set([
  'employee', 'activity_event', 'plate_item', 'delegation_event',
  'touchpoint_message', 'touchpoint_channel', 'ideation_slide', 
  'deep_dive_session', 'deep_dive_participant', 'live_cursor',
  'bandwidth_pairing', 'migration_audit'
]);

// Dangerous operations blocked in chaos mode
const BLOCKED_OPS = new Set([
  'drop_table', 'drop_column', 'alter_type', 'drop_constraint',
  'truncate', 'delete', 'update'  // No data manipulation
]);

// Validate migration plan safety
export function validate(plan: any): void {
  try {
    // Schema validation first
    const validPlan = Plan.parse(plan);
    
    // Additional business logic validation
    for (const op of validPlan.ops) {
      // Check table allowlist
      const table = 'table' in op ? op.table : 
                   'src' in op ? op.src : 
                   'name' in op ? op.name : null;
      
      if (table && !ALLOWED_TABLES.has(table)) {
        throw new Error(`Table '${table}' not allowed in chaos mode`);
      }
      
      // Check for blocked operations  
      if (BLOCKED_OPS.has(op.op)) {
        throw new Error(`Operation '${op.op}' blocked for safety`);
      }
      
      // Additional per-operation validation
      switch (op.op) {
        case 'add_column':
          // Prevent NOT NULL without default (would lock table)
          if (op.nullable === false && !op.default) {
            throw new Error('NOT NULL columns must have DEFAULT in chaos mode');
          }
          // Block system columns
          if (op.name.startsWith('pg_') || op.name.startsWith('_')) {
            throw new Error('System column names not allowed');
          }
          break;
          
        case 'create_table':
          // Ensure primary key exists in columns
          if (!op.cols.some(col => col.name === op.pkey)) {
            throw new Error('Primary key must be defined in columns');
          }
          break;
          
        case 'create_view':
          // Only allow simple SELECT statements
          if (op.sql.toLowerCase().includes('drop') || 
              op.sql.toLowerCase().includes('delete') ||
              op.sql.toLowerCase().includes('update') ||
              op.sql.toLowerCase().includes('insert')) {
            throw new Error('Views can only contain SELECT statements');
          }
          break;
      }
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid plan schema: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Generate safe SQL from validated plan operations
export function compile(plan: any): string[] {
  const statements: string[] = [];
  
  for (const op of plan.ops) {
    switch (op.op) {
      case 'add_column':
        const nullable = op.nullable !== false ? '' : ' NOT NULL';
        const defaultClause = op.default ? ` DEFAULT ${op.default}` : '';
        statements.push(
          `ALTER TABLE ${op.table} ADD COLUMN IF NOT EXISTS ${op.name} ${op.type}${nullable}${defaultClause};`
        );
        break;
        
      case 'add_index_concurrently':
        const indexName = `${op.table}_${op.cols.join('_')}_idx`;
        statements.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${op.table}(${op.cols.join(',')});`
        );
        break;
        
      case 'create_table':
        const columns = op.cols.map(col => 
          `${col.name} ${col.type}${col.nullable === false ? ' NOT NULL' : ''}`
        ).join(', ');
        statements.push(
          `CREATE TABLE IF NOT EXISTS ${op.name} (${columns}, PRIMARY KEY (${op.pkey}));`
        );
        break;
        
      case 'rename_column':
        statements.push(
          `ALTER TABLE ${op.table} RENAME COLUMN ${op.old} TO ${op.new};`
        );
        break;
        
      case 'add_foreign_key_not_valid':
        const constraintName = `${op.src}_${op.col}_fkey`;
        statements.push(
          `ALTER TABLE ${op.src} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${op.col}) REFERENCES ${op.tgt}(${op.tgt_col}) NOT VALID;`
        );
        break;
        
      case 'validate_constraint':
        statements.push(
          `ALTER TABLE ${op.table} VALIDATE CONSTRAINT ${op.name};`
        );
        break;
        
      case 'create_view':
        statements.push(
          `CREATE OR REPLACE VIEW ${op.name} AS ${op.sql};`
        );
        break;
    }
  }
  
  return statements;
}

// Rate limiting check
export function checkRateLimit(userId: string): boolean {
  // TODO: Implement with Deno KV or Redis
  // For now, always allow (implement proper rate limiting in production)
  return true;
}

export type ValidatedPlan = z.infer<typeof Plan>;