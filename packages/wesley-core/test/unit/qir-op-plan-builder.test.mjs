import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanFromJson } from '../../src/domain/qir/OpPlanBuilder.mjs';
import { lowerToSQL } from '../../src/domain/qir/lowerToSQL.mjs';

test('OpPlanBuilder: isNull filter round-trips through lowerToSQL (C1)', () => {
  const op = {
    table: 'account',
    columns: ['id', 'name'],
    filters: [{ column: 'deleted_at', op: 'isNull' }]
  };
  const plan = buildPlanFromJson(op);
  const sql = lowerToSQL(plan);
  assert.ok(sql.includes('IS NULL'), 'SQL must contain IS NULL');
});

test('OpPlanBuilder: IN requires explicit array type', () => {
  const bad = {
    table: 't',
    columns: ['id'],
    filters: [{ column: 'id', op: 'in', param: { name: 'ids' } }]
  };
  assert.throws(() => buildPlanFromJson(bad), /requires an explicit array type/);
});

test('OpPlanBuilder: ILIKE requires explicit text type', () => {
  const bad = {
    table: 't',
    columns: ['id'],
    filters: [{ column: 'name', op: 'ilike', param: { name: 'q' } }]
  };
  assert.throws(() => buildPlanFromJson(bad), /requires an explicit type for ILIKE/);
});

test('OpPlanBuilder: valid IN with text[] passes', () => {
  const good = {
    table: 't',
    columns: ['id'],
    filters: [{ column: 'id', op: 'in', param: { name: 'ids', type: 'text[]' } }]
  };
  const plan = buildPlanFromJson(good);
  assert.ok(plan && plan.root && plan.projection);
});

test('OpPlanBuilder: LIKE requires explicit type', () => {
  const bad = {
    table: 't',
    columns: ['name'],
    filters: [{ column: 'name', op: 'like', param: { name: 'pattern' } }]
  };
  assert.throws(() => buildPlanFromJson(bad), /requires an explicit type for LIKE/);
});

test('OpPlanBuilder: valid LIKE with text passes', () => {
  const good = {
    table: 't',
    columns: ['name'],
    filters: [{ column: 'name', op: 'like', param: { name: 'pattern', type: 'text' } }]
  };
  const plan = buildPlanFromJson(good);
  const sql = lowerToSQL(plan);
  assert.ok(sql.includes('LIKE'), 'SQL must contain LIKE');
});

test('OpPlanBuilder: CONTAINS requires explicit type', () => {
  const bad = {
    table: 't',
    columns: ['data'],
    filters: [{ column: 'data', op: 'contains', param: { name: 'fragment' } }]
  };
  assert.throws(() => buildPlanFromJson(bad), /requires an explicit type for CONTAINS/);
});

test('OpPlanBuilder: valid CONTAINS with jsonb passes', () => {
  const good = {
    table: 't',
    columns: ['data'],
    filters: [{ column: 'data', op: 'contains', param: { name: 'fragment', type: 'jsonb' } }]
  };
  const plan = buildPlanFromJson(good);
  const sql = lowerToSQL(plan);
  assert.ok(sql.includes('@>'), 'SQL must contain @> operator');
});

