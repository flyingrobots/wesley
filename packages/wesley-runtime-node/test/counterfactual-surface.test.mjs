import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { lineSpanForContent } from '@wesley/core';

import { ensureCounterfactualWorkspaceArtifacts } from '../src/index.mjs';

test('ensureCounterfactualWorkspaceArtifacts writes deterministic surface artifacts', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-runtime-node-'));
  mkdirSync(path.join(tempDir, '.wesley-cache'), { recursive: true });
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
      bundleDir: '.wesley-cache',
      outDir: 'out',
      schemaPath: 'schema.graphql',
      sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transmutation: 'legacy-supabase'
    });

    const firstBundle = readFileSync(path.join(tempDir, '.wesley-cache', 'bundle.json'), 'utf8');
    const firstPlan = readFileSync(path.join(tempDir, '.wesley-cache', 'plan-report.json'), 'utf8');
    const firstSchema = readFileSync(path.join(tempDir, 'out', 'schema.sql'), 'utf8');
    const bundle = JSON.parse(firstBundle);
    assert.equal(bundle.bundleVersion, '2.0.0');
    assert.ok(bundle.scores.scores.scs > 0);
    assert.ok(bundle.scores.scores.tci > 0);
    assert.equal(bundle.scores.scores.mri, 0);

    for (const entry of Object.values(bundle.evidence.evidence)) {
      for (const locations of Object.values(entry)) {
        for (const location of locations) {
          assert.equal(path.isAbsolute(location.file), false, 'counterfactual evidence paths should remain workspace-relative');
        }
      }
    }

    for (const [uid, entry] of Object.entries(bundle.evidence.evidence)) {
      if (!Array.isArray(entry.generated) || entry.generated.length === 0) continue;
      const location = entry.generated[0];
      const absolutePath = path.join(tempDir, location.file);
      assert.equal(
        location.lines,
        lineSpanForContent(readFileSync(absolutePath, 'utf8')),
        `${uid} should cite the exact generated file span`
      );
    }

    rmSync(path.join(tempDir, '.wesley-cache', 'bundle.json'));
    rmSync(path.join(tempDir, '.wesley-cache', 'plan-report.json'));
    rmSync(path.join(tempDir, 'out'), { recursive: true, force: true });

    await ensureCounterfactualWorkspaceArtifacts({
      workspaceDir: tempDir,
      bundleDir: '.wesley-cache',
      outDir: 'out',
      schemaPath: 'schema.graphql',
      sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transmutation: 'legacy-supabase'
    });

    assert.equal(readFileSync(path.join(tempDir, '.wesley-cache', 'bundle.json'), 'utf8'), firstBundle);
    assert.equal(readFileSync(path.join(tempDir, '.wesley-cache', 'plan-report.json'), 'utf8'), firstPlan);
    assert.equal(readFileSync(path.join(tempDir, 'out', 'schema.sql'), 'utf8'), firstSchema);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
