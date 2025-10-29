/**
 * Golden snapshot tests for pgTAP test generation
 * Ensures test output remains consistent
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PgTAPTestGenerator } from '../../src/domain/generators/PgTAPTestGenerator.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

test('generates basic table tests', async () => {
  // Disable depth testing to assert on canonical pgTAP statements
  const generator = new PgTAPTestGenerator(undefined, { enableDepthTesting: false });
  
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({ 
          name: 'id', 
          type: 'ID', 
          nonNull: true, 
          directives: { '@primaryKey': {} } 
        }),
        email: new Field({ 
          name: 'email', 
          type: 'String', 
          nonNull: true, 
          directives: { '@unique': {} } 
        }),
        password: new Field({ 
          name: 'password', 
          type: 'String', 
          nonNull: true, 
          directives: { '@sensitive': {} } 
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  // Should include table existence test
  assert(sql.includes("has_table('User'"));
  
  // Should include column tests
  assert(sql.includes("has_column('User', 'id',"));
  assert(sql.includes("has_column('User', 'email',"));
  assert(sql.includes("has_column('User', 'password',"));
  
  // Should include constraint tests
  assert(sql.includes("col_is_pk('User', 'id',"));
  assert(sql.includes("col_is_unique('User', 'email',"));
  assert(sql.includes("col_not_null('User', 'password',"));
});

test('generates foreign key tests', async () => {
  const generator = new PgTAPTestGenerator(undefined, { enableDepthTesting: false });
  
  const schema = new Schema({
    Order: new Table({
      name: 'Order',
      fields: {
        id: new Field({ 
          name: 'id', 
          type: 'ID', 
          nonNull: true, 
          directives: { '@primaryKey': {} } 
        }),
        userId: new Field({ 
          name: 'userId', 
          type: 'ID', 
          nonNull: true, 
          directives: { 
            '@foreignKey': { ref: 'User.id' } 
          }
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  assert(sql.includes("fk_ok('Order', 'userId', 'User', 'id'"));
});

test('generates RLS policy tests', async () => {
  const generator = new PgTAPTestGenerator(undefined, { enableDepthTesting: false });
  
  const schema = new Schema({
    Product: new Table({
      name: 'Product',
      directives: {
        '@uid': { value: 'product_001' },
        '@rls': {
          enabled: true,
          select: 'true',
          insert: 'auth.uid() = created_by'
        }
      },
      fields: {
        id: new Field({ 
          name: 'id', 
          type: 'ID', 
          nonNull: true, 
          directives: { '@primaryKey': {} } 
        }),
        created_by: new Field({ 
          name: 'created_by', 
          type: 'ID', 
          nonNull: true 
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  // Should test RLS is enabled
  assert(sql.includes("table_has_rls('Product', 'Product should have RLS enabled')"));
  
  // Should test policies exist with expected identifiers
  assert(sql.includes("policy_exists('Product', 'policy_Product_select_product_001'"));
  assert(sql.includes("policy_exists('Product', 'policy_Product_insert_product_001'"));
});

test('prioritizes critical field tests', async () => {
  const generator = new PgTAPTestGenerator(undefined, { enableDepthTesting: false });
  
  const schema = new Schema({
    Payment: new Table({
      name: 'Payment',
      fields: {
        id: new Field({ 
          name: 'id', 
          type: 'ID', 
          nonNull: true, 
          directives: { '@primaryKey': {} } 
        }),
        amount: new Field({ 
          name: 'amount', 
          type: 'Float', 
          nonNull: true, 
          directives: { '@critical': {} } 
        }),
        status: new Field({ 
          name: 'status', 
          type: 'String', 
          nonNull: true 
        }),
        metadata: new Field({ 
          name: 'metadata', 
          type: 'JSON' 
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  const lines = sql.split('\n');
  
  // Critical field tests should come before non-critical
  const amountTestIndex = lines.findIndex(l => l.includes("'amount'"));
  const metadataTestIndex = lines.findIndex(l => l.includes("'metadata'"));
  
  assert(amountTestIndex < metadataTestIndex, 'Critical fields should be tested first');
});

test('generates performance tests for indexed fields', async () => {
  const generator = new PgTAPTestGenerator(undefined, { enableDepthTesting: false });
  
  const schema = new Schema({
    Product: new Table({
      name: 'Product',
      fields: {
        id: new Field({ 
          name: 'id', 
          type: 'ID', 
          nonNull: true, 
          directives: { '@primaryKey': {} } 
        }),
        sku: new Field({ 
          name: 'sku', 
          type: 'String', 
          nonNull: true, 
          directives: { '@index': {} } 
        }),
        name: new Field({ 
          name: 'name', 
          type: 'String', 
          nonNull: true, 
          directives: { '@index': {} } 
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  // Should include index existence tests
  assert(sql.includes("has_index('Product', 'Product_sku_idx',"));
  assert(sql.includes("has_index('Product', 'Product_name_idx',"));
});
