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
  OrderBy
} from '../../src/domain/qir/Nodes.mjs';

test('QIR: builds a minimal plan with deterministic aliases', () => {
  const aa = new AliasAllocator('t');
  const root = new TableNode('organization', aa.next());
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef(root.alias, 'id')),
    new ProjectionItem('name', new ColumnRef(root.alias, 'name'))
  ]);
  const plan = new QueryPlan(root, proj, {
    orderBy: [new OrderBy(new ColumnRef(root.alias, 'name'), 'asc')],
    limit: 10,
    offset: 0
  });

  assert.equal(root.alias, 't0');
  assert.equal(plan.projection.items.length, 2);
  assert.equal(plan.orderBy.length, 1);
  assert.equal(plan.limit, 10);
  assert.equal(plan.offset, 0);
});

test('QIR: simple EXISTS predicate shape', () => {
  const childPlan = new QueryPlan(new TableNode('membership', 'm0'), new Projection());
  const exists = Predicate.exists(childPlan);
  assert.equal(exists.kind, 'Exists');
  assert.ok(exists.subquery instanceof QueryPlan);
});

