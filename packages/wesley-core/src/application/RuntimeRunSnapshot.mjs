import { applyRuntimeEvent, buildRuntimeRunReport } from './RuntimeRunReport.mjs';

export const RUNTIME_RUN_SNAPSHOT_SCHEMA_VERSION = '1.0.0';

export function createRuntimeRunSnapshot(seed = {}) {
  const run = seed.run ? cloneRunReport(seed.run) : buildRuntimeRunReport([], seed);
  const eventCount = normalizeNonNegativeInteger(seed.eventCount, run.eventCount);
  return {
    schemaVersion: seed.schemaVersion || RUNTIME_RUN_SNAPSHOT_SCHEMA_VERSION,
    streamId: seed.streamId ?? run.streamId ?? null,
    runId: seed.runId ?? run.runId ?? null,
    transmutation: seed.transmutation ?? run.transmutation ?? null,
    lastSequence: normalizeNonNegativeInteger(seed.lastSequence, 0),
    eventCount,
    updatedAt: seed.updatedAt ?? run.lastEventAt ?? null,
    run
  };
}

export function applyRuntimeEventToSnapshot(snapshot, event) {
  const next = createRuntimeRunSnapshot(snapshot);
  applyRuntimeEvent(next.run, event);
  next.streamId = event?.streamId ?? next.streamId;
  next.runId = event?.runId ?? next.runId;
  next.transmutation = event?.transmutation ?? next.transmutation;
  next.lastSequence = normalizeNonNegativeInteger(event?.sequence, next.lastSequence);
  next.eventCount = normalizeNonNegativeInteger(next.run.eventCount, next.eventCount);
  if (typeof event?.timestamp === 'string' && event.timestamp) {
    next.updatedAt = event.timestamp;
  }
  return next;
}

export function buildRuntimeRunSnapshot(events, seed = {}) {
  let snapshot = createRuntimeRunSnapshot(seed);
  if (!Array.isArray(events) || events.length === 0) {
    return snapshot;
  }

  for (const event of events) {
    snapshot = applyRuntimeEventToSnapshot(snapshot, event);
  }
  return snapshot;
}

function cloneRunReport(report) {
  return {
    runId: report?.runId ?? null,
    transmutation: report?.transmutation ?? null,
    streamId: report?.streamId ?? null,
    command: report?.command ?? null,
    status: report?.status ?? 'pending',
    startedAt: report?.startedAt ?? null,
    completedAt: report?.completedAt ?? null,
    lastEventAt: report?.lastEventAt ?? null,
    eventCount: report?.eventCount ?? 0,
    artifactCount: report?.artifactCount ?? 0,
    taskCounts: {
      started: report?.taskCounts?.started ?? 0,
      completed: report?.taskCounts?.completed ?? 0,
      failed: report?.taskCounts?.failed ?? 0,
      skipped: report?.taskCounts?.skipped ?? 0
    },
    dryRun: typeof report?.dryRun === 'boolean' ? report.dryRun : (report?.dryRun ?? null),
    verdict: report?.verdict ?? null,
    scores: report?.scores ? { ...report.scores } : (report?.scores ?? null),
    failure: report?.failure ? { ...report.failure } : (report?.failure ?? null)
  };
}

function normalizeNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
