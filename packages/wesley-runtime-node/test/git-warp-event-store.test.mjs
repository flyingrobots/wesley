import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { GitWarpEventStore, resolveLedgerRootDir } from '../src/index.mjs';
import { GENERATED_LEDGER_DIR } from '@wesley/core';

test('GitWarpEventStore appends and reads a stream', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-'));

  const store = new GitWarpEventStore({
    rootDir: path.join(tempDir, GENERATED_LEDGER_DIR)
  });

  store.append({
    streamId: 'transmutation:legacy-supabase:run-ledger-001',
    sequence: 1,
    runId: 'run-ledger-001',
    transmutation: 'legacy-supabase',
    eventId: 'transmutation:legacy-supabase:run-ledger-001:1',
    type: 'RunRequested',
    idempotencyKey: 'ledger:001:1',
    payload: { command: 'transform' }
  });

  const events = store.readStream('transmutation:legacy-supabase:run-ledger-001');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'RunRequested');
});

test('GitWarpEventStore persists terminal snapshots and can read stream tails', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-'));

  const store = new GitWarpEventStore({
    rootDir: path.join(tempDir, GENERATED_LEDGER_DIR)
  });
  const streamId = 'transmutation:legacy-supabase:run-ledger-002';

  store.append({
    streamId,
    sequence: 1,
    runId: 'run-ledger-002',
    transmutation: 'legacy-supabase',
    eventId: `${streamId}:1`,
    type: 'RunRequested',
    idempotencyKey: 'ledger:002:1',
    payload: { command: 'transform' }
  });
  store.append({
    streamId,
    sequence: 2,
    runId: 'run-ledger-002',
    transmutation: 'legacy-supabase',
    eventId: `${streamId}:2`,
    type: 'ArtifactsMaterialized',
    idempotencyKey: 'ledger:002:2',
    payload: { artifactCount: 2 }
  });
  store.append({
    streamId,
    sequence: 3,
    runId: 'run-ledger-002',
    transmutation: 'legacy-supabase',
    eventId: `${streamId}:3`,
    type: 'RunCompleted',
    idempotencyKey: 'ledger:002:3',
    payload: { command: 'transform' }
  });

  const snapshot = store.readSnapshot(streamId);
  assert.ok(snapshot, 'snapshot should be written for terminal stream');
  assert.equal(snapshot.lastSequence, 3);
  assert.equal(snapshot.run.status, 'completed');

  const tail = store.readStreamSince(streamId, 2);
  assert.equal(tail.length, 1);
  assert.equal(tail[0].type, 'RunCompleted');
});

test('resolveLedgerRootDir respects env and repo config', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-root-'));
  const configured = path.join(tempDir, 'custom-ledger');
  writeFileSync(
    path.join(tempDir, 'wesley.config.mjs'),
    'export default { ledger: { repoPath: "./custom-ledger" } };'
  );

  assert.equal(
    await resolveLedgerRootDir({ repoRoot: tempDir }),
    configured
  );

  assert.equal(
    await resolveLedgerRootDir({
      repoRoot: tempDir,
      env: { ...process.env, WESLEY_LEDGER_PATH: './env-ledger' }
    }),
    path.join(tempDir, 'env-ledger')
  );

  assert.ok(existsSync(path.join(tempDir, 'wesley.config.mjs')));
  assert.equal(readFileSync(path.join(tempDir, 'wesley.config.mjs'), 'utf8').includes('custom-ledger'), true);
});

test('resolveLedgerRootDir defaults to .wesley-cache/ledger when no override exists', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-default-'));

  assert.equal(
    await resolveLedgerRootDir({ repoRoot: tempDir, configPath: 'missing.config.mjs', env: {} }),
    path.join(tempDir, GENERATED_LEDGER_DIR)
  );
});
