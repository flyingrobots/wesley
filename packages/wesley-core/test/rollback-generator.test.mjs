/**
 * Rollback Generator Tests
 * Tests for inverse DDL operations and rollback safety
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { RollbackGenerator } from '../src/domain/generators/RollbackGenerator.mjs';
import { Field } from '../src/domain/Schema.mjs';

test('RollbackGenerator initializes correctly', () => {
  const generator = new RollbackGenerator();
  
  assert(generator.DATA_LOSS_OPERATIONS.has('drop_table'));
  assert(generator.DATA_LOSS_OPERATIONS.has('drop_column'));
  assert(generator.DATA_LOSS_OPERATIONS.has('alter_type'));
  assert(generator.DATA_LOSS_OPERATIONS.has('drop_constraint'));
});

test('generates rollback for CREATE TABLE', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { kind: 'create_table', table: 'users' };
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'drop_table_rollback');
  assert.equal(rollbackStep.table, 'users');
  assert.equal(rollbackStep.riskLevel, 'high');
  assert.equal(rollbackStep.dataLoss, true);
  assert(rollbackStep.sql.includes('DROP TABLE IF EXISTS "users"'));
});

test('throws error for DROP TABLE rollback', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { kind: 'drop_table', table: 'old_table' };
  
  assert.throws(() => {
    generator.generateStepRollback(forwardStep);
  }, /cannot be automatically rolled back/);
});

test('generates rollback for ADD COLUMN', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'add_column', 
    table: 'users', 
    column: 'email',
    field: new Field({ name: 'email', type: 'String', nonNull: true })
  };
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'drop_column_rollback');
  assert.equal(rollbackStep.table, 'users');
  assert.equal(rollbackStep.column, 'email');
  assert.equal(rollbackStep.riskLevel, 'medium');
  assert.equal(rollbackStep.dataLoss, true);
  assert(rollbackStep.sql.includes('DROP COLUMN IF EXISTS "email"'));
});

test('throws error for DROP COLUMN rollback', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { kind: 'drop_column', table: 'users', column: 'deprecated' };
  
  assert.throws(() => {
    generator.generateStepRollback(forwardStep);
  }, /cannot be automatically rolled back/);
});

test('generates rollback for ALTER TYPE with safe conversion', () => {
  const generator = new RollbackGenerator();
  
  const fromField = { type: 'String', nonNull: false };
  const toField = { type: 'String', nonNull: true }; // Just nullability change
  
  const forwardStep = { 
    kind: 'alter_type', 
    table: 'users', 
    column: 'name',
    from: fromField,
    to: toField
  };
  
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'alter_type_rollback');
  assert.equal(rollbackStep.table, 'users');
  assert.equal(rollbackStep.column, 'name');
  assert.equal(rollbackStep.fromType, 'String');
  assert.equal(rollbackStep.toType, 'String');
  assert(rollbackStep.sql.includes('ALTER TABLE "users"'));
  assert(rollbackStep.sql.includes('DROP NOT NULL'));
});

test('throws error for unsafe ALTER TYPE rollback', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'alter_type', 
    table: 'users', 
    column: 'age',
    from: { type: 'String' },
    to: { type: 'Boolean' } // Unsafe conversion
  };
  
  assert.throws(() => {
    generator.generateStepRollback(forwardStep);
  }, /cannot be safely rolled back/);
});

test('determines type rollback safety correctly', () => {
  const generator = new RollbackGenerator();
  
  // Safe rollbacks
  assert.equal(generator.isTypeRollbackSafe({ type: 'String' }, { type: 'String' }), true);
  assert.equal(generator.isTypeRollbackSafe({ type: 'String' }, { type: 'ID' }), true);
  assert.equal(generator.isTypeRollbackSafe({ type: 'Int' }, { type: 'Float' }), true);
  
  // Unsafe rollbacks
  assert.equal(generator.isTypeRollbackSafe({ type: 'Float' }, { type: 'Int' }), false);
  assert.equal(generator.isTypeRollbackSafe({ type: 'String' }, { type: 'Boolean' }), false);
  assert.equal(generator.isTypeRollbackSafe({ type: 'DateTime' }, { type: 'String' }), false);
});

test('generates rollback for CREATE INDEX', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'create_index', 
    table: 'users', 
    column: 'email',
    indexName: 'idx_users_email'
  };
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'drop_index_rollback');
  assert.equal(rollbackStep.table, 'users');
  assert.equal(rollbackStep.indexName, 'idx_users_email');
  assert.equal(rollbackStep.riskLevel, 'low');
  assert.equal(rollbackStep.dataLoss, false);
  assert(rollbackStep.sql.includes('DROP INDEX IF EXISTS "idx_users_email"'));
});

test('generates rollback for DROP INDEX', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'drop_index', 
    table: 'users', 
    indexName: 'idx_users_email',
    columns: ['email'],
    unique: false
  };
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'create_index_rollback');
  assert.equal(rollbackStep.table, 'users');
  assert.equal(rollbackStep.indexName, 'idx_users_email');
  assert(rollbackStep.sql.includes('CREATE INDEX IF NOT EXISTS "idx_users_email"'));
  assert(rollbackStep.sql.includes('ON "users"'));
  assert(rollbackStep.sql.includes('"email"'));
});

test('generates rollback for ADD CONSTRAINT', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'add_constraint', 
    table: 'posts', 
    constraintName: 'fk_user_id',
    constraintType: 'foreign_key'
  };
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'drop_constraint_rollback');
  assert.equal(rollbackStep.table, 'posts');
  assert.equal(rollbackStep.constraintName, 'fk_user_id');
  assert.equal(rollbackStep.riskLevel, 'medium');
  assert(rollbackStep.sql.includes('DROP CONSTRAINT IF EXISTS "fk_user_id"'));
});

test('throws error for DROP CONSTRAINT without original definition', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'drop_constraint', 
    table: 'users', 
    constraintName: 'chk_age_positive'
    // Missing originalDefinition
  };
  
  assert.throws(() => {
    generator.generateStepRollback(forwardStep);
  }, /original definition not captured/);
});

test('generates rollback for DROP CONSTRAINT with original definition', () => {
  const generator = new RollbackGenerator();
  
  const forwardStep = { 
    kind: 'drop_constraint', 
    table: 'users', 
    constraintName: 'chk_age_positive',
    constraintType: 'check',
    originalDefinition: 'ALTER TABLE "users" ADD CONSTRAINT "chk_age_positive" CHECK (age > 0);'
  };
  
  const rollbackStep = generator.generateStepRollback(forwardStep);
  
  assert.equal(rollbackStep.kind, 'add_constraint_rollback');
  assert.equal(rollbackStep.table, 'users');
  assert.equal(rollbackStep.constraintName, 'chk_age_positive');
  assert.equal(rollbackStep.sql, forwardStep.originalDefinition);
});

test('generates rollback for RLS operations', () => {
  const generator = new RollbackGenerator();
  
  // Enable RLS rollback
  const enableRLSStep = { kind: 'enable_rls', table: 'users' };
  const rlsRollback = generator.generateStepRollback(enableRLSStep);
  
  assert.equal(rlsRollback.kind, 'disable_rls_rollback');
  assert.equal(rlsRollback.table, 'users');
  assert(rlsRollback.sql.includes('DISABLE ROW LEVEL SECURITY'));
  
  // Create policy rollback
  const policyStep = { kind: 'create_policy', table: 'users', policyName: 'user_select' };
  const policyRollback = generator.generateStepRollback(policyStep);
  
  assert.equal(policyRollback.kind, 'drop_policy_rollback');
  assert.equal(policyRollback.table, 'users');
  assert.equal(policyRollback.policyName, 'user_select');
  assert(policyRollback.sql.includes('DROP POLICY IF EXISTS "user_select"'));
});

test('generates rollback for partitioning operations', () => {
  const generator = new RollbackGenerator();
  
  // Create partition rollback
  const createPartition = { 
    kind: 'create_partition', 
    parentTable: 'events',
    partitionName: 'events_2024_01'
  };
  const createRollback = generator.generateStepRollback(createPartition);
  
  assert.equal(createRollback.kind, 'drop_partition_rollback');
  assert.equal(createRollback.riskLevel, 'high');
  assert.equal(createRollback.dataLoss, true);
  
  // Attach partition rollback
  const attachPartition = { 
    kind: 'attach_partition', 
    parentTable: 'events',
    partitionName: 'events_2024_01'
  };
  const attachRollback = generator.generateStepRollback(attachPartition);
  
  assert.equal(attachRollback.kind, 'detach_partition_rollback');
  assert(attachRollback.sql.includes('DETACH PARTITION'));
  
  // Detach partition rollback
  const detachPartition = { 
    kind: 'detach_partition', 
    parentTable: 'events',
    partitionName: 'events_2024_01',
    partitionBounds: 'FOR VALUES FROM (\'2024-01-01\') TO (\'2024-02-01\')'
  };
  const detachRollback = generator.generateStepRollback(detachPartition);
  
  assert.equal(detachRollback.kind, 'attach_partition_rollback');
  assert(detachRollback.sql.includes('ATTACH PARTITION'));
  assert(detachRollback.sql.includes('FOR VALUES FROM'));
});

test('generates data preservation steps', () => {
  const generator = new RollbackGenerator();
  
  // Table backup
  const dropTableStep = { kind: 'drop_table', table: 'old_users' };
  const tableBackup = generator.generateDataPreservation(dropTableStep);
  
  assert.equal(tableBackup.kind, 'backup_table');
  assert.equal(tableBackup.table, 'old_users');
  assert(tableBackup.backupTable.startsWith('old_users_backup_'));
  assert(tableBackup.sql.includes('CREATE TABLE'));
  assert(tableBackup.sql.includes('AS SELECT * FROM'));
  
  // Column backup
  const dropColumnStep = { kind: 'drop_column', table: 'users', column: 'deprecated_field' };
  const columnBackup = generator.generateDataPreservation(dropColumnStep);
  
  assert.equal(columnBackup.kind, 'backup_column');
  assert.equal(columnBackup.table, 'users');
  assert.equal(columnBackup.column, 'deprecated_field');
  assert(columnBackup.sql.includes('SELECT "deprecated_field" FROM'));
  
  // Type change backup for unsafe conversions
  const unsafeTypeStep = { 
    kind: 'alter_type', 
    table: 'users', 
    column: 'data',
    from: { type: 'String' },
    to: { type: 'Boolean' }
  };
  const typeBackup = generator.generateDataPreservation(unsafeTypeStep);
  
  assert.equal(typeBackup.kind, 'backup_column_values');
  assert(typeBackup.sql.includes('SELECT id, "data" FROM'));
});

test('generates safety checks', () => {
  const generator = new RollbackGenerator();
  
  const forwardSteps = [
    { kind: 'create_table', table: 'users' },
    { kind: 'create_table', table: 'posts' },
    { kind: 'add_column', table: 'orders', column: 'total' }
  ];
  
  const safetyChecks = generator.generateSafetyChecks(forwardSteps);
  
  // Should generate foreign key dependency checks for tables to be dropped
  const fkCheck = safetyChecks.find(c => c.kind === 'foreign_key_dependency_check');
  assert(fkCheck);
  assert(fkCheck.sql.includes('information_schema.table_constraints'));
  assert.equal(fkCheck.failureAction, 'abort_rollback');
  
  // Should generate data existence check
  const dataCheck = safetyChecks.find(c => c.kind === 'data_existence_check');
  assert(dataCheck);
  assert(dataCheck.sql.includes('COUNT(*)'));
  assert.equal(dataCheck.failureAction, 'warn_and_continue');
});

test('calculates rollback risk level correctly', () => {
  const generator = new RollbackGenerator();
  
  // Low risk rollbacks
  const lowRiskSteps = [
    { riskLevel: 'low', dataLoss: false },
    { riskLevel: 'low', dataLoss: false }
  ];
  assert.equal(generator.calculateRollbackRisk(lowRiskSteps), 'low');
  
  // High risk rollbacks with data loss
  const highRiskSteps = [
    { riskLevel: 'high', dataLoss: true },
    { riskLevel: 'high', dataLoss: true }
  ];
  assert.equal(generator.calculateRollbackRisk(highRiskSteps), 'critical');
  
  // Medium risk mixed
  const mediumRiskSteps = [
    { riskLevel: 'medium', dataLoss: false },
    { riskLevel: 'low', dataLoss: true }
  ];
  assert.equal(generator.calculateRollbackRisk(mediumRiskSteps), 'medium');
  
  // Empty rollback
  assert.equal(generator.calculateRollbackRisk([]), 'low');
});

test('maps field types to SQL correctly', () => {
  const generator = new RollbackGenerator();
  
  // Basic types
  assert.equal(generator.mapFieldTypeToSQL({ type: 'ID' }), 'uuid');
  assert.equal(generator.mapFieldTypeToSQL({ type: 'String' }), 'text');
  assert.equal(generator.mapFieldTypeToSQL({ type: 'Int' }), 'integer');
  assert.equal(generator.mapFieldTypeToSQL({ type: 'Float' }), 'double precision');
  assert.equal(generator.mapFieldTypeToSQL({ type: 'Boolean' }), 'boolean');
  assert.equal(generator.mapFieldTypeToSQL({ type: 'DateTime' }), 'timestamptz');
  
  // Array types
  assert.equal(generator.mapFieldTypeToSQL({ type: 'String', list: true }), 'text[]');
  assert.equal(generator.mapFieldTypeToSQL({ type: 'Int', list: true }), 'integer[]');
  
  // Unknown types default to text
  assert.equal(generator.mapFieldTypeToSQL({ type: 'CustomType' }), 'text');
});

test('generates CREATE INDEX SQL for rollback correctly', () => {
  const generator = new RollbackGenerator();
  
  // Simple index
  const simpleStep = { 
    indexName: 'idx_users_email', 
    table: 'users',
    columns: ['email'],
    unique: false
  };
  const simpleSQL = generator.generateCreateIndexSQL(simpleStep);
  
  assert(simpleSQL.includes('CREATE INDEX IF NOT EXISTS "idx_users_email"'));
  assert(simpleSQL.includes('ON "users" ("email")'));
  assert(!simpleSQL.includes('UNIQUE'));
  
  // Unique index
  const uniqueStep = { 
    indexName: 'idx_users_email_unique', 
    table: 'users',
    columns: ['email'],
    unique: true
  };
  const uniqueSQL = generator.generateCreateIndexSQL(uniqueStep);
  
  assert(uniqueSQL.includes('CREATE UNIQUE INDEX'));
  
  // Partial index
  const partialStep = { 
    indexName: 'idx_active_users', 
    table: 'users',
    columns: ['email'],
    whereClause: 'active = true'
  };
  const partialSQL = generator.generateCreateIndexSQL(partialStep);
  
  assert(partialSQL.includes('WHERE active = true'));
  
  // Multi-column index
  const multiStep = { 
    indexName: 'idx_user_post', 
    table: 'posts',
    columns: ['user_id', 'created_at']
  };
  const multiSQL = generator.generateCreateIndexSQL(multiStep);
  
  assert(multiSQL.includes('"user_id", "created_at"'));
});

test('generates type conversion USING clauses', () => {
  const generator = new RollbackGenerator();
  
  // ID to String
  const idToString = generator.generateTypeConversionUsing(
    { type: 'ID', name: 'user_id' },
    { type: 'String', name: 'user_id' }
  );
  assert.equal(idToString, '"user_id"::text');
  
  // String to ID
  const stringToId = generator.generateTypeConversionUsing(
    { type: 'String', name: 'uuid_field' },
    { type: 'ID', name: 'uuid_field' }
  );
  assert.equal(stringToId, '"uuid_field"::uuid');
  
  // Int to String
  const intToString = generator.generateTypeConversionUsing(
    { type: 'Int', name: 'count' },
    { type: 'String', name: 'count' }
  );
  assert.equal(intToString, '"count"::text');
  
  // No conversion needed
  const noConversion = generator.generateTypeConversionUsing(
    { type: 'String', name: 'text_field' },
    { type: 'String', name: 'text_field' }
  );
  assert.equal(noConversion, null);
});

test('generates complete rollback for full migration', () => {
  const generator = new RollbackGenerator();
  
  const forwardSteps = [
    { kind: 'create_table', table: 'audit_log' },
    { 
      kind: 'add_column', 
      table: 'users', 
      column: 'last_login',
      field: new Field({ name: 'last_login', type: 'DateTime', nonNull: false })
    },
    { 
      kind: 'create_index', 
      table: 'users', 
      column: 'email',
      indexName: 'idx_users_email'
    },
    {
      kind: 'add_constraint',
      table: 'posts',
      constraintName: 'fk_author',
      constraintType: 'foreign_key'
    }
  ];
  
  const rollbackResult = generator.generateRollback(forwardSteps);
  
  // Should have rollback steps in reverse order
  assert.equal(rollbackResult.rollbackSteps.length, 4);
  assert.equal(rollbackResult.rollbackSteps[0].kind, 'drop_constraint_rollback'); // Last forward step first
  assert.equal(rollbackResult.rollbackSteps[3].kind, 'drop_table_rollback'); // First forward step last
  
  // Should detect data loss
  const dataLossSteps = rollbackResult.rollbackSteps.filter(s => s.dataLoss);
  assert(dataLossSteps.length > 0);
  
  // Should generate safety checks
  assert(rollbackResult.safetyChecks.length > 0);
  
  // Should calculate risk level
  assert(['low', 'medium', 'high', 'critical'].includes(rollbackResult.riskLevel));
  
  // Should not require manual intervention for simple operations
  assert.equal(rollbackResult.requiresManualIntervention, false);
});

test('handles problematic operations with warnings', () => {
  const generator = new RollbackGenerator();
  
  const problematicSteps = [
    { kind: 'drop_table', table: 'important_data' },
    { kind: 'drop_column', table: 'users', column: 'sensitive_info' },
    { 
      kind: 'alter_type',
      table: 'metrics', 
      column: 'value',
      from: { type: 'Float' },
      to: { type: 'Int' } // Unsafe conversion
    }
  ];
  
  const rollbackResult = generator.generateRollback(problematicSteps);
  
  // Should generate warnings for unsafe operations
  assert(rollbackResult.warnings.length > 0);
  
  // Should require manual intervention
  assert.equal(rollbackResult.requiresManualIntervention, true);
  
  // Warnings should have error severity
  const errorWarnings = rollbackResult.warnings.filter(w => w.severity === 'error');
  assert(errorWarnings.length > 0);
  
  // Should still calculate risk as critical
  assert.equal(rollbackResult.riskLevel, 'critical');
});

test('generates complete rollback script', () => {
  const generator = new RollbackGenerator();
  
  const rollbackResult = {
    rollbackSteps: [
      {
        kind: 'drop_index_rollback',
        sql: 'DROP INDEX IF EXISTS "idx_test";',
        description: 'Drop test index',
        riskLevel: 'low'
      }
    ],
    dataPreservationSteps: [
      {
        kind: 'backup_table',
        sql: 'CREATE TABLE "users_backup" AS SELECT * FROM "users";',
        description: 'Backup users table'
      }
    ],
    safetyChecks: [
      {
        kind: 'foreign_key_dependency_check',
        sql: 'SELECT * FROM information_schema.table_constraints WHERE constraint_type = \'FOREIGN KEY\';',
        description: 'Check foreign key dependencies'
      }
    ],
    warnings: [
      { 
        severity: 'warning',
        warning: 'This operation may cause data loss'
      }
    ],
    riskLevel: 'medium'
  };
  
  const script = generator.generateRollbackScript(rollbackResult);
  
  // Should have header
  assert(script.includes('-- ROLLBACK SCRIPT'));
  assert(script.includes('-- Risk Level: MEDIUM'));
  
  // Should include safety checks
  assert(script.includes('-- SAFETY CHECKS'));
  assert(script.includes('information_schema.table_constraints'));
  
  // Should include data preservation
  assert(script.includes('-- DATA PRESERVATION STEPS'));
  assert(script.includes('CREATE TABLE "users_backup"'));
  
  // Should include rollback steps in transaction
  assert(script.includes('-- ROLLBACK STEPS'));
  assert(script.includes('BEGIN;'));
  assert(script.includes('DROP INDEX IF EXISTS "idx_test"'));
  assert(script.includes('COMMIT;'));
  
  // Should include warnings
  assert(script.includes('-- WARNINGS'));
  assert(script.includes('This operation may cause data loss'));
});

test('requires data preservation correctly', () => {
  const generator = new RollbackGenerator();
  
  // Operations that require data preservation
  assert.equal(generator.requiresDataPreservation({ kind: 'drop_table' }), true);
  assert.equal(generator.requiresDataPreservation({ kind: 'drop_column' }), true);
  assert.equal(generator.requiresDataPreservation({ kind: 'alter_type' }), true);
  assert.equal(generator.requiresDataPreservation({ kind: 'drop_constraint' }), true);
  
  // Operations that don't require data preservation
  assert.equal(generator.requiresDataPreservation({ kind: 'create_table' }), false);
  assert.equal(generator.requiresDataPreservation({ kind: 'add_column' }), false);
  assert.equal(generator.requiresDataPreservation({ kind: 'create_index' }), false);
  assert.equal(generator.requiresDataPreservation({ kind: 'add_constraint' }), false);
});

test('throws error for unknown operations', () => {
  const generator = new RollbackGenerator();
  
  const unknownStep = { kind: 'unknown_operation', table: 'test' };
  
  assert.throws(() => {
    generator.generateStepRollback(unknownStep);
  }, /Unknown operation type/);
});

test('empty forward steps return empty rollback', () => {
  const generator = new RollbackGenerator();
  
  const rollbackResult = generator.generateRollback([]);
  
  assert.equal(rollbackResult.rollbackSteps.length, 0);
  assert.equal(rollbackResult.dataPreservationSteps.length, 0);
  assert.equal(rollbackResult.warnings.length, 0);
  assert.equal(rollbackResult.requiresManualIntervention, false);
  assert.equal(rollbackResult.riskLevel, 'low');
});