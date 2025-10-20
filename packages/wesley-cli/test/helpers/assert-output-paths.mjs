#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildOutputPathMap, resolveFilePath, materializeArtifacts } from '../../src/utils/output-paths.mjs';

const [scenario] = process.argv.slice(2);

switch (scenario) {
  case 'defaults': {
    const map = buildOutputPathMap({}, 'out');
    assert.equal(map.baseDir, 'out');
    assert.equal(map.ddl, 'out');
    assert.equal(map.rls, 'out');
    assert.equal(map.pgtap, 'out/tests');
    assert.equal(map.models, 'out/models');
    assert.equal(map.zod, 'out/zod');
    assert.equal(map.ops, 'out/ops');
    assert.equal(map.bundleDir, '.wesley');
    assert.equal(map.migrationsDir, 'out/migrations');
    break;
  }
  case 'overrides': {
    const map = buildOutputPathMap(
      {
        output: 'build',
        bundle: '.bundle',
        migrations: 'db/migrations',
        artifacts: {
          ddl: 'sql',
          pgtap: 'qa/tests',
          ops: 'ops/sql'
        }
      },
      undefined
    );
    assert.equal(map.baseDir, 'build');
    assert.equal(map.ddl, 'build/sql');
    assert.equal(map.pgtap, 'build/qa/tests');
    assert.equal(map.ops, 'build/ops/sql');
    assert.equal(map.bundleDir, '.bundle');
    assert.equal(map.migrationsDir, 'build/db/migrations');
    const resolved = resolveFilePath(map.ddl, 'schema.sql');
    assert.equal(resolved, 'build/sql/schema.sql');
    const absolute = resolveFilePath(map.ddl, '/tmp/schema.sql');
    assert.equal(absolute, '/tmp/schema.sql');
    break;
  }
  case 'materialize': {
    const map = buildOutputPathMap(
      {
        output: 'out',
        artifacts: { models: 'types/models' }
      },
      undefined
    );
    const artifacts = materializeArtifacts(
      [
        { name: 'schema.sql', content: '-- schema' },
        { name: 'rls.sql', content: '-- rls' }
      ],
      'ddl',
      map
    );
    assert.equal(artifacts.length, 2);
    assert.equal(artifacts[0].path, 'out/schema.sql');
    assert.equal(artifacts[1].path, 'out/rls.sql');
    assert.equal(artifacts[0].category, 'ddl');
    const models = materializeArtifacts([{ name: 'product.ts', content: '// model' }], 'models', map);
    assert.equal(models[0].path, 'out/types/models/product.ts');
    const fallback = materializeArtifacts([{ name: 'custom.txt', content: 'data' }], 'unknown', map);
    assert.equal(fallback[0].path, 'out/custom.txt');
    break;
  }
  default:
    throw new Error(`Unknown scenario "${scenario}"`);
}
