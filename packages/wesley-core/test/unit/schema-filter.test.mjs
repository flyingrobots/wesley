import test from 'node:test';
import assert from 'node:assert/strict';

import { filterIRByUnits } from '../../src/domain/SchemaFilter.mjs';

test('filterIRByUnits: keeps only tables matching unit IDs', () => {
  const ir = {
    tables: [
      { name: 'Widget', sourceUnit: 'core.graphql' },
      { name: 'Player', sourceUnit: 'game.graphql' },
      { name: 'Item', sourceUnit: 'core.graphql' },
    ],
    enums: [],
    scalars: [],
  };

  const filtered = filterIRByUnits(ir, ['core.graphql']);
  assert.equal(filtered.tables.length, 2);
  assert.equal(filtered.tables[0].name, 'Widget');
  assert.equal(filtered.tables[1].name, 'Item');
});

test('filterIRByUnits: filters enums and scalars too', () => {
  const ir = {
    tables: [
      { name: 'Widget', sourceUnit: 'core.graphql' },
    ],
    enums: [
      { name: 'Color', sourceUnit: 'core.graphql' },
      { name: 'Status', sourceUnit: 'game.graphql' },
    ],
    scalars: [
      { name: 'Timestamp', sourceUnit: 'core.graphql' },
      { name: 'Money', sourceUnit: 'game.graphql' },
    ],
  };

  const filtered = filterIRByUnits(ir, ['game.graphql']);
  assert.equal(filtered.tables.length, 0);
  assert.equal(filtered.enums.length, 1);
  assert.equal(filtered.enums[0].name, 'Status');
  assert.equal(filtered.scalars.length, 1);
  assert.equal(filtered.scalars[0].name, 'Money');
});

test('filterIRByUnits: multiple unit IDs', () => {
  const ir = {
    tables: [
      { name: 'A', sourceUnit: 'a.graphql' },
      { name: 'B', sourceUnit: 'b.graphql' },
      { name: 'C', sourceUnit: 'c.graphql' },
    ],
    enums: [],
    scalars: [],
  };

  const filtered = filterIRByUnits(ir, ['a.graphql', 'c.graphql']);
  assert.equal(filtered.tables.length, 2);
  assert.equal(filtered.tables[0].name, 'A');
  assert.equal(filtered.tables[1].name, 'C');
});

test('filterIRByUnits: empty unit list → empty result', () => {
  const ir = {
    tables: [{ name: 'Widget', sourceUnit: 'core.graphql' }],
    enums: [],
    scalars: [],
  };

  const filtered = filterIRByUnits(ir, []);
  assert.equal(filtered.tables.length, 0);
});

test('filterIRByUnits: preserves non-filtered properties', () => {
  const ir = {
    version: '1.0.0',
    metadata: { sourceHash: 'abc' },
    tables: [{ name: 'Widget', sourceUnit: 'core.graphql' }],
    enums: [],
    scalars: [],
    relationships: [{ type: 'one-to-many' }],
  };

  const filtered = filterIRByUnits(ir, ['core.graphql']);
  assert.equal(filtered.version, '1.0.0');
  assert.deepEqual(filtered.metadata, { sourceHash: 'abc' });
  assert.deepEqual(filtered.relationships, [{ type: 'one-to-many' }]);
});

test('filterIRByUnits: handles missing collections gracefully', () => {
  const ir = {
    tables: [{ name: 'Widget', sourceUnit: 'core.graphql' }],
  };

  const filtered = filterIRByUnits(ir, ['core.graphql']);
  assert.equal(filtered.tables.length, 1);
  assert.deepEqual(filtered.enums, []);
  assert.deepEqual(filtered.scalars, []);
});
