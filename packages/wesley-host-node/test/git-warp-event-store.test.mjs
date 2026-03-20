import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { GitWarpEventStore } from '../src/adapters/GitWarpEventStore.mjs';

test('GitWarpEventStore appends and reads a stream', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wesley-ledger-'));
  try {
    const store = new GitWarpEventStore({
      rootDir: path.join(tempDir, '.wesley/ledger')
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
