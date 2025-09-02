/**
 * Golden snapshot tests for pgTAP test generation
 * Ensures test output remains consistent
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PgTAPTestGenerator } from '../../src/domain/generators/PgTAPTestGenerator.mjs';

test('generates basic table tests', () => {
  const generator = new PgTAPTestGenerator();
  const schema = {
    tables: {
      User: {
        name: 'User',
        uid: 'user_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'email', type: 'String', required: true, directives: { unique: true } },
          { name: 'password', type: 'String', required: true, directives: { sensitive: true } }
        ]
      }
    }
  };
  
  const sql = generator.generate(schema);
  
  // Should include table existence test
  assert(sql.includes("SELECT has_table('User')"));
  
  // Should include column tests
  assert(sql.includes("SELECT has_column('User', 'id')"));
  assert(sql.includes("SELECT has_column('User', 'email')"));
  assert(sql.includes("SELECT has_column('User', 'password')"));
  
  // Should include constraint tests
  assert(sql.includes("SELECT col_is_pk('User', 'id')"));
  assert(sql.includes("SELECT col_is_unique('User', 'email')"));
  assert(sql.includes("SELECT col_not_null('User', 'password')"));
});

test('generates foreign key tests', () => {
  const generator = new PgTAPTestGenerator();
  const schema = {
    tables: {
      Order: {
        name: 'Order',
        uid: 'order_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'userId', type: 'ID', required: true, directives: { 
            foreignKey: { table: 'User', field: 'id' } 
          }}
        ]
      }
    }
  };
  
  const sql = generator.generate(schema);
  
  assert(sql.includes("SELECT fk_ok('Order', 'userId', 'User', 'id')"));
});

test('generates RLS policy tests', () => {
  const generator = new PgTAPTestGenerator();
  const schema = {
    tables: {
      Product: {
        name: 'Product',
        uid: 'product_001',
        rls: {
          enabled: true,
          select: 'true',
          insert: 'auth.uid() = created_by'
        },
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'created_by', type: 'ID', required: true }
        ]
      }
    }
  };
  
  const sql = generator.generate(schema);
  
  // Should test RLS is enabled
  assert(sql.includes("SELECT table_has_rls('Product')"));
  
  // Should test policy exists
  assert(sql.includes("policy_Product_select_product_001"));
  assert(sql.includes("policy_Product_insert_product_001"));
});

test('prioritizes critical field tests', () => {
  const generator = new PgTAPTestGenerator();
  const schema = {
    tables: {
      Payment: {
        name: 'Payment',
        uid: 'payment_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'amount', type: 'Float', required: true, directives: { critical: true } },
          { name: 'status', type: 'String', required: true },
          { name: 'metadata', type: 'JSON', required: false }
        ]
      }
    }
  };
  
  const sql = generator.generate(schema);
  const lines = sql.split('\n');
  
  // Critical field tests should come before non-critical
  const amountTestIndex = lines.findIndex(l => l.includes("'amount'"));
  const metadataTestIndex = lines.findIndex(l => l.includes("'metadata'"));
  
  assert(amountTestIndex < metadataTestIndex, 'Critical fields should be tested first');
});

test('generates performance tests for indexed fields', () => {
  const generator = new PgTAPTestGenerator();
  const schema = {
    tables: {
      Product: {
        name: 'Product',
        uid: 'product_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'sku', type: 'String', required: true, directives: { index: true } },
          { name: 'name', type: 'String', required: true, directives: { index: true } }
        ]
      }
    }
  };
  
  const sql = generator.generate(schema);
  
  // Should include index existence tests
  assert(sql.includes("SELECT has_index('Product', 'idx_Product_sku')"));
  assert(sql.includes("SELECT has_index('Product', 'idx_Product_name')"));
});