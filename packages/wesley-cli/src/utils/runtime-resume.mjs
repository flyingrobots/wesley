import { createRuntimeStreamId, replayRuntimeRun, WesleyError } from '@wesley/core';

export function assertResumeRequestedRunId(options = {}) {
  if (options.resume && !normalizeRunId(options.runId)) {
    throw new WesleyError('EUSAGE', '--resume requires --run-id.');
  }
}

export function resolveResumeState(eventStore, { runId, transmutation }) {
  if (!eventStore || typeof eventStore.readStream !== 'function') {
    throw new WesleyError('NO_EVENT_STORE', 'No event store is configured for this runtime.');
  }

  const streamId = createRuntimeStreamId({ transmutation, runId });
  const events = eventStore.readStream(streamId);
  if (events.length === 0) {
    throw new WesleyError('RUN_NOT_FOUND', `No persisted run found for ${transmutation}/${runId}.`);
  }

  const replayResult = replayRuntimeRun(events, {
    runId,
    transmutation,
    streamId
  });
  if (!replayResult.replay.integrity.valid) {
    const codes = replayResult.replay.integrity.issues.map(issue => issue.code).join(', ');
    throw new WesleyError(
      'PIPELINE_EXEC_FAILED',
      `Cannot resume ${transmutation}/${runId}; persisted stream failed integrity checks: ${codes}.`
    );
  }

  return {
    ...replayResult,
    events,
    shortCircuited: replayResult.replay.terminal
  };
}

function normalizeRunId(runId) {
  if (typeof runId !== 'string') return null;
  const trimmed = runId.trim();
  return trimmed || null;
}
