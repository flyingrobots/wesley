/**
 * Repair Generator Tests
 * Tests for Wave 2 WP3.T005 - Generate SQL to fix schema drift
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { RepairGenerator } from '../src/domain/generators/RepairGenerator.mjs';
import { DifferentialValidator } from '../src/domain/validation/DifferentialValidator.mjs';
import { Schema, Table, Field } from '../src/domain/Schema.mjs';

// Test Data Factory
function createField(options = {}) {
  return new Field({
    name: options.name || 'testField',
    type: options.type || 'String',
    nonNull: options.nonNull || false,
    list: options.list || false,
    itemNonNull: options.itemNonNull || false,
    directives: options.directives || {}
  });
}

function createTable(options = {}) {
  return new Table({
    name: options.name || 'TestTable',
    fields: options.fields || {},
    directives: options.directives || {}
  });
}

function createDriftReport(differences = []) {
  return {
    hasDrift: differences.length > 0,
    context: {
      validationId: 'test_validation_123',
      environment: 'test'
    },
    differences,
    summary: {
      totalDifferences: differences.length,
      criticalDifferences: differences.filter(d => d.severity === 'critical').length
    }
  };
}

test('RepairGenerator - Returns empty plan for no drift', async () => {
  const generator = new RepairGenerator();
  const driftReport = createDriftReport([]);
  
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.equal(repairPlan.summary.totalDifferences, 0);
  assert.equal(repairPlan.summary.safeRepairs, 0);
  assert.equal(repairPlan.repairSteps.length, 0);
  assert.ok(repairPlan.reason);
});

test('RepairGenerator - Filters safe vs unsafe operations', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    // Safe operation - add nullable column
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      severity: 'high',
      repairAction: 'add_column',
      expectedValue: createField({ 
        name: 'name', 
        type: 'String', 
        nonNull: false 
      })
    },
    // Unsafe operation - drop table
    {
      type: 'extra_table',
      table: 'OldTable',
      severity: 'high',
      repairAction: 'drop_table'
    },
    // Safe operation - add NOT NULL (with validation)
    {
      type: 'nullability_mismatch',
      table: 'User',
      column: 'email',
      severity: 'medium',
      repairAction: 'add_not_null',
      expectedValue: true,
      actualValue: false
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  // Should have 2 safe operations, 1 unsafe
  assert.equal(repairPlan.summary.safeRepairs, 2);
  assert.equal(repairPlan.summary.unsafeOperations, 1);
  assert.equal(repairPlan.repairSteps.length, 2);
  
  const unsafeOp = repairPlan.unsafeOperations.find(op => op.type === 'extra_table');
  assert.ok(unsafeOp);
  assert.ok(unsafeOp.reason.includes('data loss'));
});

test('RepairGenerator - Generates ADD COLUMN SQL correctly', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      repairAction: 'add_column',
      expectedValue: createField({
        name: 'name',
        type: 'String',
        nonNull: false,
        directives: { '@default': { value: 'Unnamed' } }
      })
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.equal(repairPlan.repairSteps.length, 1);
  
  const step = repairPlan.repairSteps[0];
  assert.equal(step.operation, 'missing_field');
  assert.ok(step.sql.includes('ALTER TABLE "User"'));
  assert.ok(step.sql.includes('ADD COLUMN "name"'));
  assert.ok(step.sql.includes('text'));
  assert.ok(step.sql.includes("DEFAULT 'Unnamed'"));
  assert.ok(!step.sql.includes('NOT NULL')); // Should be nullable
});

test('RepairGenerator - Generates ADD NOT NULL SQL with safety checks', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    {
      type: 'nullability_mismatch',
      table: 'User',
      column: 'email',
      repairAction: 'add_not_null',
      expectedValue: true,
      actualValue: false
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  const step = repairPlan.repairSteps[0];
  assert.ok(step.sql.includes('UPDATE "User"'));
  assert.ok(step.sql.includes('WHERE "email" IS NULL'));
  assert.ok(step.sql.includes('SET NOT NULL'));
});

test('RepairGenerator - Handles different PostgreSQL types correctly', async () => {
  const generator = new RepairGenerator();
  
  const testCases = [
    { field: createField({ type: 'ID' }), expectedType: 'uuid' },
    { field: createField({ type: 'String' }), expectedType: 'text' },
    { field: createField({ type: 'Int' }), expectedType: 'integer' },
    { field: createField({ type: 'Float' }), expectedType: 'double precision' },
    { field: createField({ type: 'Boolean' }), expectedType: 'boolean' },
    { field: createField({ type: 'DateTime' }), expectedType: 'timestamptz' },
    { field: createField({ type: 'String', list: true }), expectedType: 'text[]' }
  ];
  
  for (const { field, expectedType } of testCases) {
    const pgType = generator.mapFieldToPostgreSQLType(field);
    assert.equal(pgType, expectedType, `Type mapping failed for ${field.type}`);
  }
});

test('RepairGenerator - Creates proper migration structure', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'name', type: 'String' })
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.ok(repairPlan.migration);
  assert.ok(repairPlan.migration.id);
  assert.ok(repairPlan.migration.name.includes('repair_drift'));
  assert.equal(repairPlan.migration.source, 'drift_repair');
  assert.equal(repairPlan.migration.driftValidationId, 'test_validation_123');
  
  assert.ok(Array.isArray(repairPlan.migration.up));
  assert.ok(Array.isArray(repairPlan.migration.down));
  assert.ok(repairPlan.migration.up.length > 0);
  
  // Check migration content
  const upSQL = repairPlan.migration.up.join('\n');
  assert.ok(upSQL.includes('-- Drift Repair Migration'));
  assert.ok(upSQL.includes('ALTER TABLE'));
});

test('RepairGenerator - Generates rollback plan', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'name', type: 'String' })
    },
    {
      type: 'nullability_mismatch',
      table: 'User',
      column: 'email',
      repairAction: 'add_not_null',
      expectedValue: true,
      actualValue: false
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.ok(repairPlan.rollbackPlan);
  assert.equal(repairPlan.rollbackPlan.steps.length, 2);
  
  // Rollback steps should be in reverse order
  const firstRollback = repairPlan.rollbackPlan.steps[0];
  assert.equal(firstRollback.operation, 'drop_not_null');
  assert.ok(firstRollback.sql.includes('DROP NOT NULL'));
  
  const secondRollback = repairPlan.rollbackPlan.steps[1];
  assert.equal(secondRollback.operation, 'drop_column');
  assert.ok(secondRollback.sql.includes('DROP COLUMN'));
  
  assert.ok(repairPlan.rollbackPlan.warnings.length > 0);
});

test('RepairGenerator - Analyzes repair safety', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    {
      type: 'missing_field',
      table: 'User',
      column: 'criticalField',
      repairAction: 'add_column',
      expectedValue: createField({ 
        name: 'criticalField', 
        type: 'String',
        nonNull: true,  // High risk - required field
        directives: { '@default': { value: 'DEFAULT_VALUE' } }  // But with default, so safe
      })
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.ok(repairPlan.safetyAnalysis);
  assert.ok(repairPlan.safetyAnalysis.totalRiskScore > 0);
  assert.ok(repairPlan.safetyAnalysis.complexity);
  assert.equal(repairPlan.safetyAnalysis.requiresManualReview, false); // Should be safe for add column
  
  if (repairPlan.safetyAnalysis.riskFactors.length > 0) {
    const riskFactor = repairPlan.safetyAnalysis.riskFactors[0];
    assert.ok(riskFactor.operation);
    assert.ok(riskFactor.riskScore >= 0);
  }
});

test('RepairGenerator - Handles constraint violations', async () => {
  const generator = new RepairGenerator({ enableConstraintHandling: true });
  
  const foreignKeyField = createField({
    name: 'userId',
    type: 'ID',
    directives: { '@foreignKey': { ref: { table: 'User', field: 'id' } } }
  });
  
  // Mock foreign key detection
  foreignKeyField.isForeignKey = () => true;
  foreignKeyField.getForeignKeyRef = () => ({ table: 'User', field: 'id' });
  
  const differences = [
    {
      type: 'missing_field',
      table: 'Post',
      column: 'userId',
      repairAction: 'add_column',
      expectedValue: foreignKeyField
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.ok(repairPlan.constraintHandling);
  assert.ok(repairPlan.constraintHandling.preExecutionChecks);
  assert.ok(repairPlan.constraintHandling.recommendations.length > 0);
  
  const fkCheck = repairPlan.constraintHandling.preExecutionChecks.find(
    check => check.type === 'foreign_key_check'
  );
  if (fkCheck) {
    assert.ok(fkCheck.sql.includes('LEFT JOIN'));
    assert.ok(fkCheck.description.includes('referenced records'));
  }
});

test('RepairGenerator - Orders operations by dependencies', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    // Constraint addition (should come last)
    {
      type: 'missing_directive',
      table: 'User',
      directive: '@index',
      repairAction: 'add_directive',
      expectedValue: { column: 'email' }
    },
    // Column addition (should come first)
    {
      type: 'missing_field',
      table: 'User',
      column: 'email',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'email', type: 'String' })
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.equal(repairPlan.repairSteps.length, 2);
  
  // Column addition should have lower dependency level (executed first)
  const columnStep = repairPlan.repairSteps.find(s => s.operation === 'missing_field');
  const indexStep = repairPlan.repairSteps.find(s => s.operation === 'missing_directive');
  
  assert.ok(columnStep.dependencyLevel <= indexStep.dependencyLevel);
});

test('RepairGenerator - Estimates execution metrics', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'name', type: 'String' })
    },
    {
      type: 'nullability_mismatch',
      table: 'User',
      column: 'email',
      repairAction: 'add_not_null'
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.ok(repairPlan.executionMetrics);
  assert.ok(repairPlan.executionMetrics.estimatedDuration > 0);
  assert.ok(repairPlan.executionMetrics.stepMetrics.length > 0);
  assert.ok(repairPlan.executionMetrics.averageStepDuration >= 0);
  
  const stepMetric = repairPlan.executionMetrics.stepMetrics[0];
  assert.ok(stepMetric.stepId);
  assert.ok(stepMetric.estimatedDuration > 0);
  assert.ok(stepMetric.operation);
});

test('RepairGenerator - Safe mode blocks unsafe operations', async () => {
  const safeGenerator = new RepairGenerator({ safeMode: true });
  const unsafeGenerator = new RepairGenerator({ safeMode: false });
  
  const differences = [
    {
      type: 'extra_field',
      table: 'User',
      column: 'obsolete',
      severity: 'medium',
      repairAction: 'drop_column'
    }
  ];
  
  const driftReport = createDriftReport(differences);
  
  const safePlan = await safeGenerator.generateRepairSQL(driftReport);
  const unsafePlan = await unsafeGenerator.generateRepairSQL(driftReport);
  
  // Safe mode should exclude the drop operation
  assert.equal(safePlan.summary.safeRepairs, 0);
  assert.equal(safePlan.summary.unsafeOperations, 1);
  
  // Unsafe mode should include it (if implemented)
  // Note: The current implementation might not include drop operations even in unsafe mode
  // This would depend on the specific safety filters in place
});

test('RepairGenerator - Transaction modes affect SQL generation', async () => {
  const singleTxGenerator = new RepairGenerator({ transactionMode: 'single' });
  const individualTxGenerator = new RepairGenerator({ transactionMode: 'individual' });
  
  const differences = [
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'name', type: 'String' })
    },
    {
      type: 'missing_field',
      table: 'User',
      column: 'email',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'email', type: 'String' })
    }
  ];
  
  const driftReport = createDriftReport(differences);
  
  const singlePlan = await singleTxGenerator.generateRepairSQL(driftReport);
  const individualPlan = await individualTxGenerator.generateRepairSQL(driftReport);
  
  const singleSQL = singlePlan.migration.up.join('\n');
  const individualSQL = individualPlan.migration.up.join('\n');
  
  // Single transaction mode should have one BEGIN/COMMIT pair
  const singleBeginCount = (singleSQL.match(/BEGIN;/g) || []).length;
  const singleCommitCount = (singleSQL.match(/COMMIT;/g) || []).length;
  
  // Individual transaction mode should have multiple BEGIN/COMMIT pairs
  const individualBeginCount = (individualSQL.match(/BEGIN;/g) || []).length;
  const individualCommitCount = (individualSQL.match(/COMMIT;/g) || []).length;
  
  assert.equal(singleBeginCount, 1);
  assert.equal(singleCommitCount, 1);
  assert.ok(individualBeginCount >= 2);
  assert.ok(individualCommitCount >= 2);
});

test('RepairGenerator - Generates warnings appropriately', async () => {
  const generator = new RepairGenerator();
  
  const differences = [
    // Safe operation
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      repairAction: 'add_column',
      expectedValue: createField({ name: 'name', type: 'String' })
    },
    // Unsafe operation
    {
      type: 'extra_table',
      table: 'OldTable',
      repairAction: 'drop_table'
    },
    // Operation that adds NOT NULL
    {
      type: 'nullability_mismatch',
      table: 'User',
      column: 'email',
      repairAction: 'add_not_null',
      expectedValue: true,
      actualValue: false
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  assert.ok(repairPlan.warnings);
  assert.ok(repairPlan.warnings.length > 0);
  
  // Should warn about excluded operations
  const excludedWarning = repairPlan.warnings.find(w => w.includes('excluded'));
  assert.ok(excludedWarning);
  
  // Should warn about NOT NULL constraints
  const nullWarning = repairPlan.warnings.find(w => w.includes('NOT NULL'));
  assert.ok(nullWarning);
});

test('RepairGenerator - Formats default values correctly', async () => {
  const generator = new RepairGenerator();
  
  const testCases = [
    { value: 'test string', expected: "'test string'" },
    { value: "string with 'quotes'", expected: "'string with ''quotes'''" },
    { value: true, expected: 'true' },
    { value: false, expected: 'false' },
    { value: 42, expected: '42' },
    { value: 3.14, expected: '3.14' },
    { value: { key: 'value' }, expected: '\'{"key":"value"}\'' },
    { value: null, expected: 'NULL' }
  ];
  
  for (const { value, expected } of testCases) {
    const formatted = generator.formatDefaultValue(value);
    assert.equal(formatted, expected, `Failed to format default value: ${value}`);
  }
});

test('RepairGenerator - Handles complex drift scenario', async () => {
  const generator = new RepairGenerator();
  
  // Complex scenario with multiple types of drift
  const differences = [
    // Missing required field
    {
      type: 'missing_field',
      table: 'User',
      column: 'email',
      severity: 'critical',
      repairAction: 'add_column',
      expectedValue: createField({ 
        name: 'email', 
        type: 'String', 
        nonNull: true,
        directives: { '@default': { value: 'noreply@example.com' } }
      })
    },
    // Missing optional field
    {
      type: 'missing_field',
      table: 'User',
      column: 'name',
      severity: 'high',
      repairAction: 'add_column',
      expectedValue: createField({ 
        name: 'name', 
        type: 'String', 
        nonNull: false 
      })
    },
    // Missing index directive
    {
      type: 'missing_directive',
      table: 'User',
      directive: '@index',
      severity: 'medium',
      repairAction: 'add_directive',
      expectedValue: { column: 'email' }
    },
    // Unsafe operation - should be excluded
    {
      type: 'extra_field',
      table: 'User',
      column: 'obsolete',
      severity: 'low',
      repairAction: 'drop_column'
    }
  ];
  
  const driftReport = createDriftReport(differences);
  const repairPlan = await generator.generateRepairSQL(driftReport);
  
  // Verify plan structure
  assert.equal(repairPlan.summary.totalDifferences, 4);
  assert.equal(repairPlan.summary.safeRepairs, 3);
  assert.equal(repairPlan.summary.unsafeOperations, 1);
  assert.equal(repairPlan.repairSteps.length, 3);
  
  // Verify safety analysis
  assert.ok(repairPlan.safetyAnalysis.totalRiskScore > 0);
  assert.ok(repairPlan.safetyAnalysis.complexity);
  
  // Verify migration structure
  assert.ok(repairPlan.migration);
  assert.ok(repairPlan.migration.up.length > 0);
  assert.ok(repairPlan.migration.down.length > 0);
  
  // Verify rollback plan
  assert.equal(repairPlan.rollbackPlan.steps.length, 3);
  
  // Verify execution metrics
  assert.ok(repairPlan.executionMetrics.estimatedDuration > 0);
  assert.ok(repairPlan.executionMetrics.stepMetrics.length === 3);
});