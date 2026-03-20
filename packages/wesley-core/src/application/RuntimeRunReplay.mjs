import { applyRuntimeEvent, buildRuntimeRunReport } from './RuntimeRunReport.mjs';

export function replayRuntimeRun(events, seed = {}) {
  const run = buildRuntimeRunReport([], seed);
  const replay = {
    eventCount: Array.isArray(events) ? events.length : 0,
    appliedEventCount: 0,
    terminal: false,
    integrity: {
      valid: true,
      issues: []
    },
    firstSequence: null,
    lastSequence: null
  };

  if (!Array.isArray(events) || events.length === 0) {
    return { run, replay };
  }

  run.status = 'running';

  let expectedStreamId = seed.streamId ?? null;
  let expectedRunId = seed.runId ?? null;
  let expectedTransmutation = seed.transmutation ?? null;
  let expectedSequence = 1;

  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object') {
      pushReplayIssue(replay, 'INVALID_EVENT', `Event ${index} is not an object.`, { index });
      continue;
    }

    const streamId = typeof event.streamId === 'string' && event.streamId.trim() ? event.streamId : null;
    const runId = typeof event.runId === 'string' && event.runId.trim() ? event.runId : null;
    const transmutation = typeof event.transmutation === 'string' && event.transmutation.trim()
      ? event.transmutation
      : null;
    const sequence = Number.isInteger(event.sequence) ? event.sequence : null;

    if (!expectedStreamId && streamId) expectedStreamId = streamId;
    if (!expectedRunId && runId) expectedRunId = runId;
    if (!expectedTransmutation && transmutation) expectedTransmutation = transmutation;

    if (streamId && expectedStreamId && streamId !== expectedStreamId) {
      pushReplayIssue(replay, 'STREAM_MISMATCH', `Event ${index} belongs to stream ${streamId}, expected ${expectedStreamId}.`, { index, sequence });
    }
    if (runId && expectedRunId && runId !== expectedRunId) {
      pushReplayIssue(replay, 'RUN_MISMATCH', `Event ${index} belongs to runId ${runId}, expected ${expectedRunId}.`, { index, sequence });
    }
    if (transmutation && expectedTransmutation && transmutation !== expectedTransmutation) {
      pushReplayIssue(
        replay,
        'TRANSMUTATION_MISMATCH',
        `Event ${index} belongs to transmutation ${transmutation}, expected ${expectedTransmutation}.`,
        { index, sequence }
      );
    }

    if (sequence == null) {
      pushReplayIssue(replay, 'SEQUENCE_MISSING', `Event ${index} is missing an integer sequence.`, { index });
    } else {
      if (replay.firstSequence == null) replay.firstSequence = sequence;
      replay.lastSequence = sequence;
      if (index === 0 && sequence !== 1) {
        pushReplayIssue(replay, 'SEQUENCE_START', `First event starts at sequence ${sequence}, expected 1.`, { index, sequence });
      }
      if (sequence !== expectedSequence) {
        pushReplayIssue(
          replay,
          'SEQUENCE_GAP',
          `Event ${index} has sequence ${sequence}, expected ${expectedSequence}.`,
          { index, sequence }
        );
        expectedSequence = sequence + 1;
      } else {
        expectedSequence += 1;
      }

      if (streamId && typeof event.eventId === 'string') {
        const expectedEventId = `${streamId}:${sequence}`;
        if (event.eventId !== expectedEventId) {
          pushReplayIssue(
            replay,
            'EVENT_ID_MISMATCH',
            `Event ${index} has eventId ${event.eventId}, expected ${expectedEventId}.`,
            { index, sequence }
          );
        }
      }
    }

    applyRuntimeEvent(run, event);
    replay.appliedEventCount += 1;
  }

  replay.terminal = isTerminal(run.status);
  replay.integrity.valid = replay.integrity.issues.length === 0;
  return { run, replay };
}

function pushReplayIssue(replay, code, message, extra = {}) {
  replay.integrity.issues.push({
    code,
    message,
    ...extra
  });
}

function isTerminal(status) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
