export function buildRuntimeRunReport(events, seed = {}) {
  const report = {
    runId: seed.runId ?? null,
    transmutation: seed.transmutation ?? null,
    streamId: seed.streamId ?? null,
    command: seed.command ?? null,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    lastEventAt: null,
    eventCount: 0,
    artifactCount: 0,
    taskCounts: {
      started: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    },
    dryRun: typeof seed.dryRun === 'boolean' ? seed.dryRun : null,
    verdict: seed.verdict ?? null,
    scores: seed.scores ?? null,
    failure: seed.failure ?? null
  };

  if (!Array.isArray(events) || events.length === 0) {
    return report;
  }

  report.status = 'running';

  for (const event of events) {
    applyRuntimeEvent(report, event);
  }

  return report;
}

export function applyRuntimeEvent(report, event) {
  if (!report || typeof report !== 'object') {
    throw new TypeError('applyRuntimeEvent requires a report object');
  }
  if (!event || typeof event !== 'object') {
    return report;
  }

  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

  report.runId = event.runId ?? report.runId;
  report.transmutation = event.transmutation ?? report.transmutation;
  report.streamId = event.streamId ?? report.streamId;
  report.eventCount += 1;

  if (typeof event.timestamp === 'string' && event.timestamp) {
    report.startedAt = report.startedAt || event.timestamp;
    report.lastEventAt = event.timestamp;
  }

  if (typeof payload.command === 'string' && payload.command.trim()) {
    report.command = payload.command.trim();
  }
  if (typeof payload.dryRun === 'boolean') {
    report.dryRun = payload.dryRun;
  }
  if (typeof payload.verdict === 'string' && payload.verdict.trim()) {
    report.verdict = payload.verdict.trim();
  }

  switch (event.type) {
    case 'TaskStarted':
      report.taskCounts.started += 1;
      report.status = isTerminal(report.status) ? report.status : 'running';
      break;
    case 'TaskCompleted':
      report.taskCounts.completed += 1;
      break;
    case 'TaskFailed':
      report.taskCounts.failed += 1;
      if (!report.failure) {
        report.failure = {
          code: payload.errorCode ?? 'TASK_FAILED',
          message: payload.errorMessage ?? null
        };
      }
      break;
    case 'TaskSkipped':
      report.taskCounts.skipped += 1;
      break;
    case 'ArtifactsMaterialized':
      if (Number.isInteger(payload.artifactCount) && payload.artifactCount >= 0) {
        report.artifactCount += payload.artifactCount;
      }
      break;
    case 'ScoresComputed':
      report.scores = {
        scs: payload.scs ?? null,
        mri: payload.mri ?? null,
        tci: payload.tci ?? null,
        readiness: payload.readiness ?? null
      };
      break;
    case 'RunCompleted':
      report.status = 'completed';
      report.completedAt = event.timestamp ?? report.completedAt;
      break;
    case 'RunFailed':
      report.status = 'failed';
      report.completedAt = event.timestamp ?? report.completedAt;
      report.failure = {
        code: payload.code ?? 'RUN_FAILED',
        message: payload.message ?? null
      };
      break;
    case 'RunCancelled':
      report.status = 'cancelled';
      report.completedAt = event.timestamp ?? report.completedAt;
      report.failure = {
        code: payload.code ?? 'RUN_CANCELLED',
        message: payload.message ?? null
      };
      break;
    default:
      break;
  }

  return report;
}

function isTerminal(status) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
