import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  DEFAULT_WEIGHT_CONFIG,
  loadWeightConfig,
  normalizeWeightConfig,
  readWeightConfig
} from '../src/weight-config.mjs';

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'weights-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('loadWeightConfig returns defaults when nothing defined', () => {
  withTempDir((dir) => {
    const { config, source } = loadWeightConfig({ cwd: dir, env: {} });
    assert.equal(source, 'defaults');
    assert.deepEqual(config, DEFAULT_WEIGHT_CONFIG);
  });
});

test('loadWeightConfig reads .wesley/weights.json', () => {
  withTempDir((dir) => {
    const weightsDir = join(dir, '.wesley');
    mkdirSync(weightsDir);
    writeFileSync(join(weightsDir, 'weights.json'), JSON.stringify({
      default: 7,
      substrings: { foo: 9 },
      directives: { sensitive: 11 },
      overrides: { 'col:User.email': 13 }
    }));

    const { config, source } = loadWeightConfig({ cwd: dir, env: {} });
    assert.equal(config.default, 7);
    assert.equal(config.substrings.foo, 9);
    assert.equal(config.directives.sensitive, 11);
    assert.equal(config.overrides['col:User.email'], 13);
    assert.ok(source.endsWith('.wesley/weights.json'));
  });
});

test('environment JSON overrides file', () => {
  withTempDir((dir) => {
    const weightsDir = join(dir, '.wesley');
    mkdirSync(weightsDir);
    writeFileSync(join(weightsDir, 'weights.json'), JSON.stringify({ default: 3 }));

    const json = JSON.stringify({ default: 2, substrings: { user: 8 } });
    const { config, source } = loadWeightConfig({ cwd: dir, env: { WESLEY_HOLMES_WEIGHTS: json } });
    assert.equal(source, 'env:WESLEY_HOLMES_WEIGHTS');
    assert.equal(config.default, 2);
    assert.equal(config.substrings.user, 8);
  });
});

test('environment file overrides default path', () => {
  withTempDir((dir) => {
    const custom = join(dir, 'custom-weights.json');
    writeFileSync(custom, JSON.stringify({ default: 6 }));
    const { config, source } = loadWeightConfig({ cwd: dir, env: { WESLEY_HOLMES_WEIGHT_FILE: 'custom-weights.json' } });
    assert.equal(config.default, 6);
    assert.equal(source, `file:${resolve(dir, 'custom-weights.json')}`);
  });
});

test('normalizeWeightConfig handles flat map legacy format', () => {
  const config = normalizeWeightConfig({ password: 9, default: 3 });
  assert.equal(config.substrings.password, 9);
  assert.equal(config.default, 3);
});

test('readWeightConfig throws when required file missing', () => {
  assert.throws(() => readWeightConfig('missing.json', { required: true }));
});
