/**
 * Test SQL generation flags work independently
 * Verifies generateSQL and enableRLS are separate concerns
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { WesleyOrchestrator } from '../../src/domain/WesleyOrchestrator.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

test('generateSQL flag controls DDL generation', async () => {
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        email: new Field({ name: 'email', type: 'String', nonNull: true })
      }
    })
  });
  
  // Test with generateSQL = false
  const orchestrator1 = new WesleyOrchestrator({ 
    generateSQL: false,
    enableRLS: true 
  });
  const result1 = await orchestrator1.orchestrate(schema);
  assert.strictEqual(result1.artifacts.sql, undefined, 'Should not generate SQL when generateSQL is false');
  
  // Test with generateSQL = true
  const orchestrator2 = new WesleyOrchestrator({ 
    generateSQL: true,
    enableRLS: false 
  });
  const result2 = await orchestrator2.orchestrate(schema);
  assert(result2.artifacts.sql, 'Should generate SQL when generateSQL is true');
  assert(result2.artifacts.sql.includes('CREATE TABLE'), 'SQL should contain DDL');
});

test('enableRLS flag controls RLS policy generation', async () => {
  const schema = new Schema({
    Product: new Table({
      name: 'Product',
      directives: {
        '@rls': {
          enabled: true,
          select: 'true',
          insert: 'auth.uid() IS NOT NULL'
        }
      },
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        name: new Field({ name: 'name', type: 'String', nonNull: true })
      }
    })
  });
  
  // Test with enableRLS = false
  const orchestrator1 = new WesleyOrchestrator({ 
    generateSQL: true,
    enableRLS: false 
  });
  const result1 = await orchestrator1.orchestrate(schema);
  assert(result1.artifacts.sql, 'Should generate SQL');
  assert(!result1.artifacts.sql.includes('CREATE POLICY'), 'Should not generate RLS policies when enableRLS is false');
  assert(!result1.artifacts.sql.includes('ENABLE ROW LEVEL SECURITY'), 'Should not enable RLS when flag is false');
  
  // Test with enableRLS = true
  const orchestrator2 = new WesleyOrchestrator({ 
    generateSQL: true,
    enableRLS: true 
  });
  const result2 = await orchestrator2.orchestrate(schema);
  assert(result2.artifacts.sql, 'Should generate SQL');
  assert(result2.artifacts.sql.includes('CREATE POLICY'), 'Should generate RLS policies when enableRLS is true');
  assert(result2.artifacts.sql.includes('ENABLE ROW LEVEL SECURITY'), 'Should enable RLS when flag is true');
});

test('flags work independently', async () => {
  const schema = new Schema({
    Order: new Table({
      name: 'Order',
      directives: {
        '@rls': {
          enabled: true,
          select: 'user_id = auth.uid()'
        }
      },
      fields: {
        id: new Field({ name: 'id', type: 'ID', nonNull: true }),
        user_id: new Field({ name: 'user_id', type: 'ID', nonNull: true })
      }
    })
  });
  
  // Test all combinations
  const testCases = [
    { generateSQL: false, enableRLS: false, expectSQL: false, expectRLS: false },
    { generateSQL: false, enableRLS: true,  expectSQL: false, expectRLS: false },
    { generateSQL: true,  enableRLS: false, expectSQL: true,  expectRLS: false },
    { generateSQL: true,  enableRLS: true,  expectSQL: true,  expectRLS: true }
  ];
  
  for (const testCase of testCases) {
    const orchestrator = new WesleyOrchestrator({ 
      generateSQL: testCase.generateSQL,
      enableRLS: testCase.enableRLS 
    });
    const result = await orchestrator.orchestrate(schema);
    
    if (testCase.expectSQL) {
      assert(result.artifacts.sql, `Should generate SQL with generateSQL=${testCase.generateSQL}`);
      assert(result.artifacts.sql.includes('CREATE TABLE'), 'Should contain DDL');
      
      if (testCase.expectRLS) {
        assert(result.artifacts.sql.includes('CREATE POLICY'), `Should include RLS with enableRLS=${testCase.enableRLS}`);
      } else {
        assert(!result.artifacts.sql.includes('CREATE POLICY'), `Should not include RLS with enableRLS=${testCase.enableRLS}`);
      }
    } else {
      assert.strictEqual(result.artifacts.sql, undefined, `Should not generate SQL with generateSQL=${testCase.generateSQL}`);
    }
  }
});