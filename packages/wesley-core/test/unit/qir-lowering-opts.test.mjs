import test from 'node:test';
import assert from 'node:assert/strict';

import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';
import {
  QueryPlan,
  TableNode,
  Projection,
  ProjectionItem,
  ColumnRef,
  OrderBy
} from '../../src/domain/qir/Nodes.mjs';

test('lowerToSQL: ParamRef with unsafe typeHint throws (C2)', () => {
  const plan = {
    root: { kind: 'Table', table: 'users', alias: 't0' },
    projection: { items: [
      { alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } }
    ] }
  };
  // Inject a filter with a malicious typeHint
  plan.root = {
    kind: 'Filter',
    input: plan.root,
    predicate: {
      kind: 'Compare', op: 'eq',
      left: { kind: 'ColumnRef', table: 't0', column: 'id' },
      right: { kind: 'ParamRef', name: 'x', typeHint: 'text; DROP TABLE users' }
    }
  };
  assert.throws(() => lowerToSQL(plan), /unsafe sql type/i);
});

test('lowerToSQL: Literal with unsafe type throws (C3)', () => {
  const plan = {
    root: { kind: 'Table', table: 'items', alias: 't0' },
    projection: { items: [
      { alias: 'v', expr: { kind: 'Literal', value: 'hello', type: 'text; DROP TABLE users' } }
    ] }
  };
  assert.throws(() => lowerToSQL(plan), /unsafe sql type/i);
});

test('lowerToSQL: orderBy with unsafe nulls throws (C4)', () => {
  const root = new TableNode('items', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id'))
  ]);
  const plan = new QueryPlan(root, proj, {
    orderBy: [new OrderBy(new ColumnRef('t0', 'id'), 'asc', 'FIRST; DROP TABLE x')]
  });
  assert.throws(() => lowerToSQL(plan), /invalid nulls/i);
});

test('lowerToSQL: fractional limit throws (SR-M1)', () => {
  const root = new TableNode('items', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id'))
  ]);
  const plan = new QueryPlan(root, proj, { limit: 5.5 });
  assert.throws(() => lowerToSQL(plan), /invalid limit/i);
});

test('lowerToSQL: fractional offset throws (SR-M1)', () => {
  const root = new TableNode('items', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id'))
  ]);
  const plan = new QueryPlan(root, proj, { offset: 3.7 });
  assert.throws(() => lowerToSQL(plan), /invalid offset/i);
});

test('lowerToSQL: NaN literal throws (SR-M2)', () => {
  const plan = {
    root: { kind: 'Table', table: 't', alias: 't0' },
    projection: { items: [{ alias: 'v', expr: { kind: 'Literal', value: NaN } }] }
  };
  assert.throws(() => lowerToSQL(plan), /invalid numeric/i);
});

test('lowerToSQL: Infinity literal throws (SR-M2)', () => {
  const plan = {
    root: { kind: 'Table', table: 't', alias: 't0' },
    projection: { items: [{ alias: 'v', expr: { kind: 'Literal', value: Infinity } }] }
  };
  assert.throws(() => lowerToSQL(plan), /invalid numeric/i);
});

test('lowerToSQL: negative Infinity literal throws (SR-M2)', () => {
  const plan = {
    root: { kind: 'Table', table: 't', alias: 't0' },
    projection: { items: [{ alias: 'v', expr: { kind: 'Literal', value: -Infinity } }] }
  };
  assert.throws(() => lowerToSQL(plan), /invalid numeric/i);
});

test('lowerToSQL: non-numeric limit throws (M4)', () => {
  const root = new TableNode('items', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id'))
  ]);
  const plan = new QueryPlan(root, proj, { limit: 'abc' });
  assert.throws(() => lowerToSQL(plan), /invalid limit/i);
});

test('lowerToSQL: negative offset throws (M4)', () => {
  const root = new TableNode('items', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id'))
  ]);
  const plan = new QueryPlan(root, proj, { offset: -5 });
  assert.throws(() => lowerToSQL(plan), /invalid offset/i);
});

test('lowerToSQL: recursive Subquery preserves pkResolver from opts', () => {
  const inner = {
    root: { kind: 'Table', table: 'membership', alias: 'm' },
    projection: { items: [{ alias: 'uid', expr: { kind: 'ColumnRef', table: 'm', column: 'user_id' } }] },
    orderBy: [{ expr: { kind: 'ColumnRef', table: 'm', column: 'name' }, direction: 'asc' }]
  };
  const plan = {
    root: { kind: 'Subquery', plan: inner, alias: 'sq' },
    projection: { items: [{ alias: 'uid', expr: { kind: 'ColumnRef', table: 'sq', column: 'uid' } }] }
  };
  // pkResolver returning a custom key for the 'membership' table
  const pkResolver = (p) => {
    let r = p?.root;
    while (r && r.kind === 'Filter') r = r.input;
    if (r && r.kind === 'Table' && r.table === 'membership') {
      return { kind: 'ColumnRef', table: r.alias, column: 'uuid' };
    }
    return null;
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal', pkResolver });
  // The inner subquery should use uuid tie-breaker, not default 'id'
  assert.match(sql, /m\.uuid\s+ASC/i, 'inner subquery should use pkResolver for tie-breaker');
  assert.ok(!sql.includes('m.id ASC'), 'should NOT fall back to default id tie-breaker');
});

test('lowerToSQL: recursive Subquery preserves identPolicy from opts', () => {
  const inner = {
    root: { kind: 'Table', table: 'item', alias: 't0' },
    projection: { items: [{ alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } }] }
  };
  const plan = {
    root: { kind: 'Subquery', plan: inner, alias: 'sq' },
    projection: { items: [{ alias: 'id', expr: { kind: 'ColumnRef', table: 'sq', column: 'id' } }] }
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'strict' });
  // Inner subquery idents should be quoted (strict policy)
  assert.match(sql, /"t0"\."id"/, 'inner subquery should use strict quoting');
});

test('lowerToSQL: Lateral subquery preserves opts through recursion', () => {
  const lateral = {
    root: { kind: 'Table', table: 'post', alias: 'p' },
    projection: { items: [{ alias: 'title', expr: { kind: 'ColumnRef', table: 'p', column: 'title' } }] }
  };
  const plan = {
    root: {
      kind: 'Join',
      left: { kind: 'Table', table: 'author', alias: 'a' },
      right: { kind: 'Lateral', plan: lateral, alias: 'lp' },
      joinType: 'LEFT',
      on: { kind: 'Compare', op: 'eq', left: { kind: 'Literal', value: true }, right: { kind: 'Literal', value: true } }
    },
    projection: { items: [{ alias: 'title', expr: { kind: 'ColumnRef', table: 'lp', column: 'title' } }] }
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'strict' });
  // Lateral subquery idents should be quoted
  assert.match(sql, /"p"\."title"/, 'lateral subquery should inherit strict quoting');
});

test('lowerToSQL: unknown join type throws', () => {
  const plan = {
    root: {
      kind: 'Join',
      left: { kind: 'Table', table: 'a', alias: 'a' },
      right: { kind: 'Table', table: 'b', alias: 'b' },
      joinType: 'CROSS',
      on: { kind: 'Compare', op: 'eq', left: { kind: 'Literal', value: true }, right: { kind: 'Literal', value: true } }
    },
    projection: { items: [{ alias: 'id', expr: { kind: 'ColumnRef', table: 'a', column: 'id' } }] }
  };
  assert.throws(() => lowerToSQL(plan), /unsupported join type/i);
});

test('lowerToSQL: DISTINCT ON does not duplicate matching leading orderBy', () => {
  const plan = {
    root: { kind: 'Table', table: 'org', alias: 't0' },
    projection: { items: [
      { alias: 'name', expr: { kind: 'ColumnRef', table: 't0', column: 'name' } },
      { alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } }
    ] },
    distinctOn: [{ kind: 'ColumnRef', table: 't0', column: 'name' }],
    orderBy: [
      { expr: { kind: 'ColumnRef', table: 't0', column: 'name' }, direction: 'asc', nulls: null },
      { expr: { kind: 'ColumnRef', table: 't0', column: 'id' }, direction: 'desc', nulls: null }
    ]
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal' });
  const orderMatch = sql.match(/ORDER BY\s+([\s\S]+)$/i);
  assert.ok(orderMatch, 'should have ORDER BY clause');
  const orderClauses = orderMatch[1].split(',').map(s => s.trim());
  const nameCount = orderClauses.filter(c => /t0\.name/i.test(c)).length;
  assert.equal(nameCount, 1, `t0.name should appear exactly once in ORDER BY, got ${nameCount}`);
});

test('lowerToSQL: DISTINCT ON multi-column inserts only missing prefix entries', () => {
  const plan = {
    root: { kind: 'Table', table: 'log', alias: 't0' },
    projection: { items: [
      { alias: 'cat', expr: { kind: 'ColumnRef', table: 't0', column: 'category' } },
      { alias: 'ts', expr: { kind: 'ColumnRef', table: 't0', column: 'created_at' } }
    ] },
    distinctOn: [
      { kind: 'ColumnRef', table: 't0', column: 'category' },
      { kind: 'ColumnRef', table: 't0', column: 'created_at' }
    ],
    orderBy: [
      { expr: { kind: 'ColumnRef', table: 't0', column: 'category' }, direction: 'asc', nulls: null },
      // created_at intentionally missing — should be inserted at position 1
      { expr: { kind: 'ColumnRef', table: 't0', column: 'id' }, direction: 'desc', nulls: null }
    ]
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal' });
  const orderMatch = sql.match(/ORDER BY\s+([\s\S]+)$/i);
  assert.ok(orderMatch);
  const clauses = orderMatch[1].split(',').map(s => s.trim());
  // category should be first (already matched), created_at inserted second, id third
  assert.match(clauses[0], /t0\.category/i, 'first should be category');
  assert.match(clauses[1], /t0\.created_at/i, 'second should be created_at (inserted)');
  assert.match(clauses[2], /t0\.id/i, 'third should be id');
  const catCount = clauses.filter(c => /t0\.category/i.test(c)).length;
  assert.equal(catCount, 1, 'category should appear exactly once');
});

test('lowerToSQL: DISTINCT ON with reversed orderBy does not duplicate (SR-M3)', () => {
  const plan = {
    root: { kind: 'Table', table: 'log', alias: 't0' },
    projection: { items: [
      { alias: 'cat', expr: { kind: 'ColumnRef', table: 't0', column: 'category' } },
      { alias: 'ts', expr: { kind: 'ColumnRef', table: 't0', column: 'created_at' } }
    ] },
    distinctOn: [
      { kind: 'ColumnRef', table: 't0', column: 'category' },
      { kind: 'ColumnRef', table: 't0', column: 'created_at' }
    ],
    orderBy: [
      // Reversed relative to distinctOn
      { expr: { kind: 'ColumnRef', table: 't0', column: 'created_at' }, direction: 'desc', nulls: null },
      { expr: { kind: 'ColumnRef', table: 't0', column: 'category' }, direction: 'asc', nulls: null }
    ]
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal' });
  const orderMatch = sql.match(/ORDER BY\s+([\s\S]+)$/i);
  assert.ok(orderMatch, 'should have ORDER BY clause');
  const clauses = orderMatch[1].split(',').map(s => s.trim());
  // distinctOn expressions should lead, each appearing exactly once
  assert.match(clauses[0], /t0\.category/i, 'first should be category (from distinctOn)');
  assert.match(clauses[1], /t0\.created_at/i, 'second should be created_at (from distinctOn)');
  const catCount = clauses.filter(c => /t0\.category/i.test(c)).length;
  const tsCount = clauses.filter(c => /t0\.created_at/i.test(c)).length;
  assert.equal(catCount, 1, 'category should appear exactly once');
  assert.equal(tsCount, 1, 'created_at should appear exactly once');
});

test('lowerToSQL: DISTINCT ON preserves DESC direction when expression matches', () => {
  const plan = {
    root: { kind: 'Table', table: 'event', alias: 'e' },
    projection: { items: [
      { alias: 'name', expr: { kind: 'ColumnRef', table: 'e', column: 'name' } }
    ] },
    distinctOn: [{ kind: 'ColumnRef', table: 'e', column: 'name' }],
    orderBy: [
      { expr: { kind: 'ColumnRef', table: 'e', column: 'name' }, direction: 'desc', nulls: 'last' }
    ]
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal' });
  // Expression matches at position 0, so existing DESC NULLS LAST should be preserved
  assert.match(sql, /ORDER BY\s+e\.name\s+DESC\s+NULLS\s+LAST/i, 'should preserve DESC NULLS LAST');
  const orderMatch = sql.match(/ORDER BY\s+([\s\S]+)$/i);
  const clauses = orderMatch[1].split(',').map(s => s.trim());
  const nameCount = clauses.filter(c => /e\.name/i.test(c)).length;
  assert.equal(nameCount, 1, 'name should appear exactly once (not duplicated)');
});
