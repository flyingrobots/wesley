import { WesleyError } from '../domain/WesleyError.mjs';
import { createRuntimeStreamId } from './RuntimeEvents.mjs';
import { replayRuntimeRun } from './RuntimeRunReplay.mjs';

export function resolveRuntimeRunStream(eventStore, { runId, transmutation = null } = {}) {
  const requestedRunId = normalizeOptionalString(runId);
  const requestedTransmutation = normalizeOptionalString(transmutation);
  if (!requestedRunId) {
    throw new WesleyError('EUSAGE', 'Runtime run lookup requires a non-empty runId.');
  }

  if (requestedTransmutation) {
    const streamId = createRuntimeStreamId({ transmutation: requestedTransmutation, runId: requestedRunId });
    if (!runtimeRunStreamExists(eventStore, streamId)) {
      throw new WesleyError('RUN_NOT_FOUND', `No persisted run found for ${requestedTransmutation}/${requestedRunId}.`);
    }
    return { streamId };
  }

  const streamIds = listRuntimeRunStreamIds(eventStore);
  const matches = [];
  for (const streamId of streamIds) {
    const snapshot = readRuntimeRunSnapshot(eventStore, streamId);
    if (snapshot?.runId === requestedRunId) {
      matches.push({ streamId });
      continue;
    }

    const events = eventStore.readStream(streamId);
    if (events.some(event => event?.runId === requestedRunId)) {
      matches.push({ streamId });
    }
  }

  if (matches.length === 0) {
    throw new WesleyError('RUN_NOT_FOUND', `No persisted run found for runId ${requestedRunId}.`);
  }
  if (matches.length > 1) {
    throw new WesleyError('RUN_AMBIGUOUS', `Multiple persisted runs match ${requestedRunId}; pass --transmutation.`);
  }
  return matches[0];
}

export function readRuntimeRunRecord(
  eventStore,
  streamId,
  { runId = null, transmutation = null, includeEvents = false } = {}
) {
  const snapshot = readRuntimeRunSnapshot(eventStore, streamId);
  const tailEvents = snapshot
    ? readRuntimeRunStreamSince(eventStore, streamId, snapshot.lastSequence)
    : eventStore.readStream(streamId);
  const first = tailEvents[0] || {};
  const last = tailEvents.at(-1) || {};
  const replay = replayRuntimeRun(tailEvents, {
    runId: runId || snapshot?.runId || last.runId || first.runId || null,
    transmutation: transmutation || snapshot?.transmutation || last.transmutation || first.transmutation || null,
    streamId,
    snapshot
  });

  return {
    run: replay.run,
    replay: replay.replay,
    snapshot,
    tailEvents,
    events: includeEvents ? eventStore.readStream(streamId) : tailEvents
  };
}

export function inspectRuntimeRunStream(eventStore, streamId) {
  try {
    const record = readRuntimeRunRecord(eventStore, streamId, { includeEvents: false });
    const findings = [];
    if (!record.replay.terminal) {
      findings.push({
        code: 'RUN_NON_TERMINAL',
        message: `Run ${record.run.runId || streamId} is non-terminal with status ${record.run.status}.`
      });
    }
    for (const issue of record.replay.integrity.issues) {
      findings.push({
        code: issue.code,
        message: issue.message
      });
    }

    return {
      streamId,
      run: record.run,
      replay: record.replay,
      snapshot: record.snapshot,
      events: record.events,
      tailEvents: record.tailEvents,
      findings,
      healthy: findings.length === 0
    };
  } catch (error) {
    return {
      streamId,
      run: null,
      replay: null,
      events: [],
      findings: [{
        code: 'STREAM_READ_FAILED',
        message: error.message
      }],
      healthy: false
    };
  }
}

export function inspectRuntimeRunStreams(eventStore, filters = {}) {
  const requestedTransmutation = normalizeOptionalString(filters.transmutation);
  const results = [];

  for (const streamId of listRuntimeRunStreamIds(eventStore)) {
    const stream = inspectRuntimeRunStream(eventStore, streamId);
    if (requestedTransmutation && stream.run?.transmutation !== requestedTransmutation) continue;
    results.push(stream);
  }

  results.sort((left, right) => compareRunsDescending(left.run || {}, right.run || {}));
  if (Number.isInteger(filters.limit) && filters.limit >= 0) {
    return results.slice(0, filters.limit);
  }
  return results;
}

export function listRuntimeRunReports(eventStore, filters = {}) {
  const requestedTransmutation = normalizeOptionalString(filters.transmutation);
  const requestedStatus = normalizeOptionalString(filters.status);
  const runs = [];

  for (const stream of inspectRuntimeRunStreams(eventStore, filters)) {
    const run = stream.run;
    if (!run?.runId) continue;
    if (requestedTransmutation && run.transmutation !== requestedTransmutation) continue;
    if (requestedStatus && run.status !== requestedStatus) continue;
    runs.push(run);
  }

  runs.sort((left, right) => compareRunsDescending(left, right));
  if (Number.isInteger(filters.limit) && filters.limit >= 0) {
    return runs.slice(0, filters.limit);
  }
  return runs;
}

export function summarizeRuntimeRunDoctor(streams) {
  const summary = {
    streamCount: streams.length,
    healthyStreams: 0,
    unhealthyStreams: 0,
    nonTerminalStreams: 0,
    integrityIssueStreams: 0,
    readErrorStreams: 0
  };

  for (const stream of streams) {
    if (stream.healthy) {
      summary.healthyStreams += 1;
    } else {
      summary.unhealthyStreams += 1;
    }

    if (stream.findings.some(finding => finding.code === 'RUN_NON_TERMINAL')) {
      summary.nonTerminalStreams += 1;
    }
    if (stream.findings.some(finding => finding.code === 'STREAM_READ_FAILED')) {
      summary.readErrorStreams += 1;
    }
    if (stream.findings.some(finding => !['RUN_NON_TERMINAL', 'STREAM_READ_FAILED'].includes(finding.code))) {
      summary.integrityIssueStreams += 1;
    }
  }

  return summary;
}

export function readRuntimeRunSnapshot(eventStore, streamId) {
  if (typeof eventStore?.readSnapshot !== 'function') {
    return null;
  }
  try {
    return eventStore.readSnapshot(streamId);
  } catch {
    return null;
  }
}

export function readRuntimeRunStreamSince(eventStore, streamId, afterSequence = 0) {
  if (typeof eventStore?.readStreamSince === 'function') {
    return eventStore.readStreamSince(streamId, afterSequence);
  }
  return eventStore.readStream(streamId).filter(event => {
    return Number.isInteger(event?.sequence) ? event.sequence > afterSequence : true;
  });
}

export function runtimeRunStreamExists(eventStore, streamId) {
  if (readRuntimeRunSnapshot(eventStore, streamId)) {
    return true;
  }
  return eventStore.readStream(streamId).length > 0;
}

export function listRuntimeRunStreamIds(eventStore) {
  if (typeof eventStore?.listStreams !== 'function') {
    return [];
  }
  return eventStore.listStreams();
}

function compareRunsDescending(left, right) {
  return compareTimestampDescending(
    left.lastEventAt || left.completedAt || left.startedAt,
    right.lastEventAt || right.completedAt || right.startedAt
  ) || String(right.runId || '').localeCompare(String(left.runId || ''));
}

function compareTimestampDescending(left, right) {
  const leftTs = Date.parse(left || '');
  const rightTs = Date.parse(right || '');
  if (Number.isNaN(leftTs) && Number.isNaN(rightTs)) return 0;
  if (Number.isNaN(leftTs)) return 1;
  if (Number.isNaN(rightTs)) return -1;
  return rightTs - leftTs;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
