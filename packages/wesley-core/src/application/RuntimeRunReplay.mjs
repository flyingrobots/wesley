import { applyRuntimeEvent, buildRuntimeRunReport } from './RuntimeRunReport.mjs';
import { createRuntimeRunSnapshot } from './RuntimeRunSnapshot.mjs';

export function replayRuntimeRun(events, seed = {}) {
  const snapshot = seed.snapshot ? createRuntimeRunSnapshot(seed.snapshot) : null;
  const run = snapshot ? createSnapshotRunSeed(snapshot) : buildRuntimeRunReport([], seed);
  const replay = {
    eventCount: normalizeEventCount(snapshot) + (Array.isArray(events) ? events.length : 0),
    appliedEventCount: normalizeEventCount(snapshot),
    terminal: isTerminal(run.status),
    integrity: {
      valid: true,
      issues: []
    },
    firstSequence: snapshot ? snapshot.lastSequence + 1 : null,
    lastSequence: snapshot?.lastSequence ?? null,
    snapshot: {
      used: Boolean(snapshot),
      eventCount: normalizeEventCount(snapshot),
      lastSequence: snapshot?.lastSequence ?? null,
      updatedAt: snapshot?.updatedAt ?? null
    }
  };

  if (snapshot) {
    validateSnapshotSeed(snapshot, seed, replay);
  }

  if (!Array.isArray(events) || events.length === 0) {
    return { run, replay };
  }

  if (!isTerminal(run.status)) {
    run.status = 'running';
  }

  let expectedStreamId = seed.streamId ?? snapshot?.streamId ?? null;
  let expectedRunId = seed.runId ?? snapshot?.runId ?? null;
  let expectedTransmutation = seed.transmutation ?? snapshot?.transmutation ?? null;
  let expectedSequence = snapshot ? snapshot.lastSequence + 1 : 1;

  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object') {
      pushReplayIssue(replay, 'INVALID_EVENT', `Event ${index} is not an object.`, { index });
      continue;
    }

    const streamId =
      typeof event.streamId === 'string' && event.streamId.trim() ? event.streamId : null;
    const runId = typeof event.runId === 'string' && event.runId.trim() ? event.runId : null;
    const transmutation =
      typeof event.transmutation === 'string' && event.transmutation.trim()
        ? event.transmutation
        : null;
    const sequence = Number.isInteger(event.sequence) ? event.sequence : null;

    if (!expectedStreamId && streamId) expectedStreamId = streamId;
    if (!expectedRunId && runId) expectedRunId = runId;
    if (!expectedTransmutation && transmutation) expectedTransmutation = transmutation;

    if (streamId && expectedStreamId && streamId !== expectedStreamId) {
      pushReplayIssue(
        replay,
        'STREAM_MISMATCH',
        `Event ${index} belongs to stream ${streamId}, expected ${expectedStreamId}.`,
        { index, sequence }
      );
    }
    if (runId && expectedRunId && runId !== expectedRunId) {
      pushReplayIssue(
        replay,
        'RUN_MISMATCH',
        `Event ${index} belongs to runId ${runId}, expected ${expectedRunId}.`,
        { index, sequence }
      );
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
      pushReplayIssue(
        replay,
        'SEQUENCE_MISSING',
        `Event ${index} is missing an integer sequence.`,
        { index }
      );
    } else {
      if (replay.firstSequence == null) replay.firstSequence = sequence;
      replay.lastSequence = sequence;
      if (index === 0 && sequence !== expectedSequence) {
        pushReplayIssue(
          replay,
          'SEQUENCE_START',
          `First event starts at sequence ${sequence}, expected ${expectedSequence}.`,
          { index, sequence }
        );
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

function createSnapshotRunSeed(snapshot) {
  return createRuntimeRunSnapshot(snapshot).run;
}

function normalizeEventCount(snapshot) {
  return Number.isInteger(snapshot?.eventCount) && snapshot.eventCount >= 0
    ? snapshot.eventCount
    : 0;
}

function validateSnapshotSeed(snapshot, seed, replay) {
  const expectedStreamId = seed.streamId ?? null;
  const expectedRunId = seed.runId ?? null;
  const expectedTransmutation = seed.transmutation ?? null;
  if (expectedStreamId && snapshot.streamId && snapshot.streamId !== expectedStreamId) {
    pushReplayIssue(
      replay,
      'SNAPSHOT_STREAM_MISMATCH',
      `Snapshot belongs to stream ${snapshot.streamId}, expected ${expectedStreamId}.`
    );
  }
  if (expectedRunId && snapshot.runId && snapshot.runId !== expectedRunId) {
    pushReplayIssue(
      replay,
      'SNAPSHOT_RUN_MISMATCH',
      `Snapshot belongs to runId ${snapshot.runId}, expected ${expectedRunId}.`
    );
  }
  if (
    expectedTransmutation &&
    snapshot.transmutation &&
    snapshot.transmutation !== expectedTransmutation
  ) {
    pushReplayIssue(
      replay,
      'SNAPSHOT_TRANSMUTATION_MISMATCH',
      `Snapshot belongs to transmutation ${snapshot.transmutation}, expected ${expectedTransmutation}.`
    );
  }
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
