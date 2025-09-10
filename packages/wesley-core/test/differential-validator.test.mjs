/**
 * Differential Validator Tests
 * Tests for Wave 2 WP3.T004 - Compare expected vs actual schema state
 */

import { test } from 'node:test';
import assert from 'node:assert';
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

test('DifferentialValidator - No drift detected for identical schemas', async () => {
  const validator = new DifferentialValidator();
  
  const schema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        email: createField({ name: 'email', type: 'String', nonNull: true })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(schema, schema);
  
  assert.equal(report.hasDrift, false);
  assert.equal(report.summary.totalDifferences, 0);
  assert.equal(report.driftSeverity, 'none');
});

test('DifferentialValidator - Detects missing table as critical drift', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const actualSchema = new Schema({});
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.equal(report.hasDrift, true);
  assert.equal(report.summary.totalDifferences, 1);
  assert.equal(report.summary.criticalDifferences, 1);
  assert.equal(report.driftSeverity, 'critical');
  
  const diff = report.differences[0];
  assert.equal(diff.type, 'missing_table');
  assert.equal(diff.table, 'User');
  assert.equal(diff.severity, 'critical');
  assert.equal(diff.impact, 'breaking');
  assert.equal(diff.repairAction, 'create_table');
});

test('DifferentialValidator - Detects missing field with appropriate severity', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true }),
        email: createField({ name: 'email', type: 'String', nonNull: true }),
        name: createField({ name: 'name', type: 'String', nonNull: false })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.equal(report.hasDrift, true);
  assert.equal(report.summary.totalDifferences, 2);
  
  // Should have one critical (required email) and one high (optional name)
  const emailDiff = report.differences.find(d => d.column === 'email');
  const nameDiff = report.differences.find(d => d.column === 'name');
  
  assert.equal(emailDiff.severity, 'critical');
  assert.equal(emailDiff.impact, 'breaking');
  assert.equal(nameDiff.severity, 'high');
  assert.equal(nameDiff.impact, 'data_loss_risk');
});

test('DifferentialValidator - Detects type mismatches', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true }),
        age: createField({ name: 'age', type: 'Int', nonNull: false })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true }),
        age: createField({ name: 'age', type: 'String', nonNull: false })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.equal(report.hasDrift, true);
  const typeDiff = report.differences.find(d => d.type === 'field_type_mismatch');
  assert.ok(typeDiff);
  assert.equal(typeDiff.column, 'age');
  assert.equal(typeDiff.severity, 'critical');
  assert.equal(typeDiff.expectedValue, 'Int');
  assert.equal(typeDiff.actualValue, 'String');
});

test('DifferentialValidator - Detects nullability changes', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        email: createField({ name: 'email', type: 'String', nonNull: true })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        email: createField({ name: 'email', type: 'String', nonNull: false })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.equal(report.hasDrift, true);
  const nullDiff = report.differences.find(d => d.type === 'nullability_mismatch');
  assert.ok(nullDiff);
  assert.equal(nullDiff.severity, 'high');
  assert.equal(nullDiff.impact, 'data_integrity_risk');
});

test('DifferentialValidator - Handles array type differences', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        tags: createField({ 
          name: 'tags', 
          type: 'String', 
          list: true, 
          itemNonNull: true 
        })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        tags: createField({ 
          name: 'tags', 
          type: 'String', 
          list: false 
        })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.equal(report.hasDrift, true);
  const listDiff = report.differences.find(d => d.type === 'list_property_mismatch');
  assert.ok(listDiff);
  assert.equal(listDiff.severity, 'critical');
  assert.equal(listDiff.impact, 'breaking');
});

test('DifferentialValidator - Type compatibility modes', async () => {
  // Strict mode
  const strictValidator = new DifferentialValidator({
    tolerance: { typeCompatibility: 'strict' }
  });
  
  // Compatible mode
  const compatibleValidator = new DifferentialValidator({
    tolerance: { typeCompatibility: 'compatible' }
  });
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'String' })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'text' })  // PostgreSQL equivalent
      }
    })
  });
  
  const strictReport = await strictValidator.validateSchemaDrift(expectedSchema, actualSchema);
  const compatibleReport = await compatibleValidator.validateSchemaDrift(expectedSchema, actualSchema);
  
  // Strict mode should detect difference
  assert.equal(strictReport.hasDrift, true);
  
  // Compatible mode should not detect difference (String and text are compatible)
  assert.equal(compatibleReport.hasDrift, false);
});

test('DifferentialValidator - Tracks modification history', async () => {
  const validator = new DifferentialValidator({ trackModifications: true });
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' }),
        email: createField({ name: 'email', type: 'String' })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema, {
    validationId: 'test_123',
    environment: 'test'
  });
  
  assert.equal(report.hasDrift, true);
  assert.ok(report.modificationHistory);
  assert.equal(report.modificationHistory.length, 1);
  
  const history = report.modificationHistory[0];
  assert.equal(history.validationId, 'test_123');
  assert.equal(history.environment, 'test');
  assert.equal(history.driftCount, 1);
});

test('DifferentialValidator - Categorizes drift types correctly', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true }),
        email: createField({ name: 'email', type: 'String', nonNull: true })
      },
      directives: { '@rls': { enabled: true } }
    }),
    Post: createTable({ name: 'Post' })  // Missing table
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'Int', nonNull: false }),  // Type + nullability change
        name: createField({ name: 'name', type: 'String' })  // Extra field
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.ok(report.diffReport.categories);
  
  // Should have structural differences (missing table, missing/extra fields)
  const structural = report.diffReport.categories.find(c => c.category === 'structural');
  assert.ok(structural);
  assert.ok(structural.count > 0);
  
  // Should have semantic differences (type/nullability changes)
  const semantic = report.diffReport.categories.find(c => c.category === 'semantic');
  assert.ok(semantic);
  assert.ok(semantic.count > 0);
  
  // Should have behavioral differences (missing directive)
  const behavioral = report.diffReport.categories.find(c => c.category === 'behavioral');
  assert.ok(behavioral);
  assert.ok(behavioral.count > 0);
});

test('DifferentialValidator - Generates repair recommendations', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true }),
        email: createField({ name: 'email', type: 'String', nonNull: true }),
        tags: createField({ name: 'tags', type: 'String', nonNull: false })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.ok(report.repairRecommendations);
  assert.ok(report.repairRecommendations.immediate);
  assert.ok(report.repairRecommendations.planned);
  
  // Critical missing field should be in immediate
  const immediateActions = report.repairRecommendations.immediate;
  const emailRepair = immediateActions.find(r => r.description.includes('email'));
  assert.ok(emailRepair);
  assert.equal(emailRepair.action, 'add_column');
  
  // Optional field should be in planned
  const plannedActions = report.repairRecommendations.planned;
  const tagsRepair = plannedActions.find(r => r.description.includes('tags'));
  assert.ok(tagsRepair);
});

test('DifferentialValidator - Handles directive differences', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' })
      },
      directives: { 
        '@rls': { enabled: true },
        '@table': { name: 'users' }
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' })
      },
      directives: { '@table': { name: 'users' } }  // Missing @rls
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.equal(report.hasDrift, true);
  const directiveDiff = report.differences.find(d => d.type === 'missing_directive');
  assert.ok(directiveDiff);
  assert.equal(directiveDiff.directive, '@rls');
  assert.equal(directiveDiff.severity, 'high');
});

test('DifferentialValidator - Assesses impact correctly', async () => {
  const validator = new DifferentialValidator();
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID', nonNull: true }),
        email: createField({ name: 'email', type: 'String', nonNull: true })
      }
    }),
    Post: createTable({ name: 'Post' })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'String', nonNull: false })  // Type + nullability change
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  assert.ok(report.impactAssessment);
  assert.equal(report.impactAssessment.severity, 'critical');
  assert.equal(report.impactAssessment.repairComplexity, 'high');
  assert.ok(report.impactAssessment.criticalIssues > 0);
  assert.ok(report.impactAssessment.breakingChanges > 0);
  assert.ok(report.impactAssessment.estimatedRepairTime > 0);
});

test('DifferentialValidator - Virtual fields are ignored', async () => {
  const validator = new DifferentialValidator();
  
  const virtualField = createField({ 
    name: 'posts', 
    type: 'Post', 
    list: true,
    directives: { '@hasMany': { ref: 'userId' } }
  });
  
  // Mock isVirtual method
  virtualField.isVirtual = () => true;
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' }),
        posts: virtualField
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' })
        // posts field missing, but it's virtual
      }
    })
  });
  
  const report = await validator.validateSchemaDrift(expectedSchema, actualSchema);
  
  // Should not detect drift for missing virtual field
  assert.equal(report.hasDrift, false);
});

test('DifferentialValidator - Strict mode affects extra field detection', async () => {
  const strictValidator = new DifferentialValidator({ strictMode: true });
  const lenientValidator = new DifferentialValidator({ strictMode: false });
  
  const expectedSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' })
      }
    })
  });
  
  const actualSchema = new Schema({
    User: createTable({
      name: 'User',
      fields: {
        id: createField({ name: 'id', type: 'ID' }),
        extra: createField({ name: 'extra', type: 'String' })  // Extra field
      }
    })
  });
  
  const strictReport = await strictValidator.validateSchemaDrift(expectedSchema, actualSchema);
  const lenientReport = await lenientValidator.validateSchemaDrift(expectedSchema, actualSchema);
  
  const strictExtra = strictReport.differences.find(d => d.type === 'extra_field');
  const lenientExtra = lenientReport.differences.find(d => d.type === 'extra_field');
  
  assert.equal(strictExtra.severity, 'medium');
  assert.equal(lenientExtra.severity, 'low');
});