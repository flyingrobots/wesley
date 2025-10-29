import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePipeline } from '../../src/pipeline/pipelineMap.mjs';

test('Pipeline Map: compiles a simple products query end-to-end', () => {
    const sdl = /* GraphQL */ `
      type Product @table {
        id: ID! @primaryKey
        name: String!
        slug: String!
      }
    `;

    const op = {
      name: 'products_by_name',
      table: 'product',
      columns: ['id', 'name'],
      filters: [{ column: 'name', op: 'ilike', param: { name: 'q', type: 'text' } }],
      orderBy: { column: 'name', dir: 'asc' },
      limit: 10
    };

    const { schema, plan, sql } = compilePipeline({ sdl, op });

    // Schema assertions
    assert.ok(schema);
    assert.ok(schema.getTable('Product'));

    // QIR plan sanity (root and projection exist)
    assert.ok(plan?.root);
    assert.ok(plan?.projection);

    // SQL text assertions (shape, params, clauses)
    assert.match(sql, /SELECT/i);
    assert.match(sql, /FROM/i);
    assert.match(sql, /FROM\s+product\s+t0/i);
    assert.match(sql, /WHERE/i);
    assert.match(sql, /ILIKE/i);
    // Parameter should be present; type-hint may produce ::text
    assert.match(sql, /\$\d+(::text)?/);
    assert.match(sql, /ORDER BY/i);
    assert.match(sql, /LIMIT\s+10/);
  });
