import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanFromJson } from '../../src/domain/qir/OpPlanBuilder.mjs';

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

