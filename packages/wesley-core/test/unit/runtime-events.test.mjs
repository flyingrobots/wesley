import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryEventStore } from '../../src/application/MemoryEventStore.mjs';
import { createRuntimeEventCollector, createRuntimeStreamId } from '../../src/application/RuntimeEvents.mjs';

const fakeClock = {
  now() {
    return '2026-03-19T18:40:00.000Z';
  }
};

test('createRuntimeEventCollector stores events in the backing event store', () => {
  const eventStore = new MemoryEventStore();
  const collector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-store-001',
    transmutation: 'legacy-supabase',
    eventStore
  });

  collector.emit('RunRequested', { command: 'transform' });
  collector.emit('RunCompleted', { command: 'transform' });

  assert.deepEqual(
    collector.events.map(event => event.type),
    ['RunRequested', 'RunCompleted']
  );
  assert.deepEqual(
    eventStore.readStream(collector.streamId).map(event => event.type),
    ['RunRequested', 'RunCompleted']
  );
});

test('createRuntimeEventCollector continues sequence from an existing stream', () => {
  const eventStore = new MemoryEventStore();
  const streamId = createRuntimeStreamId({
    transmutation: 'legacy-supabase',
    runId: 'run-store-002'
  });

  const firstCollector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-store-002',
    transmutation: 'legacy-supabase',
    streamId,
    eventStore
  });
  firstCollector.emit('RunRequested', { command: 'transform' });

  const secondCollector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-store-002',
    transmutation: 'legacy-supabase',
    streamId,
    eventStore
  });
  secondCollector.emit('RunCompleted', { command: 'transform' });

  assert.deepEqual(
    eventStore.readStream(streamId).map(event => event.sequence),
    [1, 2]
  );
});

test('createRuntimeEventCollector injects a crash after a configured event count', () => {
  const eventStore = new MemoryEventStore();
  const collector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-store-003',
    transmutation: 'legacy-supabase',
    eventStore,
    crashAfterEvent: 2
  });

  collector.emit('RunRequested', { command: 'transform' });

  let error;
  try {
    collector.emit('SourcesResolved', { schemaPath: 'schema.graphql' });
  } catch (cause) {
    error = cause;
  }

  assert.ok(error);
  assert.equal(error.code, 'PIPELINE_EXEC_FAILED');
  assert.equal(error.injectedCrash, true);
  assert.equal(error.runId, 'run-store-003');
  assert.deepEqual(
    eventStore.readStream(collector.streamId).map(event => event.type),
    ['RunRequested', 'SourcesResolved']
  );
});

test('createRuntimeEventCollector persists a terminal snapshot in the backing event store', () => {
  const eventStore = new MemoryEventStore();
  const collector = createRuntimeEventCollector({
    clock: fakeClock,
    runId: 'run-store-004',
    transmutation: 'legacy-supabase',
    eventStore
  });

  collector.emit('RunRequested', { command: 'transform' });
  collector.emit('ArtifactsMaterialized', { artifactCount: 2 });
  collector.emit('RunCompleted', { command: 'transform' });

  const snapshot = eventStore.readSnapshot(collector.streamId);
  assert.ok(snapshot);
  assert.equal(snapshot.runId, 'run-store-004');
  assert.equal(snapshot.lastSequence, 3);
  assert.equal(snapshot.run.status, 'completed');
  assert.equal(snapshot.run.artifactCount, 2);
});
