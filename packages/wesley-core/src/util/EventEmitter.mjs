function normalizeEvent(eventOrType, payload) {
  if (typeof eventOrType === 'string') {
    return { eventType: eventOrType, deliveredPayload: payload };
  }

  return {
    eventType: eventOrType?.type,
    deliveredPayload: payload === undefined ? eventOrType : payload
  };
}

export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(eventType, listener) {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, []);
    }

    this._listeners.get(eventType).push(listener);
    return this;
  }

  addListener(eventType, listener) {
    return this.on(eventType, listener);
  }

  once(eventType, listener) {
    const wrapped = (payload) => {
      this.off(eventType, wrapped);
      return listener(payload);
    };
    wrapped.__originalListener = listener;
    return this.on(eventType, wrapped);
  }

  off(eventType, listener) {
    const listeners = this._listeners.get(eventType);
    if (!listeners || listeners.length === 0) {
      return this;
    }

    const filtered = listeners.filter(
      (registered) => registered !== listener && registered.__originalListener !== listener
    );

    if (filtered.length === 0) {
      this._listeners.delete(eventType);
    } else {
      this._listeners.set(eventType, filtered);
    }

    return this;
  }

  removeListener(eventType, listener) {
    return this.off(eventType, listener);
  }

  removeAllListeners(eventType) {
    if (eventType === undefined) {
      this._listeners.clear();
    } else {
      this._listeners.delete(eventType);
    }

    return this;
  }

  clear() {
    return this.removeAllListeners();
  }

  listeners(eventType) {
    return (this._listeners.get(eventType) || []).map(
      (listener) => listener.__originalListener || listener
    );
  }

  listenerCount(eventType) {
    return this.listeners(eventType).length;
  }

  eventNames() {
    return Array.from(this._listeners.keys());
  }

  subscribe(eventType, handler) {
    this.on(eventType, handler);
    return () => {
      this.off(eventType, handler);
    };
  }

  emit(eventOrType, payload) {
    const { eventType, deliveredPayload } = normalizeEvent(eventOrType, payload);
    const listeners = [
      ...(this._listeners.get(eventType) || []),
      ...(this._listeners.get('*') || [])
    ];

    for (const listener of listeners) {
      listener(deliveredPayload);
    }

    return this;
  }

  async publish(event) {
    const listeners = [
      ...(this._listeners.get(event?.type) || []),
      ...(this._listeners.get('*') || [])
    ];

    const results = [];
    const errors = [];

    for (const listener of listeners) {
      try {
        results.push(await listener(event));
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length === 1) {
      throw errors[0];
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, `Event publish failed for ${event?.type || 'unknown event'}`);
    }

    return results;
  }
}
