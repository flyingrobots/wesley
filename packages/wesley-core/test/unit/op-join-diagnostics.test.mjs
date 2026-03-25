import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanFromJson } from '../../src/domain/qir/OpPlanBuilder.mjs';

test('OpPlanBuilder: ambiguous unqualified join refs throw with hint', () => {
  const op = {
    name: 'bad_join',
    table: 'a',
    joins: [
      { table: 'b', alias: 'b', on: { left: 'id', right: 'b.id' } }
    ]
  };
  assert.throws(() => buildPlanFromJson(op), /Ambiguous join reference/);
});

test('OpPlanBuilder: qualified dot-notation refs do NOT throw', () => {
  const op = {
    name: 'good_join',
    table: 'a',
    joins: [
      { table: 'b', alias: 'b', on: { left: 't0.id', right: 'b.a_id' } }
    ]
  };
  const plan = buildPlanFromJson(op);
  assert.ok(plan.root, 'Plan should build successfully');
});

test('OpPlanBuilder: object-form refs do NOT throw', () => {
  const op = {
    name: 'obj_join',
    table: 'a',
    joins: [
      { table: 'b', alias: 'b', on: { left: { table: 't0', column: 'id' }, right: { table: 'b', column: 'a_id' } } }
    ]
  };
  const plan = buildPlanFromJson(op);
  assert.ok(plan.root, 'Plan should build successfully');
});
