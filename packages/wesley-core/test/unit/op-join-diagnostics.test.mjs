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

