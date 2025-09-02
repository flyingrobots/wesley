/**
 * RLS Idempotency Test
 * Ensures RLS policies can be reapplied without errors
 * Tests deterministic naming convention
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PostgreSQLGenerator } from '../src/domain/generators/PostgreSQLGenerator.mjs';
import { PgTAPTestGenerator } from '../src/domain/generators/PgTAPTestGenerator.mjs';

test('RLS policies have deterministic names', () => {
  const generator = new PostgreSQLGenerator();
  
  const table = {
    name: 'Product',
    uid: 'product_001',
    rls: {
      enabled: true,
      select: 'true',
      insert: 'auth.uid() = created_by',
      update: 'auth.uid() = created_by', 
      delete: 'auth.uid() = created_by'
    }
  };
  
  const sql = generator.generateRLSPolicies(table);
  
  // Check deterministic naming pattern
  assert(sql.includes('DROP POLICY IF EXISTS "policy_Product_select_product_001"'));
  assert(sql.includes('CREATE POLICY "policy_Product_select_product_001"'));
  assert(sql.includes('DROP POLICY IF EXISTS "policy_Product_insert_product_001"'));
  assert(sql.includes('CREATE POLICY "policy_Product_insert_product_001"'));
  assert(sql.includes('DROP POLICY IF EXISTS "policy_Product_update_product_001"'));
  assert(sql.includes('CREATE POLICY "policy_Product_update_product_001"'));
  assert(sql.includes('DROP POLICY IF EXISTS "policy_Product_delete_product_001"'));
  assert(sql.includes('CREATE POLICY "policy_Product_delete_product_001"'));
});

test('RLS policies are idempotent', () => {
  const generator = new PostgreSQLGenerator();
  
  const table = {
    name: 'User',
    uid: 'user_001',
    rls: {
      enabled: true,
      select: 'id = auth.uid()',
      insert: 'id = auth.uid()',
      update: 'id = auth.uid()',
      delete: 'id = auth.uid()'
    }
  };
  
  // Generate twice - should produce identical output
  const sql1 = generator.generateRLSPolicies(table);
  const sql2 = generator.generateRLSPolicies(table);
  
  assert.strictEqual(sql1, sql2, 'RLS generation should be deterministic');
  
  // All policies should have DROP IF EXISTS
  const dropCount = (sql1.match(/DROP POLICY IF EXISTS/g) || []).length;
  assert.strictEqual(dropCount, 4, 'Should have DROP IF EXISTS for all 4 operations');
});

test('generates pgTAP test for RLS idempotency', () => {
  const testGenerator = new PgTAPTestGenerator();
  
  const schema = {
    tables: {
      Order: {
        name: 'Order',
        uid: 'order_001',
        rls: {
          enabled: true,
          select: 'user_id = auth.uid()'
        },
        fields: [
          { name: 'id', type: 'ID', required: true },
          { name: 'user_id', type: 'ID', required: true }
        ]
      }
    }
  };
  
  const tests = testGenerator.generate(schema);
  
  // Should test that policy exists
  assert(tests.includes('policy_Order_select_order_001'));
  
  // Should test RLS is enabled
  assert(tests.includes("SELECT table_has_rls('Order')"));
});

test('policy names use uid fallback correctly', () => {
  const generator = new PostgreSQLGenerator();
  
  // Table without uid
  const table = {
    name: 'Document',
    // no uid
    rls: {
      enabled: true,
      select: 'public = true'
    }
  };
  
  const sql = generator.generateRLSPolicies(table);
  
  // Should use lowercase table name as fallback
  assert(sql.includes('policy_Document_select_document'));
});