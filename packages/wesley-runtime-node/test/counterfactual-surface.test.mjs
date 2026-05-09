import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  collectCounterfactualSurfaceModel,
  ensureCounterfactualWorkspaceArtifacts
} from '../src/index.mjs';

test('generic counterfactual surface collects existing artifacts without synthesizing database output', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'wesley-runtime-node-'));
  try {
    mkdirSync(path.join(tempDir, '.wesley-cache'), { recursive: true });
    mkdirSync(path.join(tempDir, 'out'), { recursive: true });
    writeFileSync(path.join(tempDir, '.wesley-cache', 'bundle.json'), JSON.stringify({ ok: true }));
    writeFileSync(path.join(tempDir, 'out', 'schema.json'), JSON.stringify({ tables: [] }));

    assert.equal(await ensureCounterfactualWorkspaceArtifacts({ workspaceDir: tempDir }), false);

    const model = await collectCounterfactualSurfaceModel({
      workspaceDir: tempDir,
      bundleDir: '.wesley-cache',
      outDir: 'out'
    });

    assert.equal(model.summary.evidenceCount, 1);
    assert.equal(model.summary.artifactCount, 1);
    assert.ok(model.nodeSpecs.some(spec => spec.id === 'evidence:bundle'));
    assert.ok(model.nodeSpecs.some(spec => spec.id === 'artifact:out/schema.json'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
