import test from 'node:test';
import assert from 'node:assert/strict';

import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';

test('lowerToSQL: pkResolver supplies non-id tie-breaker', () => {
  const plan = {
    root: { kind: 'Table', table: 'thing', alias: 't0' },
    projection: { items: [ { alias: 'name', expr: { kind: 'ColumnRef', table: 't0', column: 'name' } } ] },
    orderBy: [ { expr: { kind: 'ColumnRef', table: 't0', column: 'name' }, direction: 'asc' } ],
    limit: null,
    offset: null,
  };
  const pkResolver = () => ({ kind: 'ColumnRef', table: 't0', column: 'uuid' });
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal', pkResolver });
  assert.match(sql, /ORDER BY\s+t0\.name\s+ASC\s*,\s*t0\.uuid\s+ASC/);
});

