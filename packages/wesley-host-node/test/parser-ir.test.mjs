import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphQLAdapter } from '../src/adapters/GraphQLAdapter.mjs';

test('GraphQLAdapter.parseSDL produces canonical IR for simple table', async () => {
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
  assert.ok(Array.isArray(table.fields));
  const id = table.fields.find((f) => f.name === 'id');
  const email = table.fields.find((f) => f.name === 'email');
  assert.ok(id, 'id field present');
  assert.ok(email, 'email field present');
  assert.deepEqual(id.type, { base: 'ID', isList: false });
  assert.equal(id.nullable, false);
  assert.deepEqual(email.type, { base: 'String', isList: false });
  assert.equal(email.nullable, false);
});
