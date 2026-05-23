import { EventStorePort } from '../ports/EventStore.mjs';
import { buildRuntimeRunSnapshot } from './RuntimeRunSnapshot.mjs';

export class MemoryEventStore extends EventStorePort {
  constructor() {
    super();
    this._streams = new Map();
    this._snapshots = new Map();
  }

  append(event) {
    if (!event || typeof event !== 'object') {
      throw new TypeError('MemoryEventStore.append() requires an event object');
    }
    if (typeof event.streamId !== 'string' || !event.streamId.trim()) {
      throw new TypeError('MemoryEventStore.append() requires a non-empty event.streamId');
    }

    const streamId = event.streamId;
    const stream = this._streams.get(streamId);
    const existing = findExistingByIdempotencyKey(stream, event.idempotencyKey);
    if (existing) {
      return existing;
    }

    if (stream) {
      stream.push(event);
    } else {
      this._streams.set(streamId, [event]);
    }
    if (isTerminalRuntimeEvent(event.type)) {
      this.writeSnapshot(streamId, buildRuntimeRunSnapshot(this.readStream(streamId)));
    }
    return event;
  }

  readStream(streamId) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('MemoryEventStore.readStream() requires a non-empty streamId');
    }
    return [...(this._streams.get(streamId) || [])];
  }

  listStreams() {
    return [...this._streams.keys()];
  }

  readStreamSince(streamId, afterSequence = 0) {
    return this.readStream(streamId).filter((event) => {
      return Number.isInteger(event?.sequence) ? event.sequence > afterSequence : true;
    });
  }

  readSnapshot(streamId) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('MemoryEventStore.readSnapshot() requires a non-empty streamId');
    }
    const snapshot = this._snapshots.get(streamId);
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  writeSnapshot(streamId, snapshot) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('MemoryEventStore.writeSnapshot() requires a non-empty streamId');
    }
    const cloned = cloneSnapshot(snapshot);
    this._snapshots.set(streamId, cloned);
    return cloneSnapshot(cloned);
  }
}

function findExistingByIdempotencyKey(stream, idempotencyKey) {
  if (!Array.isArray(stream)) {
    return null;
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return null;
  }
  return stream.find((entry) => entry?.idempotencyKey === idempotencyKey) || null;
}

function isTerminalRuntimeEvent(type) {
  return type === 'RunCompleted' || type === 'RunFailed' || type === 'RunCancelled';
}

function cloneSnapshot(snapshot) {
  return snapshot ? JSON.parse(JSON.stringify(snapshot)) : snapshot;
}
