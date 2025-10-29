/**
 * Migration Differ Tests
 * Tests for schema diffing and migration generation
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { MigrationDiffer } from '../../src/domain/generators/MigrationDiffer.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

test('detects added tables', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({});
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true, directives: { '@primaryKey': {} } }),
        email: new Field({ name: 'email', type: 'String', nonNull: true })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].kind, 'create_table');
  assert.equal(result.steps[0].table, 'User');
});

test('detects added columns', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        email: new Field({ name: 'email', type: 'String', nonNull: true })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].kind, 'add_column');
  assert.equal(result.steps[0].table, 'User');
  assert.equal(result.steps[0].column, 'email');
});

test('detects dropped columns', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        deprecated: new Field({ name: 'deprecated', type: 'String' })
      }
    })
  });
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].kind, 'drop_column');
  assert.equal(result.steps[0].column, 'deprecated');
});

test('detects type changes including array nullability', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    Post: new Table({
      name: 'Post',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        tags: new Field({ name: 'tags', type: 'String', list: true, itemNonNull: false })
      }
    })
  });
  
  const newSchema = new Schema({
    Post: new Table({
      name: 'Post',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        tags: new Field({ name: 'tags', type: 'String', list: true, itemNonNull: true })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].kind, 'alter_type');
  assert.equal(result.steps[0].column, 'tags');
  assert.equal(result.steps[0].from.itemNonNull, false);
  assert.equal(result.steps[0].to.itemNonNull, true);
});

test('detects dropped tables', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    OldTable: new Table({
      name: 'OldTable',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const newSchema = new Schema({});
  
  const result = await differ.diff(oldSchema, newSchema);
  
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].kind, 'drop_table');
  assert.equal(result.steps[0].table, 'OldTable');
});

test('ignores virtual fields', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        posts: new Field({ 
          name: 'posts', 
          type: 'Post', 
          list: true,
          directives: { '@hasMany': {} }
        })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  // Should not detect any changes for virtual field
  assert.equal(result.steps.length, 0);
});

test('calculates risk scores', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        email: new Field({ name: 'email', type: 'String', nonNull: true })
      }
    })
  });
  
  const newSchema = new Schema({});
  
  const result = await differ.diff(oldSchema, newSchema);
  
  // Dropping a table should have high risk
  assert(result.safetyAnalysis, 'Should have safety analysis');
  assert(result.safetyAnalysis.totalRiskScore > 50, 'Drop table should be high risk');
  assert(result.holmesScore > 0, 'Should calculate Holmes score');
});

test('generates pre-flight snapshot for risky migrations', async () => {
  const differ = new MigrationDiffer({ generateSnapshots: true });
  
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        important_column: new Field({ name: 'important_column', type: 'String', nonNull: true })
      }
    })
  });
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  // Dropping column should trigger snapshot
  assert(result.preFlightSnapshot, 'Should generate pre-flight snapshot for risky migration');
});

test('handles complex multi-step migrations', async () => {
  const differ = new MigrationDiffer();
  
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        name: new Field({ name: 'name', type: 'String' })
      }
    }),
    OldTable: new Table({
      name: 'OldTable',
      fields: {
        id: new Field({ name: 'id', type: 'ID' })
      }
    })
  });
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        name: new Field({ name: 'name', type: 'String', nonNull: true }), // Made non-null
        email: new Field({ name: 'email', type: 'String', nonNull: true }) // Added
      }
    }),
    Post: new Table({ // New table
      name: 'Post',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        title: new Field({ name: 'title', type: 'String', nonNull: true })
      }
    })
  });
  
  const result = await differ.diff(oldSchema, newSchema);
  
  // Should have multiple steps
  const stepKinds = result.steps.map(s => s.kind);
  assert(stepKinds.includes('create_table'), 'Should create Post table');
  assert(stepKinds.includes('drop_table'), 'Should drop OldTable');
  assert(stepKinds.includes('add_column'), 'Should add email column');
  assert(stepKinds.includes('alter_type'), 'Should alter name nullability');
});