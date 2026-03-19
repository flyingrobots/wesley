export const RUNTIME_EVENT_SCHEMA_VERSION = '1.0.0';

export function createRuntimeStreamId({ transmutation, runId }) {
  return `transmutation:${transmutation}:${runId}`;
}

export function createRuntimeEventCollector({
  clock,
  runId,
  transmutation,
  streamId = createRuntimeStreamId({ transmutation, runId }),
  correlationId = runId
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

  let sequence = 0;
  const events = [];

  return {
    runId,
    transmutation,
    streamId,
    events,
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
      events.push(event);
      return event;
    }
  };
}

function normalizeTimestamp(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.toISOString === 'function') return value.toISOString();
  return new Date().toISOString();
}
