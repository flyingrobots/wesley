import test from 'node:test';
import assert from 'node:assert/strict';

import { TranslateEnv } from '../../src/domain/qir/TranslateEnv.mjs';

// Minimal IR fixture matching WesleyIR.schema.ts shape
function ecommerceIR() {
  return {
    version: '1.0.0',
    metadata: { sourceHash: 'abc', generatedAt: '2026-01-01T00:00:00Z' },
    tables: [
      {
        name: 'User',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'email', type: { base: 'String', isList: false }, nullable: false, directives: { unique: true } },
          { name: 'full_name', type: { base: 'String', isList: false }, nullable: true, directives: {} }
        ],
        indexes: [],
        constraints: []
      },
      {
        name: 'Order',
        directives: { table: true, rls: { enabled: true } },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'order_number', type: { base: 'String', isList: false }, nullable: false, directives: { unique: true } },
          { name: 'user_id', type: { base: 'UUID', isList: false }, nullable: false, directives: { fk: { targetTable: 'User', targetField: 'id' } } },
          { name: 'status', type: { base: 'String', isList: false }, nullable: false, directives: {} },
          { name: 'total_cents', type: { base: 'Int', isList: false }, nullable: false, directives: {} }
        ],
        indexes: [],
        constraints: []
      },
      {
        name: 'OrderItem',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'order_id', type: { base: 'UUID', isList: false }, nullable: false, directives: { fk: { targetTable: 'Order', targetField: 'id' } } },
          { name: 'product_id', type: { base: 'UUID', isList: false }, nullable: false, directives: { fk: { targetTable: 'Product', targetField: 'id' } } },
          { name: 'quantity', type: { base: 'Int', isList: false }, nullable: false, directives: {} },
          { name: 'unit_price_cents', type: { base: 'Int', isList: false }, nullable: false, directives: {} }
        ],
        indexes: [],
        constraints: []
      },
      {
        name: 'Product',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'name', type: { base: 'String', isList: false }, nullable: false, directives: {} },
          { name: 'price_cents', type: { base: 'Int', isList: false }, nullable: false, directives: {} },
          { name: 'tags', type: { base: 'String', isList: true }, nullable: true, directives: {} }
        ],
        indexes: [],
        constraints: []
      }
    ],
    relationships: [
      { type: 'one-to-many', from: { table: 'User', field: 'id' }, to: { table: 'Order', field: 'user_id' } },
      { type: 'one-to-many', from: { table: 'Order', field: 'id' }, to: { table: 'OrderItem', field: 'order_id' } },
      { type: 'one-to-many', from: { table: 'Product', field: 'id' }, to: { table: 'OrderItem', field: 'product_id' } }
    ]
  };
}

test('TranslateEnv: resolveTable maps type name to generated SQL table name', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.resolveTable('User'), 'users');
  assert.equal(env.resolveTable('Order'), 'orders');
  assert.equal(env.resolveTable('OrderItem'), 'order_items');
  assert.equal(env.resolveTable('Product'), 'products');
});

test('TranslateEnv: resolveTable throws on unknown type', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.throws(() => env.resolveTable('Nonexistent'), /unknown type/i);
});

test('TranslateEnv: resolveTableRef normalizes logical and physical table references', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.resolveTableRef('Product'), 'products');
  assert.equal(env.resolveTableRef('product'), 'products');
  assert.equal(env.resolveTableRef('products'), 'products');
  assert.equal(env.resolveTableRef('app.Product'), 'app.products');
  assert.equal(env.resolveTableRef('OrderItem'), 'order_items');
  assert.equal(env.resolveTableRef('orderitem'), 'order_items');
  assert.equal(env.resolveTableRef('order_item'), 'order_items');
  assert.equal(env.resolveTableRef('order_items'), 'order_items');
});

test('TranslateEnv: resolveTableRef rejects malformed schema-qualified references', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.throws(() => env.resolveTableRef('app..Product'), /unknown table reference/i);
});

test('TranslateEnv: resolveColumn returns table alias, column name, and PG type', () => {
  const env = new TranslateEnv(ecommerceIR());
  const col = env.resolveColumn('User', 'email');
  assert.equal(col.column, 'email');
  assert.equal(col.pgType, 'text');
});

test('TranslateEnv: resolveColumn maps GraphQL scalars to PG types', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.resolveColumn('User', 'id').pgType, 'uuid');
  assert.equal(env.resolveColumn('Order', 'total_cents').pgType, 'integer');
  assert.equal(env.resolveColumn('Product', 'tags').pgType, 'text[]');
});

test('TranslateEnv: resolveColumn throws on unknown field', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.throws(() => env.resolveColumn('User', 'nonexistent'), /unknown field/i);
});

test('TranslateEnv: isScalar returns true for data columns', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.isScalar('User', 'email'), true);
  assert.equal(env.isScalar('User', 'id'), true);
});

test('TranslateEnv: pkField returns the primary key field name', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.pkField('User'), 'id');
  assert.equal(env.pkField('Order'), 'id');
});

test('TranslateEnv: rlsEnabled checks @wes_rls directive', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.rlsEnabled('Order'), true);
  assert.equal(env.rlsEnabled('User'), false);
});

test('TranslateEnv: resolveRelation detects belongsTo (many:1 via FK)', () => {
  const env = new TranslateEnv(ecommerceIR());
  // Order.user_id is an FK to User.id — so "user" on Order is a belongsTo
  const rel = env.resolveRelation('Order', 'user');
  assert.ok(rel, 'should find a relation for "user" on Order');
  assert.equal(rel.kind, 'many-to-one');
  assert.equal(rel.targetTable, 'User');
  assert.equal(rel.fkField, 'user_id');
  assert.equal(rel.targetPkField, 'id');
});

test('TranslateEnv: resolveRelation detects hasMany (1:N)', () => {
  const env = new TranslateEnv(ecommerceIR());
  // User has many Orders via Order.user_id
  const rel = env.resolveRelation('User', 'orders');
  assert.ok(rel, 'should find a relation for "orders" on User');
  assert.equal(rel.kind, 'one-to-many');
  assert.equal(rel.targetTable, 'Order');
  assert.equal(rel.fkField, 'user_id');
});

test('TranslateEnv: resolveRelation returns null for scalar fields', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.resolveRelation('User', 'email'), null);
});

test('TranslateEnv: resolveRelation detects hasMany for nested chain', () => {
  const env = new TranslateEnv(ecommerceIR());
  // Order has many OrderItems via OrderItem.order_id
  const rel = env.resolveRelation('Order', 'items');
  assert.ok(rel, 'should find a relation for "items" on Order');
  assert.equal(rel.kind, 'one-to-many');
  assert.equal(rel.targetTable, 'OrderItem');
  assert.equal(rel.fkField, 'order_id');
});

test('TranslateEnv: nextAlias generates deterministic aliases', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.equal(env.nextAlias(), 't0');
  assert.equal(env.nextAlias(), 't1');
  assert.equal(env.nextAlias('j'), 'j0');
  assert.equal(env.nextAlias('j'), 'j1');
});
