/**
 * Event Bus - Event-driven architecture implementation
 * Simple in-memory event bus with async handlers
 */

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  async publish(event) {
    const handlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    const allHandlers = [...handlers, ...wildcardHandlers];
    
    // Execute all handlers in parallel
    const results = await Promise.allSettled(
      allHandlers.map(handler => handler(event))
    );
    
    // Check for any failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`Event handling failures for ${event.type}:`, failures);
    }
    
    return results;
  }

  clear() {
    this.handlers.clear();
  }
}