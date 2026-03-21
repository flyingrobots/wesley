import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRuntimeEventToSnapshot,
  buildRuntimeRunSnapshot,
  createRuntimeRunSnapshot
} from '../../src/application/RuntimeRunSnapshot.mjs';

test('buildRuntimeRunSnapshot summarizes a completed stream into a disposable cache', () => {
  const snapshot = buildRuntimeRunSnapshot([
    {
      streamId: 'transmutation:legacy-supabase:run-snapshot-001',
      sequence: 1,
      runId: 'run-snapshot-001',
      transmutation: 'legacy-supabase',
      type: 'RunRequested',
      timestamp: '2026-03-20T05:00:00.000Z',
      payload: { command: 'transform' }
    },
    {
      streamId: 'transmutation:legacy-supabase:run-snapshot-001',
      sequence: 2,
      runId: 'run-snapshot-001',
      transmutation: 'legacy-supabase',
      type: 'ArtifactsMaterialized',
      timestamp: '2026-03-20T05:00:01.000Z',
      payload: { artifactCount: 2 }
    },
    {
      streamId: 'transmutation:legacy-supabase:run-snapshot-001',
      sequence: 3,
      runId: 'run-snapshot-001',
      transmutation: 'legacy-supabase',
      type: 'RunCompleted',
      timestamp: '2026-03-20T05:00:02.000Z',
      payload: { command: 'transform' }
    }
  ]);

  assert.equal(snapshot.streamId, 'transmutation:legacy-supabase:run-snapshot-001');
  assert.equal(snapshot.runId, 'run-snapshot-001');
  assert.equal(snapshot.transmutation, 'legacy-supabase');
  assert.equal(snapshot.lastSequence, 3);
  assert.equal(snapshot.eventCount, 3);
  assert.equal(snapshot.updatedAt, '2026-03-20T05:00:02.000Z');
  assert.equal(snapshot.run.command, 'transform');
  assert.equal(snapshot.run.status, 'completed');
  assert.equal(snapshot.run.artifactCount, 2);
});

test('applyRuntimeEventToSnapshot advances an existing snapshot without mutating the original', () => {
  const initial = createRuntimeRunSnapshot({
    streamId: 'transmutation:legacy-supabase:run-snapshot-002',
    runId: 'run-snapshot-002',
    transmutation: 'legacy-supabase'
  });

  const requested = applyRuntimeEventToSnapshot(initial, {
    streamId: 'transmutation:legacy-supabase:run-snapshot-002',
    sequence: 1,
    runId: 'run-snapshot-002',
    transmutation: 'legacy-supabase',
    type: 'RunRequested',
    timestamp: '2026-03-20T05:01:00.000Z',
    payload: { command: 'plan', dryRun: true }
  });

  const completed = applyRuntimeEventToSnapshot(requested, {
    streamId: 'transmutation:legacy-supabase:run-snapshot-002',
    sequence: 2,
    runId: 'run-snapshot-002',
    transmutation: 'legacy-supabase',
    type: 'RunCompleted',
    timestamp: '2026-03-20T05:01:01.000Z',
    payload: { command: 'plan', dryRun: true }
  });

  assert.equal(initial.eventCount, 0);
  assert.equal(initial.run.status, 'pending');
  assert.equal(requested.run.command, 'plan');
  assert.equal(requested.run.status, 'pending');
  assert.equal(completed.run.status, 'completed');
  assert.equal(completed.lastSequence, 2);
  assert.equal(completed.eventCount, 2);
});
