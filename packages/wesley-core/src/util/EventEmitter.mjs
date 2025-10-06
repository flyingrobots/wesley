export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }
  on(event, listener) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(listener);
    return this;
  }
  off(event, listener) {
    const set = this._listeners.get(event);
    if (set) set.delete(listener);
    return this;
  }
  emit(event, payload) {
    const set = this._listeners.get(event) || this._listeners.get(event.type);
    if (set) for (const fn of Array.from(set)) try { fn(payload); } catch {}
    return this;
  }
}

