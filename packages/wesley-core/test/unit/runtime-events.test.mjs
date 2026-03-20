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
