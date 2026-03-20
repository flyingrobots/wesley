import test from 'node:test';
import assert from 'node:assert/strict';

import { replayRuntimeRun } from '../../src/application/RuntimeRunReplay.mjs';

test('replayRuntimeRun rehydrates a valid completed run', () => {
  const events = [
    {
      eventId: 'transmutation:legacy-supabase:run-replay-001:1',
      type: 'RunRequested',
      streamId: 'transmutation:legacy-supabase:run-replay-001',
      sequence: 1,
      schemaVersion: '1.0.0',
      timestamp: '2026-03-20T03:20:00.000Z',
      causationId: null,
      correlationId: 'run-replay-001',
      idempotencyKey: 'legacy-supabase:transform:requested',
      runId: 'run-replay-001',
      transmutation: 'legacy-supabase',
      payload: { command: 'transform' }
    },
    {
      eventId: 'transmutation:legacy-supabase:run-replay-001:2',
      type: 'ArtifactsMaterialized',
      streamId: 'transmutation:legacy-supabase:run-replay-001',
      sequence: 2,
      schemaVersion: '1.0.0',
      timestamp: '2026-03-20T03:20:01.000Z',
      causationId: null,
      correlationId: 'run-replay-001',
      idempotencyKey: 'legacy-supabase:transform:artifacts',
      runId: 'run-replay-001',
      transmutation: 'legacy-supabase',
      payload: { artifactCount: 2 }
    },
    {
      eventId: 'transmutation:legacy-supabase:run-replay-001:3',
      type: 'RunCompleted',
      streamId: 'transmutation:legacy-supabase:run-replay-001',
      sequence: 3,
      schemaVersion: '1.0.0',
      timestamp: '2026-03-20T03:20:02.000Z',
      causationId: null,
      correlationId: 'run-replay-001',
      idempotencyKey: 'legacy-supabase:transform:completed',
      runId: 'run-replay-001',
      transmutation: 'legacy-supabase',
      payload: { command: 'transform' }
    }
  ];

  const result = replayRuntimeRun(events);

  assert.equal(result.run.runId, 'run-replay-001');
  assert.equal(result.run.status, 'completed');
  assert.equal(result.run.artifactCount, 2);
  assert.equal(result.replay.appliedEventCount, 3);
  assert.equal(result.replay.terminal, true);
  assert.equal(result.replay.integrity.valid, true);
  assert.deepEqual(result.replay.integrity.issues, []);
});

test('replayRuntimeRun reports stream integrity issues', () => {
  const events = [
    {
      eventId: 'transmutation:legacy-supabase:run-replay-002:2',
      type: 'RunRequested',
      streamId: 'transmutation:legacy-supabase:run-replay-002',
      sequence: 2,
      schemaVersion: '1.0.0',
      timestamp: '2026-03-20T03:21:00.000Z',
      causationId: null,
      correlationId: 'run-replay-002',
      idempotencyKey: 'legacy-supabase:transform:requested',
      runId: 'run-replay-002',
      transmutation: 'legacy-supabase',
      payload: { command: 'transform' }
    },
    {
      eventId: 'transmutation:nope:run-replay-002:4',
      type: 'RunFailed',
      streamId: 'transmutation:nope:run-replay-002',
      sequence: 4,
      schemaVersion: '1.0.0',
      timestamp: '2026-03-20T03:21:01.000Z',
      causationId: null,
      correlationId: 'run-replay-002',
      idempotencyKey: 'nope:transform:failed',
      runId: 'run-replay-002',
      transmutation: 'nope',
      payload: { code: 'UNKNOWN_TRANSMUTATION', message: 'bad transmutation' }
    }
  ];

  const result = replayRuntimeRun(events, {
    runId: 'run-replay-002',
    transmutation: 'legacy-supabase',
    streamId: 'transmutation:legacy-supabase:run-replay-002'
  });

  assert.equal(result.run.status, 'failed');
  assert.equal(result.replay.terminal, true);
  assert.equal(result.replay.integrity.valid, false);
  assert.deepEqual(
    result.replay.integrity.issues.map(issue => issue.code),
    ['SEQUENCE_START', 'SEQUENCE_GAP', 'STREAM_MISMATCH', 'TRANSMUTATION_MISMATCH', 'SEQUENCE_GAP']
  );
});
