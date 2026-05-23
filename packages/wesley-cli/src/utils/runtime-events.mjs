import { buildRuntimeRunReport, createRuntimeEventCollector } from '@wesley/core';

export function createCommandEventCollector(ctx, run, options = {}) {
  return createRuntimeEventCollector({
    clock: createCommandEventClock(ctx?.clock),
    runId: run.runId,
    transmutation: run.transmutation,
    eventStore: options.eventStore ?? ctx?.eventStore,
    crashAfterEvent: resolveCrashAfterEvent(
      options.crashAfterEvent ?? ctx?.env?.WESLEY_CRASH_AFTER_EVENT
    ),
    streamId: options.streamId,
    correlationId: options.correlationId
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
  error.run = buildCommandRunReport(eventCollector, run);
  return error;
}

export function isInjectedCrash(error) {
  return Boolean(error?.injectedCrash) && error?.code === 'PIPELINE_EXEC_FAILED';
}

export function buildCommandRunReport(eventCollector, run, seed = {}) {
  return buildRuntimeRunReport(eventCollector?.events || [], {
    runId: run.runId,
    transmutation: run.transmutation,
    streamId: eventCollector?.streamId ?? null,
    ...seed
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

function resolveCrashAfterEvent(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
