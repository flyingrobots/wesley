import test from 'node:test';
import assert from 'node:assert/strict';
import { collectParams } from '../../src/domain/qir/ParamCollector.mjs';

test('collectParams: deterministic ordering with duplicates', () => {
  const plan = {
    root: { kind: 'Table', alias: 't0', table: 'organization' },
    projection: {
      items: [
        { alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } },
        { alias: 'q', expr: { kind: 'ParamRef', name: 'q', typeHint: 'text' } }
      ]
    },
    orderBy: [ { expr: { kind: 'ParamRef', name: 'limit', typeHint: 'integer' }, direction: 'asc' } ],
    limit: null,
    offset: null
  };

  // add a filter with nested param
  plan.root = {
    kind: 'Filter',
    alias: 'f0',
    input: plan.root,
    predicate: {
      kind: 'And',
      left: { kind: 'Compare', op: 'ilike', left: { kind: 'ColumnRef', table: 't0', column: 'name' }, right: { kind: 'ParamRef', name: 'q', typeHint: 'text' } },
      right: { kind: 'Compare', op: 'gt', left: { kind: 'ColumnRef', table: 't0', column: 'created_at' }, right: { kind: 'ParamRef', name: 'since', typeHint: 'timestamptz' } }
    }
  };

  const { ordered } = collectParams(plan);
  assert.deepEqual(ordered.map(p => p.name), ['q', 'limit', 'since']);
});
