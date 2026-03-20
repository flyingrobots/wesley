import { assertEventStorePort } from '../ports/EventStore.mjs';
import { MemoryEventStore } from './MemoryEventStore.mjs';

export const RUNTIME_EVENT_SCHEMA_VERSION = '1.0.0';

export function createRuntimeStreamId({ transmutation, runId }) {
  return `transmutation:${transmutation}:${runId}`;
}

export function createRuntimeEventCollector({
  clock,
  runId,
  transmutation,
  streamId = createRuntimeStreamId({ transmutation, runId }),
  correlationId = runId,
  eventStore = new MemoryEventStore(),
  crashAfterEvent = null
}) {
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('createRuntimeEventCollector requires a clock with now()');
  }
  if (typeof runId !== 'string' || !runId.trim()) {
    throw new TypeError('createRuntimeEventCollector requires a non-empty runId');
  }
  if (typeof transmutation !== 'string' || !transmutation.trim()) {
    throw new TypeError('createRuntimeEventCollector requires a non-empty transmutation');
  }
  assertEventStorePort(eventStore);
  const existingEvents = eventStore.readStream(streamId);
  let sequence = existingEvents.at(-1)?.sequence ?? 0;

  return {
    runId,
    transmutation,
    streamId,
    eventStore,
    get events() {
      return eventStore.readStream(streamId);
    },
    emit(type, payload = {}, metadata = {}) {
      sequence += 1;
      const event = {
        eventId: `${streamId}:${sequence}`,
        type,
        streamId,
        sequence,
        schemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
        timestamp: normalizeTimestamp(clock.now()),
        causationId: metadata.causationId ?? null,
        correlationId: metadata.correlationId ?? correlationId,
        idempotencyKey: metadata.idempotencyKey ?? `${streamId}:${type}:${sequence}`,
        runId,
        transmutation,
        payload
      };
      const appended = eventStore.append(event);
      if (shouldInjectCrash(crashAfterEvent, sequence)) {
        throw buildInjectedCrashError({
          crashAfterEvent,
          eventStore,
          streamId,
          runId,
          transmutation
        });
      }
      return appended;
    }
  };
}

function shouldInjectCrash(crashAfterEvent, sequence) {
  return Number.isInteger(crashAfterEvent) && crashAfterEvent > 0 && sequence === crashAfterEvent;
}

function buildInjectedCrashError({ crashAfterEvent, eventStore, streamId, runId, transmutation }) {
  const error = new Error(`Injected crash after event ${crashAfterEvent} for stream ${streamId}.`);
  error.name = 'InjectedRuntimeCrashError';
  error.code = 'PIPELINE_EXEC_FAILED';
  error.injectedCrash = true;
  error.runId = runId;
  error.transmutation = transmutation;
  error.streamId = streamId;
  error.events = eventStore.readStream(streamId);
  return error;
}

function normalizeTimestamp(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.toISOString === 'function') return value.toISOString();
  return new Date().toISOString();
}
