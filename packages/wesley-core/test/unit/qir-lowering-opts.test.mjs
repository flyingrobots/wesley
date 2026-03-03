import test from 'node:test';
import assert from 'node:assert/strict';

import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';

test('lowerToSQL: recursive Subquery preserves pkResolver from opts', () => {
  const inner = {
    root: { kind: 'Table', table: 'membership', alias: 'm' },
    projection: { items: [{ alias: 'uid', expr: { kind: 'ColumnRef', table: 'm', column: 'user_id' } }] },
    orderBy: [{ expr: { kind: 'ColumnRef', table: 'm', column: 'name' }, direction: 'asc' }],
  };
  const plan = {
    root: { kind: 'Subquery', plan: inner, alias: 'sq' },
    projection: { items: [{ alias: 'uid', expr: { kind: 'ColumnRef', table: 'sq', column: 'uid' } }] },
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
    projection: { items: [{ alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } }] },
  };
  const plan = {
    root: { kind: 'Subquery', plan: inner, alias: 'sq' },
    projection: { items: [{ alias: 'id', expr: { kind: 'ColumnRef', table: 'sq', column: 'id' } }] },
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'strict' });
  // Inner subquery idents should be quoted (strict policy)
  assert.match(sql, /"t0"\."id"/, 'inner subquery should use strict quoting');
});

test('lowerToSQL: Lateral subquery preserves opts through recursion', () => {
  const lateral = {
    root: { kind: 'Table', table: 'post', alias: 'p' },
    projection: { items: [{ alias: 'title', expr: { kind: 'ColumnRef', table: 'p', column: 'title' } }] },
  };
  const plan = {
    root: {
      kind: 'Join',
      left: { kind: 'Table', table: 'author', alias: 'a' },
      right: { kind: 'Lateral', plan: lateral, alias: 'lp' },
      joinType: 'LEFT',
      on: { kind: 'Compare', op: 'eq', left: { kind: 'Literal', value: true }, right: { kind: 'Literal', value: true } },
    },
    projection: { items: [{ alias: 'title', expr: { kind: 'ColumnRef', table: 'lp', column: 'title' } }] },
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
      on: { kind: 'Compare', op: 'eq', left: { kind: 'Literal', value: true }, right: { kind: 'Literal', value: true } },
    },
    projection: { items: [{ alias: 'id', expr: { kind: 'ColumnRef', table: 'a', column: 'id' } }] },
  };
  assert.throws(() => lowerToSQL(plan), /unsupported join type/i);
});

test('lowerToSQL: DISTINCT ON does not duplicate matching leading orderBy', () => {
  const plan = {
    root: { kind: 'Table', table: 'org', alias: 't0' },
    projection: { items: [
      { alias: 'name', expr: { kind: 'ColumnRef', table: 't0', column: 'name' } },
      { alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } },
    ] },
    distinctOn: [{ kind: 'ColumnRef', table: 't0', column: 'name' }],
    orderBy: [
      { expr: { kind: 'ColumnRef', table: 't0', column: 'name' }, direction: 'asc', nulls: null },
      { expr: { kind: 'ColumnRef', table: 't0', column: 'id' }, direction: 'desc', nulls: null },
    ],
  };
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal' });
  // The distinctOn expr matches the first orderBy item, so it should NOT be duplicated
  const orderMatch = sql.match(/ORDER BY\s+([\s\S]+)$/i);
  assert.ok(orderMatch, 'should have ORDER BY clause');
  const orderClauses = orderMatch[1].split(',').map(s => s.trim());
  // Should be: t0.name ASC, t0.id DESC, t0.id ASC (tie-breaker) — not t0.name ASC, t0.name ASC, ...
  const nameCount = orderClauses.filter(c => /t0\.name/i.test(c)).length;
  assert.equal(nameCount, 1, `t0.name should appear exactly once in ORDER BY, got ${nameCount}`);
});
