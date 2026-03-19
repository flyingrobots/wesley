import { createRuntimeEventCollector } from '@wesley/core';

export function createCommandEventCollector(ctx, run) {
  return createRuntimeEventCollector({
    clock: createCommandEventClock(ctx?.clock),
    runId: run.runId,
    transmutation: run.transmutation
  });
}

export function createCommandEventScope(run, command) {
  return `${run.transmutation}:${command}`;
}

export function emitRunRequested(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'RunRequested', payload, 'requested');
}

export function emitSourcesResolved(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'SourcesResolved', payload, 'sources');
}

export function emitIrParsed(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'IRParsed', payload, 'ir');
}

export function emitPlanBuilt(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'PlanBuilt', payload, 'plan');
}

export function emitArtifactsMaterialized(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'ArtifactsMaterialized', payload, 'artifacts');
}

export function emitRunCompleted(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'RunCompleted', payload, 'completed');
}

export function emitRunFailed(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'RunFailed', payload, 'failed');
}

export function emitCertificateIssued(eventCollector, scope, payload) {
  return emitScopedEvent(eventCollector, scope, 'CertificateIssued', payload, 'issued');
}

export function emitTaskStarted(eventCollector, taskId, payload) {
  return emitTaskEvent(eventCollector, taskId, 'TaskStarted', payload, 'started');
}

export function emitTaskCompleted(eventCollector, taskId, payload) {
  return emitTaskEvent(eventCollector, taskId, 'TaskCompleted', payload, 'completed');
}

export function emitTaskFailed(eventCollector, taskId, payload) {
  return emitTaskEvent(eventCollector, taskId, 'TaskFailed', payload, 'failed');
}

export function attachRunFailure(error, eventCollector, run) {
  error.events = eventCollector.events;
  error.runId = run.runId;
  error.transmutation = run.transmutation;
  return error;
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

function emitScopedEvent(eventCollector, scope, type, payload, suffix) {
  return eventCollector.emit(type, payload, {
    idempotencyKey: `${scope}:${suffix}`
  });
}

function emitTaskEvent(eventCollector, taskId, type, payload, suffix) {
  return eventCollector.emit(type, payload, {
    idempotencyKey: `${taskId}:${suffix}`
  });
}
