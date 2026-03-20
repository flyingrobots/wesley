import { EventStorePort } from '../ports/EventStore.mjs';

export class MemoryEventStore extends EventStorePort {
  constructor() {
    super();
    this._streams = new Map();
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
    if (stream) {
      stream.push(event);
    } else {
      this._streams.set(streamId, [event]);
    }
    return event;
  }

  readStream(streamId) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('MemoryEventStore.readStream() requires a non-empty streamId');
    }
    return [...(this._streams.get(streamId) || [])];
  }
}
