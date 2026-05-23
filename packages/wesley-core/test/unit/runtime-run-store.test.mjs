import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryEventStore } from '../../src/application/MemoryEventStore.mjs';
import {
  inspectRuntimeRunStreams,
  listRuntimeRunReports,
  readRuntimeRunRecord,
  resolveRuntimeRunStream,
  summarizeRuntimeRunDoctor
} from '../../src/application/RuntimeRunStore.mjs';

test('resolveRuntimeRunStream finds a run from its snapshot when transmutation is omitted', () => {
  const store = new MemoryEventStore();
  appendCompletedRun(store, {
    runId: 'run-store-001',
    transmutation: 'null-generator',
    streamId: 'transmutation:null-generator:run-store-001'
  });

  const result = resolveRuntimeRunStream(store, { runId: 'run-store-001' });
  assert.equal(result.streamId, 'transmutation:null-generator:run-store-001');
});

test('resolveRuntimeRunStream fails when a runId maps to multiple streams', () => {
  const store = new MemoryEventStore();
  appendCompletedRun(store, {
    runId: 'run-store-ambiguous',
    transmutation: 'null-generator',
    streamId: 'transmutation:null-generator:run-store-ambiguous'
  });
  appendCompletedRun(store, {
    runId: 'run-store-ambiguous',
    transmutation: 'echo',
    streamId: 'transmutation:echo:run-store-ambiguous'
  });

  assert.throws(
    () => resolveRuntimeRunStream(store, { runId: 'run-store-ambiguous' }),
    (error) => error?.code === 'RUN_AMBIGUOUS'
  );
});

test('readRuntimeRunRecord replays from snapshot plus tail events', () => {
  const store = new MemoryEventStore();
  const streamId = 'transmutation:null-generator:run-store-002';
  appendEvent(store, {
    streamId,
    runId: 'run-store-002',
    transmutation: 'null-generator',
    sequence: 1,
    type: 'RunRequested',
    timestamp: '2026-03-21T18:00:00.000Z',
    idempotencyKey: 'store-002:requested',
    payload: { command: 'transform' }
  });
  appendEvent(store, {
    streamId,
    runId: 'run-store-002',
    transmutation: 'null-generator',
    sequence: 2,
    type: 'ArtifactsMaterialized',
    timestamp: '2026-03-21T18:00:01.000Z',
    idempotencyKey: 'store-002:artifacts',
    payload: { artifactCount: 2 }
  });
  store.writeSnapshot(streamId, {
    schemaVersion: 'runtime-run-snapshot.v1',
    streamId,
    runId: 'run-store-002',
    transmutation: 'null-generator',
    lastSequence: 2,
    eventCount: 2,
    updatedAt: '2026-03-21T18:00:01.000Z',
    run: {
      runId: 'run-store-002',
      transmutation: 'null-generator',
      streamId,
      command: 'transform',
      status: 'running',
      startedAt: '2026-03-21T18:00:00.000Z',
      completedAt: null,
      lastEventAt: '2026-03-21T18:00:01.000Z',
      eventCount: 2,
      artifactCount: 2,
      taskCounts: { started: 0, completed: 0, failed: 0, skipped: 0 },
      dryRun: null,
      verdict: null,
      scores: null,
      failure: null
    }
  });
  appendEvent(store, {
    streamId,
    runId: 'run-store-002',
    transmutation: 'null-generator',
    sequence: 3,
    type: 'ScoresComputed',
    timestamp: '2026-03-21T18:00:02.000Z',
    idempotencyKey: 'store-002:scores',
    payload: { scs: 0.8, tci: 0.7, mri: 0.1 }
  });

  const record = readRuntimeRunRecord(store, streamId, { includeEvents: true });
  assert.equal(record.run.status, 'running');
  assert.equal(record.run.artifactCount, 2);
  assert.equal(record.replay.snapshot.used, true);
  assert.equal(record.tailEvents.length, 1);
  assert.equal(record.events.length, 3);
});

test('inspectRuntimeRunStreams and summarizeRuntimeRunDoctor flag non-terminal runs', () => {
  const store = new MemoryEventStore();
  appendCompletedRun(store, {
    runId: 'run-store-healthy',
    transmutation: 'null-generator',
    streamId: 'transmutation:null-generator:run-store-healthy'
  });
  appendEvent(store, {
    streamId: 'transmutation:null-generator:run-store-running',
    runId: 'run-store-running',
    transmutation: 'null-generator',
    sequence: 1,
    type: 'RunRequested',
    timestamp: '2026-03-21T18:10:00.000Z',
    idempotencyKey: 'store-running:requested',
    payload: { command: 'transform' }
  });

  const streams = inspectRuntimeRunStreams(store, { transmutation: 'null-generator' });
  const summary = summarizeRuntimeRunDoctor(streams);
  const runs = listRuntimeRunReports(store, { transmutation: 'null-generator' });

  assert.equal(streams.length, 2);
  assert.equal(summary.streamCount, 2);
  assert.equal(summary.nonTerminalStreams, 1);
  assert.equal(summary.healthyStreams, 1);
  assert.equal(summary.unhealthyStreams, 1);
  assert.equal(runs[0].runId, 'run-store-running');
});

function appendCompletedRun(store, { runId, transmutation, streamId }) {
  appendEvent(store, {
    streamId,
    runId,
    transmutation,
    sequence: 1,
    type: 'RunRequested',
    timestamp: '2026-03-21T17:55:00.000Z',
    idempotencyKey: `${runId}:requested`,
    payload: { command: 'transform' }
  });
  appendEvent(store, {
    streamId,
    runId,
    transmutation,
    sequence: 2,
    type: 'RunCompleted',
    timestamp: '2026-03-21T17:55:01.000Z',
    idempotencyKey: `${runId}:completed`,
    payload: { command: 'transform' }
  });
}

function appendEvent(
  store,
  { streamId, runId, transmutation, sequence, type, timestamp, idempotencyKey, payload }
) {
  store.append({
    eventId: `${streamId}:${sequence}`,
    streamId,
    runId,
    transmutation,
    sequence,
    type,
    timestamp,
    schemaVersion: '1.0.0',
    causationId: null,
    correlationId: runId,
    idempotencyKey,
    payload
  });
}
