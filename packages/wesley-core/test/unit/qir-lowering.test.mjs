import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryPlan,
  TableNode,
  Projection,
  ProjectionItem,
  ColumnRef,
  AliasAllocator,
  Predicate,
  OrderBy,
} from '../../src/domain/qir/Nodes.mjs';

import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';

test('lowerToSQL: flat select with IS NULL and deterministic order by tie-breaker', () => {
  const aa = new AliasAllocator('t');
  const rootTable = new TableNode('organization', aa.next()); // t0

  // Wrap in a Filter node (shape used by ParamCollector)
  const filterNode = {
    kind: 'Filter',
    alias: 'f0',
    input: rootTable,
    predicate: { kind: 'Compare', left: new ColumnRef(rootTable.alias, 'deleted_at'), op: 'isNull' }
  };

  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef(rootTable.alias, 'id')),
    new ProjectionItem('name', new ColumnRef(rootTable.alias, 'name'))
  ]);

  const plan = new QueryPlan(filterNode, proj, {
    orderBy: [new OrderBy(new ColumnRef(rootTable.alias, 'name'), 'asc')],
    limit: 5,
    offset: 0
  });

  const sql = lowerToSQL(plan);
  // Snapshot-ish assertions (content checks)
  assert.ok(sql.includes('FROM organization'));
  assert.ok(sql.includes('IS NULL'));
  assert.ok(/ORDER BY\s+t0\.name\s+ASC?,?\s*,\s*t0\.id\s+ASC?/i.test(sql), 'appends id tie-breaker');
  assert.ok(sql.includes('LIMIT 5'));
});

test('lowerToSQL: JsonAgg gets COALESCE(..., \"[]\"::jsonb)', () => {
  const aa = new AliasAllocator('t');
  const root = new TableNode('organization', aa.next());

  const value = {
    kind: 'JsonBuildObject',
    fields: [
      { key: 'id', value: new ColumnRef(root.alias, 'id') },
      { key: 'name', value: new ColumnRef(root.alias, 'name') }
    ]
  };

  const proj = new Projection([
    new ProjectionItem('items', { kind: 'JsonAgg', value })
  ]);

  const plan = new QueryPlan(root, proj, {});
  const sql = lowerToSQL(plan);
  assert.ok(sql.includes("COALESCE(jsonb_agg(jsonb_build_object('id', t0.id, 'name', t0.name)), '[]'::jsonb)"));
});

test('lowerToSQL: IN uses = ANY($n::<type[]>)', () => {
  const aa = new AliasAllocator('t');
  const root = new TableNode('organization', aa.next());

  const filterNode = {
    kind: 'Filter',
    alias: 'f0',
    input: root,
    predicate: { kind: 'Compare', op: 'in', left: new ColumnRef(root.alias, 'id'), right: { kind: 'ParamRef', name: 'ids', typeHint: 'text[]' } }
  };

  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef(root.alias, 'id'))
  ]);

  const plan = new QueryPlan(filterNode, proj, {});
  const sql = lowerToSQL(plan);
  assert.match(sql, /=\s*ANY\(\$1::text\[\]\)/);
});
