import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphQLAdapter } from '../src/adapters/GraphQLAdapter.mjs';

test('GraphQLAdapter.parseSDL produces canonical-like IR for simple table', async () => {
  const sdl = /* GraphQL */ `
    type User @wes_table {
      id: ID! @wes_pk
      email: String! @wes_unique
    }
  `;

  const adapter = new GraphQLAdapter();
  const ir = adapter.parseSDL(sdl);

  assert.ok(ir, 'IR should be returned');
  assert.ok(Array.isArray(ir.tables), 'IR.tables should be an array');
  assert.equal(ir.tables.length, 1, 'Should have one table');

  const table = ir.tables[0];
  assert.equal(table.name, 'User');
  assert.ok(Array.isArray(table.columns));
  const id = table.columns.find((c) => c.name === 'id');
  const email = table.columns.find((c) => c.name === 'email');
  assert.ok(id, 'id column present');
  assert.ok(email, 'email column present');
  assert.equal(id.type, 'uuid');
  assert.equal(id.nullable, false);
  assert.equal(email.type, 'text');
  assert.equal(email.nullable, false);
});

