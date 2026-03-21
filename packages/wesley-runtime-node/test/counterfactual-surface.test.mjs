import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ensureCounterfactualWorkspaceArtifacts } from '../src/index.mjs';

test('ensureCounterfactualWorkspaceArtifacts writes deterministic surface artifacts', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-runtime-node-'));
  mkdirSync(path.join(tempDir, '.wesley'), { recursive: true });
  try {
    writeFileSync(path.join(tempDir, 'schema.graphql'), [
      'type User @wes_table {',
      '  id: ID! @wes_pk',
      '  email: String! @wes_unique',
      '}',
      ''
    ].join('\n'));

    await ensureCounterfactualWorkspaceArtifacts({
      workspaceDir: tempDir,
      bundleDir: '.wesley',
      outDir: 'out',
      schemaPath: 'schema.graphql',
      sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transmutation: 'legacy-supabase'
    });

    const firstBundle = readFileSync(path.join(tempDir, '.wesley', 'bundle.json'), 'utf8');
    const firstPlan = readFileSync(path.join(tempDir, '.wesley', 'plan-report.json'), 'utf8');
    const firstSchema = readFileSync(path.join(tempDir, 'out', 'schema.sql'), 'utf8');

    rmSync(path.join(tempDir, '.wesley', 'bundle.json'));
    rmSync(path.join(tempDir, '.wesley', 'plan-report.json'));
    rmSync(path.join(tempDir, 'out'), { recursive: true, force: true });

    await ensureCounterfactualWorkspaceArtifacts({
      workspaceDir: tempDir,
      bundleDir: '.wesley',
      outDir: 'out',
      schemaPath: 'schema.graphql',
      sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transmutation: 'legacy-supabase'
    });

    assert.equal(readFileSync(path.join(tempDir, '.wesley', 'bundle.json'), 'utf8'), firstBundle);
    assert.equal(readFileSync(path.join(tempDir, '.wesley', 'plan-report.json'), 'utf8'), firstPlan);
    assert.equal(readFileSync(path.join(tempDir, 'out', 'schema.sql'), 'utf8'), firstSchema);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
