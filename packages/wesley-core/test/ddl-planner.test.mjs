/**
 * DDL Planner Tests
 * Tests for PostgreSQL lock level classification and migration planning
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { DDLPlanner } from '../src/domain/planner/DDLPlanner.mjs';
import { Field } from '../src/domain/Schema.mjs';

test('DDLPlanner initializes with correct lock levels', () => {
  const planner = new DDLPlanner();
  
  assert.equal(planner.LOCK_LEVELS.ACCESS_SHARE, 1);
  assert.equal(planner.LOCK_LEVELS.ACCESS_EXCLUSIVE, 8);
  assert(planner.NON_TRANSACTIONAL_OPS.has('create_index_concurrently'));
});

test('annotates CREATE TABLE with EXCLUSIVE lock', () => {
  const planner = new DDLPlanner();
  
  const step = { kind: 'create_table', table: 'users' };
  const annotated = planner.annotateStep(step);
  
  assert.equal(annotated.lockLevel, planner.LOCK_LEVELS.EXCLUSIVE);
  assert.equal(annotated.lockLevelName, 'EXCLUSIVE');
  assert.equal(annotated.estimatedDuration, 'instant');
  assert.equal(annotated.canRunConcurrently, true);
  assert(annotated.lockDescription.includes('blocks concurrent reads/writes'));
});

test('annotates DROP TABLE with ACCESS_EXCLUSIVE lock', () => {
  const planner = new DDLPlanner();
  
  const step = { kind: 'drop_table', table: 'old_table' };
  const annotated = planner.annotateStep(step);
  
  assert.equal(annotated.lockLevel, planner.LOCK_LEVELS.ACCESS_EXCLUSIVE);
  assert.equal(annotated.lockLevelName, 'ACCESS_EXCLUSIVE');
  assert.equal(annotated.dataPreservation, true);
  assert(annotated.lockDescription.includes('blocks all concurrent access'));
});

test('annotates ADD COLUMN based on constraints', () => {
  const planner = new DDLPlanner();
  
  // Nullable column (fast)
  const nullableField = new Field({ name: 'optional', type: 'String', nonNull: false });
  const nullableStep = { kind: 'add_column', table: 'users', column: 'optional', field: nullableField };
  const nullableAnnotated = planner.annotateStep(nullableStep);
  
  assert.equal(nullableAnnotated.lockLevel, planner.LOCK_LEVELS.EXCLUSIVE);
  assert.equal(nullableAnnotated.estimatedDuration, 'instant');
  
  // NOT NULL with default (requires table rewrite)
  const notNullField = new Field({ 
    name: 'required', 
    type: 'String', 
    nonNull: true,
    directives: { '@default': { value: 'default_value' } }
  });
  const notNullStep = { kind: 'add_column', table: 'users', column: 'required', field: notNullField };
  const notNullAnnotated = planner.annotateStep(notNullStep);
  
  assert.equal(notNullAnnotated.lockLevel, planner.LOCK_LEVELS.ACCESS_EXCLUSIVE);
  assert.equal(notNullAnnotated.estimatedDuration, 'table-rewrite');
});

test('annotates ALTER TYPE based on compatibility', () => {
  const planner = new DDLPlanner();
  
  // Compatible change (varchar to text)
  const compatibleStep = {
    kind: 'alter_type',
    table: 'users',
    column: 'name',
    from: { type: 'String' },
    to: { type: 'String' } // varchar to text in practice
  };
  const compatibleAnnotated = planner.annotateStep(compatibleStep);
  
  assert.equal(compatibleAnnotated.lockLevel, planner.LOCK_LEVELS.EXCLUSIVE);
  assert.equal(compatibleAnnotated.estimatedDuration, 'instant');
  
  // Incompatible change
  const incompatibleStep = {
    kind: 'alter_type',
    table: 'users', 
    column: 'age',
    from: { type: 'String' },
    to: { type: 'Int' }
  };
  const incompatibleAnnotated = planner.annotateStep(incompatibleStep);
  
  assert.equal(incompatibleAnnotated.lockLevel, planner.LOCK_LEVELS.ACCESS_EXCLUSIVE);
  assert.equal(incompatibleAnnotated.estimatedDuration, 'table-rewrite');
});

test('annotates CREATE INDEX vs CREATE INDEX CONCURRENTLY', () => {
  const planner = new DDLPlanner();
  
  // Regular index
  const regularIndex = { kind: 'create_index', table: 'users', column: 'email' };
  const regularAnnotated = planner.annotateStep(regularIndex);
  
  assert.equal(regularAnnotated.lockLevel, planner.LOCK_LEVELS.SHARE);
  assert.equal(regularAnnotated.nonTransactional, false);
  
  // Concurrent index
  const concurrentIndex = { kind: 'create_index_concurrently', table: 'users', column: 'email' };
  const concurrentAnnotated = planner.annotateStep(concurrentIndex);
  
  assert.equal(concurrentAnnotated.lockLevel, planner.LOCK_LEVELS.SHARE_UPDATE_EXCLUSIVE);
  assert.equal(concurrentAnnotated.nonTransactional, true);
  assert.equal(concurrentAnnotated.phase, 'post');
});

test('annotates partitioning operations correctly', () => {
  const planner = new DDLPlanner();
  
  // Create partition
  const createPartition = { kind: 'create_partition', table: 'events', parentTable: 'events' };
  const createAnnotated = planner.annotateStep(createPartition);
  
  assert.equal(createAnnotated.lockLevel, planner.LOCK_LEVELS.EXCLUSIVE);
  
  // Attach partition
  const attachPartition = { kind: 'attach_partition', parentTable: 'events', partitionName: 'events_2024' };
  const attachAnnotated = planner.annotateStep(attachPartition);
  
  assert.equal(attachAnnotated.lockLevel, planner.LOCK_LEVELS.SHARE_UPDATE_EXCLUSIVE);
  assert.equal(attachAnnotated.estimatedDuration, 'table-scan');
  
  // Detach partition
  const detachPartition = { kind: 'detach_partition', parentTable: 'events', partitionName: 'events_2023' };
  const detachAnnotated = planner.annotateStep(detachPartition);
  
  assert.equal(detachAnnotated.lockLevel, planner.LOCK_LEVELS.ACCESS_EXCLUSIVE);
  assert.equal(detachAnnotated.dataPreservation, true);
});

test('sorts steps by lock level correctly', () => {
  const planner = new DDLPlanner();
  
  const steps = [
    { lockLevel: 8, dataPreservation: false, estimatedDuration: 'instant' },
    { lockLevel: 3, dataPreservation: true, estimatedDuration: 'table-scan' },
    { lockLevel: 5, dataPreservation: false, estimatedDuration: 'instant' },
    { lockLevel: 3, dataPreservation: false, estimatedDuration: 'instant' }
  ];
  
  const sorted = planner.sortByLockLevel(steps);
  
  // Should be sorted by lock level (ascending)
  assert.equal(sorted[0].lockLevel, 3);
  assert.equal(sorted[1].lockLevel, 3); 
  assert.equal(sorted[2].lockLevel, 5);
  assert.equal(sorted[3].lockLevel, 8);
  
  // Within same lock level, non-data-preserving operations should come first
  assert.equal(sorted[0].dataPreservation, false);
  assert.equal(sorted[1].dataPreservation, true);
});

test('detects lock conflicts correctly', () => {
  const planner = new DDLPlanner();
  
  const steps = [
    { table: 'users', lockLevel: 7, kind: 'add_column' }, // HIGH LOCK
    { table: 'users', lockLevel: 3, kind: 'create_policy' }, // LOW LOCK
    { table: 'posts', lockLevel: 8, estimatedDuration: 'table-rewrite' },
    { table: 'posts', lockLevel: 8, estimatedDuration: 'table-rewrite' }
  ];
  
  const conflicts = planner.detectLockConflicts(steps);
  
  // Should detect lock escalation conflict on users table
  const lockEscalationConflict = conflicts.find(c => c.type === 'lock_escalation');
  assert(lockEscalationConflict);
  assert.equal(lockEscalationConflict.table, 'users');
  assert.equal(lockEscalationConflict.highLockOperations, 1);
  
  // Should detect multiple rewrites on posts table
  const multipleRewriteConflict = conflicts.find(c => c.type === 'multiple_rewrites');
  assert(multipleRewriteConflict);
  assert.equal(multipleRewriteConflict.table, 'posts');
  assert.equal(multipleRewriteConflict.operations.length, 2);
});

test('calculates risk level accurately', () => {
  const planner = new DDLPlanner();
  
  // Low risk: simple operations
  const lowRiskSteps = [
    { lockLevel: 3, estimatedDuration: 'instant', dataPreservation: false },
    { lockLevel: 3, estimatedDuration: 'instant', dataPreservation: false }
  ];
  assert.equal(planner.calculateRiskLevel(lowRiskSteps), 'low');
  
  // High risk: table rewrites and data preservation
  const highRiskSteps = [
    { lockLevel: 8, estimatedDuration: 'table-rewrite', dataPreservation: true },
    { lockLevel: 8, estimatedDuration: 'table-rewrite', dataPreservation: true }
  ];
  assert.equal(planner.calculateRiskLevel(highRiskSteps), 'critical');
  
  // Medium risk: mixed operations
  const mediumRiskSteps = [
    { lockLevel: 5, estimatedDuration: 'table-scan', dataPreservation: false },
    { lockLevel: 7, estimatedDuration: 'instant', dataPreservation: false }
  ];
  assert.equal(planner.calculateRiskLevel(mediumRiskSteps), 'medium');
});

test('plans migration with phases correctly', () => {
  const planner = new DDLPlanner();
  
  const migrationSteps = [
    { kind: 'create_table', table: 'users' },
    { kind: 'create_index_concurrently', table: 'users', column: 'email' },
    { kind: 'add_column', table: 'users', column: 'age', field: new Field({ name: 'age', type: 'Int', nonNull: false }) },
    { kind: 'drop_table', table: 'old_table' }
  ];
  
  const plan = planner.planMigration(migrationSteps);
  
  // Should have correct phases
  assert(plan.phases.transactional.length > 0);
  assert(plan.phases.postTransactional.length > 0);
  
  // Concurrent index should be in post-transactional phase
  const concurrentOps = plan.phases.postTransactional.filter(op => 
    op.kind === 'create_index_concurrently'
  );
  assert.equal(concurrentOps.length, 1);
  
  // Transactional operations should be sorted by lock level
  const transactionalLocks = plan.phases.transactional.map(op => op.lockLevel);
  for (let i = 1; i < transactionalLocks.length; i++) {
    assert(transactionalLocks[i] >= transactionalLocks[i-1]);
  }
  
  // Should calculate overall risk
  assert(['low', 'medium', 'high', 'critical'].includes(plan.riskLevel));
  assert.equal(plan.totalSteps, 4);
});

test('handles unknown operations safely', () => {
  const planner = new DDLPlanner();
  
  const unknownStep = { kind: 'unknown_operation', table: 'test' };
  const annotated = planner.annotateStep(unknownStep);
  
  // Should default to highest lock level for safety
  assert.equal(annotated.lockLevel, planner.LOCK_LEVELS.ACCESS_EXCLUSIVE);
  assert.equal(annotated.lockLevelName, 'ACCESS_EXCLUSIVE');
  assert(annotated.lockDescription.includes('Unknown operation'));
  assert.equal(annotated.estimatedDuration, 'unknown');
});

test('generates recommendations correctly', () => {
  const planner = new DDLPlanner();
  
  const highRiskPlan = {
    riskLevel: 'critical',
    phases: {
      transactional: [
        { kind: 'create_index', table: 'users' },
        { kind: 'drop_column', table: 'users', dataPreservation: true, estimatedDuration: 'table-rewrite' }
      ],
      postTransactional: []
    }
  };
  
  const recommendations = planner.generateRecommendations(highRiskPlan);
  
  // Should recommend maintenance window for critical risk
  const maintenanceRec = recommendations.find(r => r.type === 'maintenance_window');
  assert(maintenanceRec);
  assert.equal(maintenanceRec.priority, 'high');
  
  // Should recommend concurrent indexes
  const concurrentRec = recommendations.find(r => r.type === 'concurrent_indexes');
  assert(concurrentRec);
  
  // Should warn about data backup
  const backupRec = recommendations.find(r => r.type === 'data_backup');
  assert(backupRec);
  assert.equal(backupRec.priority, 'critical');
  
  // Should recommend batching for table rewrites
  const batchingRec = recommendations.find(r => r.type === 'batching');
  assert(batchingRec);
});

test('normalizes database types correctly', () => {
  const planner = new DDLPlanner();
  
  assert.equal(planner.normalizeType('ID'), 'uuid');
  assert.equal(planner.normalizeType('String'), 'text');
  assert.equal(planner.normalizeType('Int'), 'int4');
  assert.equal(planner.normalizeType('Float'), 'float8');
  assert.equal(planner.normalizeType('Boolean'), 'bool');
  assert.equal(planner.normalizeType('DateTime'), 'timestamptz');
  assert.equal(planner.normalizeType('custom_type'), 'custom_type');
});

test('handles constraint-specific lock levels', () => {
  const planner = new DDLPlanner();
  
  // CHECK constraint
  const checkConstraint = { kind: 'add_constraint', constraintType: 'check', table: 'users' };
  const checkAnnotated = planner.annotateStep(checkConstraint);
  
  assert.equal(checkAnnotated.lockLevel, planner.LOCK_LEVELS.SHARE_ROW_EXCLUSIVE);
  assert.equal(checkAnnotated.estimatedDuration, 'table-scan');
  
  // Foreign key constraint
  const fkConstraint = { kind: 'add_constraint', constraintType: 'foreign_key', table: 'posts' };
  const fkAnnotated = planner.annotateStep(fkConstraint);
  
  assert.equal(fkAnnotated.lockLevel, planner.LOCK_LEVELS.SHARE_ROW_EXCLUSIVE);
  assert.equal(fkAnnotated.estimatedDuration, 'table-scan');
  
  // Unique constraint
  const uniqueConstraint = { kind: 'add_constraint', constraintType: 'unique', table: 'users' };
  const uniqueAnnotated = planner.annotateStep(uniqueConstraint);
  
  assert.equal(uniqueAnnotated.lockLevel, planner.LOCK_LEVELS.SHARE);
  assert.equal(uniqueAnnotated.estimatedDuration, 'table-scan');
});

test('handles RLS operations correctly', () => {
  const planner = new DDLPlanner();
  
  // Enable RLS
  const enableRLS = { kind: 'enable_rls', table: 'users' };
  const rlsAnnotated = planner.annotateStep(enableRLS);
  
  assert.equal(rlsAnnotated.lockLevel, planner.LOCK_LEVELS.EXCLUSIVE);
  assert.equal(rlsAnnotated.estimatedDuration, 'instant');
  
  // Create policy
  const createPolicy = { kind: 'create_policy', table: 'users', policyName: 'user_policy' };
  const policyAnnotated = planner.annotateStep(createPolicy);
  
  assert.equal(policyAnnotated.lockLevel, planner.LOCK_LEVELS.ROW_EXCLUSIVE);
  assert.equal(policyAnnotated.estimatedDuration, 'instant');
});

test('empty migration returns empty plan', () => {
  const planner = new DDLPlanner();
  
  const plan = planner.planMigration([]);
  
  assert.equal(plan.phases.transactional.length, 0);
  assert.equal(plan.phases.postTransactional.length, 0);
  assert.equal(plan.phases.preTransactional.length, 0);
  assert.equal(plan.lockConflicts.length, 0);
  assert.equal(plan.totalSteps, 0);
  assert.equal(plan.riskLevel, 'low');
});

test('complex migration scenario', () => {
  const planner = new DDLPlanner();
  
  const complexSteps = [
    // Table operations
    { kind: 'create_table', table: 'audit_log' },
    { kind: 'drop_table', table: 'deprecated_table' },
    
    // Column operations on same table (should conflict)
    { kind: 'add_column', table: 'users', column: 'created_at', field: new Field({ name: 'created_at', type: 'DateTime', nonNull: false }) },
    { kind: 'drop_column', table: 'users', column: 'old_field' },
    
    // Index operations
    { kind: 'create_index', table: 'posts', column: 'title' },
    { kind: 'create_index_concurrently', table: 'users', column: 'email' },
    
    // Type changes requiring rewrites
    { kind: 'alter_type', table: 'products', column: 'price', from: { type: 'String' }, to: { type: 'Float' } },
    
    // RLS setup
    { kind: 'enable_rls', table: 'users' },
    { kind: 'create_policy', table: 'users', policyName: 'user_select_policy' },
    
    // Constraints
    { kind: 'add_constraint', table: 'orders', constraintType: 'foreign_key', constraintName: 'fk_user' }
  ];
  
  const plan = planner.planMigration(complexSteps);
  
  // Verify phases are populated
  assert(plan.phases.transactional.length > 0);
  assert(plan.phases.postTransactional.length > 0);
  
  // Concurrent operations should be in post-transactional
  const concurrentInPost = plan.phases.postTransactional.some(op => 
    op.kind === 'create_index_concurrently'
  );
  assert(concurrentInPost);
  
  // Should detect conflicts on users table
  const userConflicts = plan.lockConflicts.filter(c => c.table === 'users');
  assert(userConflicts.length > 0);
  
  // Risk should be high due to drop operations and rewrites
  assert(['high', 'critical'].includes(plan.riskLevel));
  
  // Should generate multiple recommendations
  const recommendations = planner.generateRecommendations(plan);
  assert(recommendations.length > 0);
  
  // Verify lock level ordering in transactional phase
  const transactionalLevels = plan.phases.transactional.map(op => op.lockLevel);
  for (let i = 1; i < transactionalLevels.length; i++) {
    assert(transactionalLevels[i] >= transactionalLevels[i-1], 
      `Lock levels should be in ascending order: ${transactionalLevels[i-1]} <= ${transactionalLevels[i]}`);
  }
});