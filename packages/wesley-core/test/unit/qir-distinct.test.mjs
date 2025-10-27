import test from 'node:test';
import assert from 'node:assert/strict';

import { QueryPlan, TableNode, Projection, ProjectionItem, ColumnRef, OrderBy } from '../../src/domain/qir/Nodes.mjs';
import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';

test('lowerToSQL: DISTINCT ON prefixes orderBy and renders clause', () => {
  const root = new TableNode('organization', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id')),
    new ProjectionItem('name', new ColumnRef('t0', 'name')),
  ]);
  const plan = new QueryPlan(root, proj, {
    distinctOn: [ new ColumnRef('t0','name') ],
    orderBy: [ new OrderBy(new ColumnRef('t0','id'), 'desc') ]
  });
  const sql = lowerToSQL(plan, null, { identPolicy: 'strict' });
  assert.ok(sql.startsWith('SELECT DISTINCT ON ("t0"."name")'));
  assert.ok(/ORDER BY\s+"t0"\."name"\s+ASC\s*,\s*"t0"\."id"\s+DESC/i.test(sql));
});

