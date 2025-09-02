/**
 * TriggerGenerator Tests  
 * Tests for WP2.T007 computed column trigger generation
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { TriggerGenerator } from '../src/domain/generators/TriggerGenerator.mjs';
import { Schema, Table, Field } from '../src/domain/Schema.mjs';

// Helper function to create test schema
function createTestSchema() {
  return new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        firstName: new Field({ name: 'firstName', type: 'String', nonNull: true }),
        lastName: new Field({ name: 'lastName', type: 'String', nonNull: true }),
        fullName: new Field({ 
          name: 'fullName', 
          type: 'String',
          directives: { 
            '@computed': { 
              expression: "firstName || ' ' || lastName",
              dependencies: ['firstName', 'lastName']
            } 
          } 
        }),
        displayName: new Field({
          name: 'displayName',
          type: 'String', 
          directives: {
            '@generated': {
              expression: "COALESCE(firstName || ' ' || lastName, email)",
              stored: true
            }
          }
        }),
        email: new Field({ name: 'email', type: 'String', nonNull: true })
      }
    }),
    Profile: new Table({
      name: 'Profile',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        userId: new Field({ 
          name: 'userId', 
          type: 'ID', 
          nonNull: true, 
          directives: { '@foreignKey': { ref: 'User.id' } }
        }),
        bio: new Field({ name: 'bio', type: 'String' }),
        userFullName: new Field({
          name: 'userFullName',
          type: 'String',
          directives: {
            '@computed': {
              expression: "User.firstName || ' ' || User.lastName",
              dependencies: ['User.firstName', 'User.lastName']
            }
          }
        })
      }
    }),
    Order: new Table({
      name: 'Order',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        userId: new Field({ 
          name: 'userId', 
          type: 'ID', 
          nonNull: true,
          directives: { '@foreignKey': { ref: 'User.id' } }
        }),
        total: new Field({ name: 'total', type: 'Decimal', nonNull: true }),
        tax: new Field({ name: 'tax', type: 'Decimal' }),
        grandTotal: new Field({
          name: 'grandTotal',
          type: 'Decimal',
          directives: {
            '@computed': {
              expression: 'total + COALESCE(tax, 0)',
              dependencies: ['total', 'tax']
            }
          }
        })
      }
    })
  });
}

test('finds computed fields correctly', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  const userTable = schema.getTable('User');
  
  const computedFields = generator.findComputedFields(userTable);
  
  assert.equal(computedFields.length, 2);
  assert.equal(computedFields[0].name, 'fullName');
  assert.equal(computedFields[1].name, 'displayName');
});

test('generates GENERATED column for same-row computation', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  const userTable = schema.getTable('User');
  const displayNameField = userTable.getField('displayName');
  
  const trigger = generator.generateFieldTrigger(userTable, displayNameField);
  
  assert.equal(trigger.type, 'generated_column');
  assert.equal(trigger.tableName, 'User');
  assert.equal(trigger.fieldName, 'displayName');
  assert.equal(trigger.strategy, 'native-generated');
  assert.equal(trigger.performance, 'optimal');
  assert.ok(trigger.sql.includes('GENERATED ALWAYS AS'));
  assert.ok(trigger.sql.includes('STORED'));
});

test('generates trigger for same-row computed column', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  const userTable = schema.getTable('User');
  const fullNameField = userTable.getField('fullName');
  
  const trigger = generator.generateFieldTrigger(userTable, fullNameField);
  
  assert.equal(trigger.type, 'computed_trigger');
  assert.equal(trigger.tableName, 'User');
  assert.equal(trigger.fieldName, 'fullName');
  assert.equal(trigger.crossTable, false);
  assert.equal(trigger.strategy, 'same-row-trigger');
  assert.equal(trigger.performance, 'optimal');
  
  // Check function generation
  assert.ok(trigger.functionSQL.includes('compute_User_fullName'));
  assert.ok(trigger.functionSQL.includes("firstName || ' ' || lastName"));
  assert.ok(trigger.functionSQL.includes('NEW."fullName" := computed_value'));
  
  // Check trigger generation
  assert.ok(trigger.triggerSQL.includes('trigger_compute_User_fullName'));
  assert.ok(trigger.triggerSQL.includes('BEFORE INSERT OR UPDATE'));
  assert.ok(trigger.triggerSQL.includes('FOR EACH ROW'));
});

test('generates cross-table computed column trigger', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  const profileTable = schema.getTable('Profile');
  const userFullNameField = profileTable.getField('userFullName');
  
  const trigger = generator.generateFieldTrigger(profileTable, userFullNameField);
  
  assert.equal(trigger.type, 'computed_trigger');
  assert.equal(trigger.tableName, 'Profile');
  assert.equal(trigger.fieldName, 'userFullName');
  assert.equal(trigger.crossTable, true);
  assert.equal(trigger.strategy, 'cross-table-trigger');
  assert.deepEqual(trigger.referencedTables, ['User']);
  
  // Cross-table computation should have moderate performance
  assert.equal(trigger.performance, 'moderate');
  
  // Function should include error handling for cross-table queries
  assert.ok(trigger.functionSQL.includes('compute_Profile_userFullName'));
  assert.ok(trigger.functionSQL.includes('EXCEPTION'));
});

test('extracts table references from expressions', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  // Same-row expression
  const sameRowRefs = generator.extractTableReferences("firstName || ' ' || lastName");
  assert.deepEqual(sameRowRefs, []);
  
  // Cross-table expression
  const crossTableRefs = generator.extractTableReferences("User.firstName || ' ' || User.lastName");
  assert.deepEqual(crossTableRefs, ['User']);
  
  // Multiple table references
  const multiTableRefs = generator.extractTableReferences("User.name + Profile.bio");
  assert.deepEqual(multiTableRefs.sort(), ['Profile', 'User'].sort());
});

test('extracts column dependencies from expressions', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  // Simple dependencies
  const simpleDeps = generator.extractDependencies("firstName || ' ' || lastName");
  assert.ok(simpleDeps.includes('firstName'));
  assert.ok(simpleDeps.includes('lastName'));
  
  // Complex expression
  const complexDeps = generator.extractDependencies("CASE WHEN active THEN firstName ELSE 'Unknown' END");
  assert.ok(complexDeps.includes('active'));
  assert.ok(complexDeps.includes('firstName'));
  
  // Function calls should not be dependencies
  const funcDeps = generator.extractDependencies("COALESCE(firstName, 'Default')");
  assert.ok(funcDeps.includes('firstName'));
  assert.ok(!funcDeps.includes('COALESCE'));
});

test('generates all triggers for schema', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  const allTriggers = generator.generateAllTriggers();
  
  // Should generate triggers for computed columns
  assert.ok(allTriggers.length >= 3); // fullName, displayName, userFullName, grandTotal
  
  const triggerTypes = allTriggers.map(t => t.type);
  assert.ok(triggerTypes.includes('computed_trigger'));
  assert.ok(triggerTypes.includes('generated_column'));
  
  const tableNames = allTriggers.map(t => t.tableName);
  assert.ok(tableNames.includes('User'));
  assert.ok(tableNames.includes('Profile'));
  assert.ok(tableNames.includes('Order'));
});

test('finds cross-table dependencies', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  const crossTableDeps = generator.findCrossTableDependencies();
  
  // Profile.userFullName depends on User table
  const profileDep = crossTableDeps.find(dep => 
    dep.sourceTable === 'User' && 
    dep.targetTable === 'Profile' && 
    dep.targetField === 'userFullName'
  );
  
  assert.ok(profileDep, 'Should find Profile.userFullName dependency on User');
});

test('finds foreign key relations', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  const relations = generator.findForeignKeyRelations('User', 'Profile');
  
  assert.equal(relations.length, 1);
  assert.equal(relations[0].sourceTable, 'User');
  assert.equal(relations[0].targetTable, 'Profile');
  assert.equal(relations[0].foreignKey, 'userId');
  assert.equal(relations[0].primaryKey, 'id');
});

test('generates cascade update triggers', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema, { cascadeUpdates: true });
  
  const allTriggers = generator.generateAllTriggers();
  
  // Should include cascade triggers for cross-table dependencies
  const cascadeTriggers = allTriggers.filter(t => t.type === 'cascade_trigger');
  assert.ok(cascadeTriggers.length > 0, 'Should generate cascade triggers');
  
  const userCascade = cascadeTriggers.find(t => t.sourceTable === 'User');
  if (userCascade) {
    assert.equal(userCascade.targetTable, 'Profile');
    assert.equal(userCascade.strategy, 'cascade-update');
    assert.ok(userCascade.functionSQL.includes('cascade_update_User_to_Profile'));
    assert.ok(userCascade.triggerSQL.includes('AFTER UPDATE OR DELETE'));
  }
});

test('optimizes trigger performance with change detection', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema, { optimizePerformance: true });
  const userTable = schema.getTable('User');
  const fullNameField = userTable.getField('fullName');
  
  const trigger = generator.generateFieldTrigger(userTable, fullNameField);
  
  // Should include change detection optimization
  assert.ok(trigger.functionSQL.includes('Performance optimization'));
  assert.ok(trigger.functionSQL.includes('IS DISTINCT FROM'));
  assert.ok(trigger.functionSQL.includes('firstName') || trigger.functionSQL.includes('lastName'));
});

test('handles GENERATED column fallback for cross-table references', () => {
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        name: new Field({ name: 'name', type: 'String' }),
        crossTableGen: new Field({
          name: 'crossTableGen',
          type: 'String',
          directives: {
            '@generated': {
              expression: 'Profile.bio || name', // Invalid for GENERATED - references Profile table
              stored: true
            }
          }
        })
      }
    }),
    Profile: new Table({
      name: 'Profile', 
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        bio: new Field({ name: 'bio', type: 'String' })
      }
    })
  });

  const generator = new TriggerGenerator(schema);
  const userTable = schema.getTable('User');
  const crossTableField = userTable.getField('crossTableGen');
  
  const trigger = generator.generateFieldTrigger(userTable, crossTableField);
  
  // Should fall back to computed trigger instead of GENERATED column
  assert.equal(trigger.type, 'computed_trigger');
  assert.equal(trigger.crossTable, true);
  assert.equal(trigger.strategy, 'cross-table-trigger');
});

test('validates SQL expressions', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  // Valid expression
  const validResult = generator.validateExpression("firstName || ' ' || lastName");
  assert.equal(validResult.isValid, true);
  assert.equal(validResult.errors.length, 0);
  
  // Expression with mismatched parentheses
  const invalidResult = generator.validateExpression("COALESCE(firstName, 'default'");
  assert.equal(invalidResult.isValid, false);
  assert.equal(invalidResult.errors.length, 1);
  assert.ok(invalidResult.errors[0].includes('parentheses'));
  
  // Expression with SQL comments (warning)
  const commentResult = generator.validateExpression("firstName -- comment");
  assert.equal(commentResult.isValid, true);
  assert.equal(commentResult.warnings.length, 1);
  assert.ok(commentResult.warnings[0].includes('comments'));
});

test('assesses trigger performance correctly', () => {
  const schema = createTestSchema();
  const generator = new TriggerGenerator(schema);
  
  // Simple same-row computation
  const simplePerf = generator.assessTriggerPerformance("firstName || ' ' || lastName", ['firstName', 'lastName'], false);
  assert.equal(simplePerf, 'optimal');
  
  // Cross-table computation
  const crossTablePerf = generator.assessTriggerPerformance("User.name", ['User.name'], true);
  assert.equal(crossTablePerf, 'moderate');
  
  // Many dependencies
  const manyDepsPerf = generator.assessTriggerPerformance("a || b || c || d || e || f", ['a', 'b', 'c', 'd', 'e', 'f'], false);
  assert.equal(manyDepsPerf, 'moderate');
  
  // Expensive operations
  const expensivePerf = generator.assessTriggerPerformance("REGEXP_REPLACE(text, '[0-9]', 'X', 'g')", ['text'], false);
  assert.equal(expensivePerf, 'moderate');
});

test('handles trigger options correctly', () => {
  // Disable GENERATED columns
  const schemaNoGen = createTestSchema();
  const generatorNoGen = new TriggerGenerator(schemaNoGen, { useGeneratedColumns: false });
  const userTable = schemaNoGen.getTable('User');
  const displayNameField = userTable.getField('displayName');
  
  const triggerNoGen = generatorNoGen.generateFieldTrigger(userTable, displayNameField);
  
  // Should use trigger instead of GENERATED column
  assert.equal(triggerNoGen.type, 'computed_trigger');
  
  // Disable cascade updates
  const generatorNoCascade = new TriggerGenerator(schemaNoGen, { cascadeUpdates: false });
  const allTriggers = generatorNoCascade.generateAllTriggers();
  
  const cascadeTriggers = allTriggers.filter(t => t.type === 'cascade_trigger');
  assert.equal(cascadeTriggers.length, 0, 'Should not generate cascade triggers when disabled');
});