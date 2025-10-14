import test from 'node:test';
import assert from 'node:assert/strict';

import { Holmes } from '../src/Holmes.mjs';
import { normalizeWeightConfig } from '../src/weight-config.mjs';

function createHolmes(config) {
  const bundle = {
    sha: 'testsha',
    timestamp: new Date().toISOString(),
    schema: {
      tables: {
        Orders: {
          directives: { '@table': {} },
          fields: {
            id: { directives: { '@primaryKey': {} } },
            amount: { directives: {} }
          }
        }
      }
    },
    evidence: { evidence: { 'col:Orders.id': { sql: [], tests: [] } } },
    scores: {}
  };

  const holmes = new Holmes(bundle);
  holmes.weightConfig = normalizeWeightConfig(config);
  holmes.weightConfigSource = 'test';
  holmes.schemaDirectives = holmes.buildDirectiveIndex(bundle.schema);
  return holmes;
}

test('table wildcard override applies to all table columns', () => {
  const holmes = createHolmes({ overrides: { 'tbl:Orders.*': 11 } });
  const result = holmes.inferWeight('col:Orders.id');
  assert.equal(result.value, 11);
  assert.equal(result.source, 'override tbl:Orders.*');
});

test('directive overrides fallback when applicable', () => {
  const holmes = createHolmes({ directives: { primarykey: 9 } });
  const result = holmes.inferWeight('col:Orders.id');
  assert.equal(result.value, 9);
  assert.equal(result.source, 'directive @primarykey');
});

test('substring override applies when no directive or explicit override', () => {
  const holmes = createHolmes({ substrings: { amount: 7 } });
  const result = holmes.inferWeight('col:Orders.amount');
  assert.equal(result.value, 7);
  assert.equal(result.source, 'substring amount');
});

test('default applies when no rules match', () => {
  const holmes = createHolmes({ default: 4 });
  const result = holmes.inferWeight('col:Orders.unknown');
  assert.equal(result.value, 4);
  assert.equal(result.source, 'default');
});
