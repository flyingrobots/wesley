import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { GENERATED_LEDGER_DIR } from '@wesley/core';
import { GitWarpEventStore } from '../src/adapters/GitWarpEventStore.mjs';

test('GitWarpEventStore appends and reads a stream', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-'));
  try {
    const store = new GitWarpEventStore({
      rootDir: path.join(tempDir, GENERATED_LEDGER_DIR)
    });
    const event = {
      streamId: 'transmutation:legacy-supabase:run-ledger-001',
      sequence: 1,
      runId: 'run-ledger-001',
      transmutation: 'legacy-supabase',
      type: 'RunRequested',
      timestamp: '2026-03-20T03:10:00.000Z',
      payload: { command: 'transform' }
    };

    store.append(event);

    assert.deepEqual(store.readStream(event.streamId), [event]);
    assert.deepEqual(store.listStreams(), [event.streamId]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('GitWarpEventStore persists terminal snapshots and can read stream tails', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-'));
  try {
    const store = new GitWarpEventStore({
      rootDir: path.join(tempDir, GENERATED_LEDGER_DIR)
    });
    const streamId = 'transmutation:legacy-supabase:run-ledger-002';

    store.append({
      streamId,
      sequence: 1,
      runId: 'run-ledger-002',
      transmutation: 'legacy-supabase',
      type: 'RunRequested',
      timestamp: '2026-03-20T06:00:00.000Z',
      payload: { command: 'transform' }
    });
    store.append({
      streamId,
      sequence: 2,
      runId: 'run-ledger-002',
      transmutation: 'legacy-supabase',
      type: 'ArtifactsMaterialized',
      timestamp: '2026-03-20T06:00:01.000Z',
      payload: { artifactCount: 1 }
    });
    store.append({
      streamId,
      sequence: 3,
      runId: 'run-ledger-002',
      transmutation: 'legacy-supabase',
      type: 'RunCompleted',
      timestamp: '2026-03-20T06:00:02.000Z',
      payload: { command: 'transform' }
    });

    const snapshot = store.readSnapshot(streamId);
    assert.ok(snapshot);
    assert.equal(snapshot.lastSequence, 3);
    assert.equal(snapshot.run.status, 'completed');
    assert.deepEqual(store.readStreamSince(streamId, 3), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
