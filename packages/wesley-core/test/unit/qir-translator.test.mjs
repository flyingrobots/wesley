import test from 'node:test';
import assert from 'node:assert/strict';

import { translateOperation } from '../../src/domain/qir/Translator.mjs';
import { TranslateEnv } from '../../src/domain/qir/TranslateEnv.mjs';
import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';
import { collectParams } from '../../src/domain/qir/ParamCollector.mjs';

// Minimal IR fixture
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
          { name: 'slug', type: { base: 'String', isList: false }, nullable: false, directives: { unique: true } },
          { name: 'price_cents', type: { base: 'Int', isList: false }, nullable: false, directives: {} }
        ],
        indexes: [],
        constraints: []
      },
      {
        name: 'Membership',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'org_id', type: { base: 'UUID', isList: false }, nullable: false, directives: { fk: { targetTable: 'Organization', targetField: 'id' } } },
          { name: 'user_id', type: { base: 'UUID', isList: false }, nullable: false, directives: { fk: { targetTable: 'User', targetField: 'id' } } },
          { name: 'role', type: { base: 'String', isList: false }, nullable: false, directives: {} }
        ],
        indexes: [],
        constraints: []
      },
      {
        name: 'Organization',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'UUID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'name', type: { base: 'String', isList: false }, nullable: false, directives: {} }
        ],
        indexes: [],
        constraints: []
      }
    ],
    relationships: [
      { type: 'one-to-many', from: { table: 'User', field: 'id' }, to: { table: 'Order', field: 'user_id' } },
      { type: 'one-to-many', from: { table: 'Order', field: 'id' }, to: { table: 'OrderItem', field: 'order_id' } },
      { type: 'one-to-many', from: { table: 'Product', field: 'id' }, to: { table: 'OrderItem', field: 'product_id' } },
      { type: 'one-to-many', from: { table: 'Organization', field: 'id' }, to: { table: 'Membership', field: 'org_id' } },
      { type: 'one-to-many', from: { table: 'User', field: 'id' }, to: { table: 'Membership', field: 'user_id' } }
    ]
  };
}

// --- Scalar projection ---

test('Translator: simple scalar query produces correct SQL', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query AllProducts {
      products {
        id
        name
        price_cents
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Product' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('id'), 'should project id');
  assert.ok(sql.includes('name'), 'should project name');
  assert.ok(sql.includes('price_cents'), 'should project price_cents');
  assert.ok(sql.toLowerCase().includes('from'), 'should have FROM clause');
});

test('Translator: preserves field aliases', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query {
      products {
        productId: id
        productName: name
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Product' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('"productId"') || sql.includes('AS "productId"'), 'should use alias productId');
  assert.ok(sql.includes('"productName"') || sql.includes('AS "productName"'), 'should use alias productName');
});

// --- belongsTo (many:1) join ---

test('Translator: belongsTo relation produces LEFT JOIN with JsonBuildObject', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query OrdersWithUser {
      orders {
        id
        order_number
        user {
          id
          email
        }
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Order' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.toLowerCase().includes('left join'), 'should produce LEFT JOIN for belongsTo');
  assert.ok(sql.includes('jsonb_build_object'), 'should nest user as JSON object');
  assert.ok(sql.includes('"user"') || sql.includes('AS "user"'), 'should alias nested object as "user"');
});

// --- hasMany (1:N) lateral ---

test('Translator: hasMany relation produces LATERAL with JsonAgg', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query OrdersWithItems {
      orders {
        id
        items {
          id
          quantity
          unit_price_cents
        }
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Order' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.toLowerCase().includes('lateral'), 'should produce LATERAL for hasMany');
  assert.ok(sql.includes('jsonb_agg'), 'should aggregate child rows with jsonb_agg');
  assert.ok(sql.includes('jsonb_build_object'), 'should build child row objects');
});

// --- Filters ---

test('Translator: where filter with eq produces WHERE clause', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query ProductBySlug($slug: String!) {
      products(where: { slug: { eq: $slug } }) {
        id
        name
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Product' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.toLowerCase().includes('where'), 'should have WHERE clause');
  assert.ok(sql.includes('$1'), 'should have parameter placeholder');
});

test('Translator: where filter with isNull', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query UsersWithoutName {
      users(where: { full_name: { isNull: true } }) {
        id
        email
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'User' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('IS NULL'), 'should produce IS NULL predicate');
});

test('Translator: where filter with AND/OR', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query FilteredOrders($status: String!, $minTotal: Int!) {
      orders(where: { AND: [
        { status: { eq: $status } },
        { total_cents: { gte: $minTotal } }
      ] }) {
        id
        order_number
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Order' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.toLowerCase().includes('where'), 'should have WHERE clause');
  assert.ok(sql.includes('AND') || sql.includes('and'), 'should have AND');
});

// --- EXISTS filter (some/none) ---

test('Translator: where with some produces EXISTS subquery', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query OrgsWithMember($userId: ID!) {
      organizations(where: { members: { some: { user_id: { eq: $userId } } } }) {
        id
        name
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Organization' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('EXISTS'), 'should produce EXISTS for "some" filter');
});

test('Translator: where with none produces NOT EXISTS', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query OrgsWithoutMember($userId: ID!) {
      organizations(where: { members: { none: { user_id: { eq: $userId } } } }) {
        id
        name
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Organization' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('NOT'), 'should produce NOT for "none" filter');
  assert.ok(sql.includes('EXISTS'), 'should produce EXISTS for "none" filter');
});

// --- Pagination ---

test('Translator: limit and offset produce LIMIT/OFFSET', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query PaginatedProducts($limit: Int!, $offset: Int!) {
      products(limit: $limit, offset: $offset) {
        id
        name
      }
    }
  `;
  // For MVP, limit/offset are literal values from the operation, not params
  const plan = translateOperation(gql, env, { rootTypeName: 'Product', variables: { limit: 20, offset: 10 } });
  assert.equal(plan.limit, 20);
  assert.equal(plan.offset, 10);
});

// --- OrderBy ---

test('Translator: orderBy produces ORDER BY clause', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query SortedProducts {
      products(orderBy: [{ name: asc }]) {
        id
        name
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Product' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('ORDER BY'), 'should have ORDER BY');
});

// --- Parameter determinism ---

test('Translator: parameters are collected in deterministic order', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query FilteredProducts($name: String!, $minPrice: Int!) {
      products(where: { AND: [
        { name: { ilike: $name } },
        { price_cents: { gte: $minPrice } }
      ] }) {
        id
        name
        price_cents
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Product' });
  const { ordered } = collectParams(plan);
  assert.ok(ordered.length >= 2, 'should collect at least 2 params');
});

// --- Auth variable compilation ---

test('Translator: auth_uid compiles to auth.uid() for supabase target', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query MyOrders($auth_uid: ID!) {
      orders(where: { user_id: { eq: $auth_uid } }) {
        id
        order_number
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Order', target: 'supabase' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('auth.uid()'), 'should inline auth.uid() for supabase');
});

test('Translator: auth_uid compiles to current_setting for postgres target', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query MyOrders($auth_uid: ID!) {
      orders(where: { user_id: { eq: $auth_uid } }) {
        id
        order_number
      }
    }
  `;
  const plan = translateOperation(gql, env, { rootTypeName: 'Order', target: 'postgres' });
  const sql = lowerToSQL(plan);

  assert.ok(sql.includes('current_setting'), 'should use current_setting for postgres');
});

// --- Error cases ---

test('Translator: throws on unknown root type', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `query { widgets { id } }`;
  assert.throws(
    () => translateOperation(gql, env, { rootTypeName: 'Widget' }),
    /unknown type/i
  );
});

test('Translator: throws on unknown field in selection', () => {
  const env = new TranslateEnv(ecommerceIR());
  const gql = `
    query {
      products {
        id
        nonexistent_field
      }
    }
  `;
  assert.throws(
    () => translateOperation(gql, env, { rootTypeName: 'Product' }),
    /unknown field/i
  );
});

test('Translator: throws on invalid GraphQL syntax', () => {
  const env = new TranslateEnv(ecommerceIR());
  assert.throws(
    () => translateOperation('not valid graphql {{{', env, { rootTypeName: 'Product' }),
    /syntax/i
  );
});
