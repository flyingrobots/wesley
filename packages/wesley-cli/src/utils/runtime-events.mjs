import { createRuntimeEventCollector } from '@wesley/core';

export function createCommandEventCollector(ctx, run) {
  return createRuntimeEventCollector({
    clock: createCommandEventClock(ctx?.clock),
    runId: run.runId,
    transmutation: run.transmutation
  });
}

function createCommandEventClock(clock) {
  return {
    now() {
      const value = typeof clock?.now === 'function' ? clock.now() : new Date().toISOString();
      if (typeof value === 'string') return value;
      if (value && typeof value.toISOString === 'function') return value.toISOString();
      return new Date().toISOString();
    }
  };
}
