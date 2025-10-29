/**
 * Golden snapshot tests for SQL generation
 * These ensure our SQL output remains consistent
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PostgreSQLGenerator } from '../../src/domain/generators/PostgreSQLGenerator.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';

test('generates basic table DDL', async () => {
  const generator = new PostgreSQLGenerator();
  
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
        name: new Field({ 
          name: 'name', 
          type: 'String' 
        }),
        createdAt: new Field({ 
          name: 'createdAt', 
          type: 'DateTime', 
          nonNull: true,
          directives: { '@default': { expr: 'NOW()' } }
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  assert(sql.includes('CREATE TABLE IF NOT EXISTS "users"'));
  assert(sql.includes('"id" uuid'));
  assert(sql.includes('"email" text NOT NULL'));
  assert(sql.includes('"name" text'));
  assert(sql.includes('"created_at" timestamptz NOT NULL DEFAULT NOW()'));
});

test('generates foreign key constraints', async () => {
  const generator = new PostgreSQLGenerator();
  
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
        }),
        total: new Field({ 
          name: 'total', 
          type: 'Float', 
          nonNull: true 
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  assert(sql.includes('FOREIGN KEY ("user_id") REFERENCES "users"("id")'));
});

test('generates RLS policies with proper naming', () => {
  const generator = new PostgreSQLGenerator();
  
  const table = new Table({
    name: 'Product',
    directives: {
      '@uid': { uid: 'product_001' },
      '@rls': {
        enabled: true,
        select: 'true',
        insert: 'auth.uid() = created_by',
        update: 'auth.uid() = created_by',
        delete: 'auth.uid() = created_by'
      }
    },
    fields: {
      id: new Field({ name: 'id', type: 'ID', nonNull: true })
    }
  });
  
  const policies = generator.generateRLSPolicies(table);
  
  assert(policies.includes('CREATE POLICY "policy_Product_select_product_001"'));
  assert(policies.includes('CREATE POLICY "policy_Product_insert_product_001"'));
  assert(policies.includes('CREATE POLICY "policy_Product_update_product_001"'));
  assert(policies.includes('CREATE POLICY "policy_Product_delete_product_001"'));
});

test('generates check constraints', async () => {
  const generator = new PostgreSQLGenerator();
  
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
        price: new Field({ 
          name: 'price', 
          type: 'Float', 
          nonNull: true, 
          directives: { 
            '@check': { expr: 'price > 0' } 
          }
        }),
        stock: new Field({ 
          name: 'stock', 
          type: 'Int', 
          nonNull: true, 
          directives: { 
            '@check': { expr: 'stock >= 0' } 
          }
        })
      }
    })
  });
  
  const sql = await generator.generate(schema);
  
  assert(sql.includes('CHECK (price > 0)'));
  assert(sql.includes('CHECK (stock >= 0)'));
});
