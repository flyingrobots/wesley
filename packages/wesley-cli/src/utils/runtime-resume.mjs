import { createRuntimeStreamId, replayRuntimeRun, WesleyError } from '@wesley/core';

export function assertResumeRequestedRunId(options = {}) {
  if (options.resume && !normalizeRunId(options.runId)) {
    throw new WesleyError('EUSAGE', '--resume requires --run-id.');
  }
}

export function resolveResumeState(eventStore, { runId, transmutation, command = null }) {
  if (!eventStore || typeof eventStore.readStream !== 'function') {
    throw new WesleyError('NO_EVENT_STORE', 'No event store is configured for this runtime.');
  }

  const streamId = createRuntimeStreamId({ transmutation, runId });
  const streamEvents = eventStore.readStream(streamId);
  if (streamEvents.length === 0) {
    throw new WesleyError('RUN_NOT_FOUND', `No persisted run found for ${transmutation}/${runId}.`);
  }

  const events = command
    ? filterCommandEvents(streamEvents, { command, transmutation })
    : streamEvents;
  if (command && events.length === 0) {
    return null;
  }
  const replayEvents = command
    ? normalizeCommandReplayEvents(events)
    : events;

  const replayResult = replayRuntimeRun(replayEvents, {
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
    replayEvents,
    streamEvents,
    shortCircuited: replayResult.replay.terminal
  };
}

export function buildShortCircuitedResumeResult(resumeState) {
  return {
    transmutation: resumeState.run.transmutation,
    runId: resumeState.run.runId,
    resumed: true,
    shortCircuited: true,
    events: resumeState.events,
    run: resumeState.run,
    replay: resumeState.replay
  };
}

export function applyResumeMetadata(payload, resumeState) {
  return {
    ...payload,
    resumed: Boolean(resumeState),
    shortCircuited: false
  };
}

function normalizeRunId(runId) {
  if (typeof runId !== 'string') return null;
  const trimmed = runId.trim();
  return trimmed || null;
}

function filterCommandEvents(events, { command, transmutation }) {
  return events.filter(event => eventBelongsToCommand(event, { command, transmutation }));
}

function normalizeCommandReplayEvents(events) {
  return events.map((event, index) => {
    const sequence = index + 1;
    return {
      ...event,
      sequence,
      eventId: typeof event?.streamId === 'string' && event.streamId
        ? `${event.streamId}:${sequence}`
        : event?.eventId
    };
  });
}

function eventBelongsToCommand(event, { command, transmutation }) {
  const payloadCommand = normalizeRunId(event?.payload?.command);
  if (payloadCommand === command) {
    return true;
  }

  const idempotencyKey = typeof event?.idempotencyKey === 'string' ? event.idempotencyKey : '';
  if (idempotencyKey.startsWith(`${transmutation}:${command}:`)) {
    return true;
  }

  if (command === 'transform' || command === 'generate') {
    if (idempotencyKey === `${transmutation}:task-graph`) return true;
    if (idempotencyKey === `${transmutation}:evidence`) return true;
    if (idempotencyKey === `${transmutation}:scores`) return true;
    if (idempotencyKey.startsWith(`${transmutation}:gen:`)) return true;
  }

  return false;
}
