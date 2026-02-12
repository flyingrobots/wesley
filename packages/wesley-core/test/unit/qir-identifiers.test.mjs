import test from 'node:test';
import assert from 'node:assert/strict';

import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';

// Minimal QIR-shaped plan without importing Nodes to keep this lightweight
const planBase = () => ({
  root: { kind: 'Table', table: 'organization', alias: 't0' },
  projection: { items: [ { alias: 'id', expr: { kind: 'ColumnRef', table: 't0', column: 'id' } } ] },
  orderBy: [],
  limit: null,
  offset: null,
});

test('ident policy minimal: quotes only when needed', () => {
  const plan = planBase();
  const sql = lowerToSQL(plan, null, { identPolicy: 'minimal' });
  assert.ok(sql.includes('FROM organization t0'));
});

test('ident policy strict: always quotes idents and validates', () => {
  const plan = planBase();
  const sql = lowerToSQL(plan, null, { identPolicy: 'strict' });
  assert.ok(sql.includes('FROM "organization" "t0"'));
});

test('ident policy strict: rejects invalid identifier', () => {
  const bad = planBase();
  bad.root.table = 'org-anization';
  assert.throws(() => lowerToSQL(bad, null, { identPolicy: 'strict' }), /Invalid SQL identifier/);
});

