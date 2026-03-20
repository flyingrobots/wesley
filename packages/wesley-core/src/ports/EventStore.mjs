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
