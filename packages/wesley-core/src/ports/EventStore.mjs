/**
 * EventStorePort - append-only runtime event storage.
 *
 * This starts as a synchronous in-process port because the current runtime
 * emits events inline during command execution. Durable adapters can sit
 * behind the same shape later, as long as they preserve ordered append and
 * stream reads.
 */
export class EventStorePort {
  /**
   * Append a single event to the store.
   * @param {object} _event
   * @returns {object}
   */
  append(_event) {
    throw new Error('EventStorePort.append() must be implemented');
  }

  /**
   * Read one event stream in append order.
   * @param {string} _streamId
   * @returns {object[]}
   */
  readStream(_streamId) {
    throw new Error('EventStorePort.readStream() must be implemented');
  }

  /**
   * Read one event stream after a specific sequence number.
   * Default implementation derives from readStream().
   * @param {string} streamId
   * @param {number} afterSequence
   * @returns {object[]}
   */
  readStreamSince(streamId, afterSequence = 0) {
    return this.readStream(streamId).filter((event) => {
      return Number.isInteger(event?.sequence) ? event.sequence > afterSequence : true;
    });
  }

  /**
   * Read a cached snapshot for a stream, if available.
   * Snapshots are disposable caches and may be missing.
   * @param {string} _streamId
   * @returns {object|null}
   */
  readSnapshot(_streamId) {
    return null;
  }

  /**
   * Persist a cached snapshot for a stream.
   * Default implementation is a no-op.
   * @param {string} _streamId
   * @param {object} snapshot
   * @returns {object}
   */
  writeSnapshot(_streamId, snapshot) {
    return snapshot;
  }
}

export function assertEventStorePort(store) {
  if (!store || typeof store !== 'object') {
    throw new TypeError('Event store must be a non-null object');
  }
  if (typeof store.append !== 'function') {
    throw new TypeError('Event store must implement append(event)');
  }
  if (typeof store.readStream !== 'function') {
    throw new TypeError('Event store must implement readStream(streamId)');
  }
  return store;
}
