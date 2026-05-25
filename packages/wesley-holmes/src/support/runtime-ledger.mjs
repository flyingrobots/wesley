import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { GENERATED_LEDGER_DIR } from './artifacts.mjs';

const STREAM_FILE_SUFFIX = '.jsonl';
const SNAPSHOT_FILE_SUFFIX = '.json';
const RUNTIME_EVENT_SCHEMA_VERSION = '1.0.0';

export function createRunId() {
  return `run-${randomUUID()}`;
}

export function createRuntimeStreamId({ transmutation, runId }) {
  return `transmutation:${transmutation}:${runId}`;
}

export function createRuntimeEventCollector({
  clock,
  runId,
  transmutation,
  streamId = createRuntimeStreamId({ transmutation, runId }),
  correlationId = runId,
  eventStore = new GitWarpEventStore(),
  crashAfterEvent = null
}) {
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('createRuntimeEventCollector requires a clock with now()');
  }
  if (typeof runId !== 'string' || !runId.trim()) {
    throw new TypeError('createRuntimeEventCollector requires a non-empty runId');
  }
  if (typeof transmutation !== 'string' || !transmutation.trim()) {
    throw new TypeError('createRuntimeEventCollector requires a non-empty transmutation');
  }

  const existingEvents = eventStore.readStream(streamId);
  let sequence = existingEvents.at(-1)?.sequence ?? 0;

  return {
    runId,
    transmutation,
    streamId,
    eventStore,
    get events() {
      return eventStore.readStream(streamId);
    },
    emit(type, payload = {}, metadata = {}) {
      const nextSequence = sequence + 1;
      const event = {
        eventId: `${streamId}:${nextSequence}`,
        type,
        streamId,
        sequence: nextSequence,
        schemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
        timestamp: normalizeTimestamp(clock.now()),
        causationId: metadata.causationId ?? null,
        correlationId: metadata.correlationId ?? correlationId,
        idempotencyKey: metadata.idempotencyKey ?? `${streamId}:${type}:${nextSequence}`,
        runId,
        transmutation,
        payload
      };
      const appended = eventStore.append(event);
      sequence = Number.isInteger(appended?.sequence) ? appended.sequence : nextSequence;
      if (appended === event && shouldInjectCrash(crashAfterEvent, sequence)) {
        throw buildInjectedCrashError({
          crashAfterEvent,
          eventStore,
          streamId,
          runId,
          transmutation
        });
      }
      return appended;
    }
  };
}

export class GitWarpEventStore {
  constructor({ rootDir = GENERATED_LEDGER_DIR } = {}) {
    this.rootDir = rootDir;
    this.streamsDir = path.join(rootDir, 'streams');
    this.snapshotsDir = path.join(rootDir, 'snapshots');
  }

  append(event) {
    if (!event || typeof event !== 'object') {
      throw new TypeError('GitWarpEventStore.append() requires an event object');
    }
    if (typeof event.streamId !== 'string' || !event.streamId.trim()) {
      throw new TypeError('GitWarpEventStore.append() requires a non-empty event.streamId');
    }

    this._ensureReady();
    const existing = findExistingByIdempotencyKey(
      this.readStream(event.streamId),
      event.idempotencyKey
    );
    if (existing) {
      return existing;
    }
    appendFileSync(this._streamPath(event.streamId), `${JSON.stringify(event)}\n`, 'utf8');
    if (isTerminalRuntimeEvent(event.type)) {
      this.writeSnapshot(event.streamId, buildRuntimeRunSnapshot(this.readStream(event.streamId)));
    }
    return event;
  }

  readStream(streamId) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('GitWarpEventStore.readStream() requires a non-empty streamId');
    }

    const targetPath = this._streamPath(streamId);
    if (!existsSync(targetPath)) {
      return [];
    }

    return readFileSync(targetPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  listStreams() {
    if (!existsSync(this.streamsDir)) {
      return [];
    }

    return readdirSync(this.streamsDir)
      .filter((name) => name.endsWith(STREAM_FILE_SUFFIX))
      .map((name) => decodeURIComponent(name.slice(0, -STREAM_FILE_SUFFIX.length)))
      .sort();
  }

  readStreamSince(streamId, afterSequence = 0) {
    return this.readStream(streamId).filter((event) => {
      return Number.isInteger(event?.sequence) ? event.sequence > afterSequence : true;
    });
  }

  readSnapshot(streamId) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('GitWarpEventStore.readSnapshot() requires a non-empty streamId');
    }

    const targetPath = this._snapshotPath(streamId);
    if (!existsSync(targetPath)) {
      return null;
    }
    return JSON.parse(readFileSync(targetPath, 'utf8'));
  }

  writeSnapshot(streamId, snapshot) {
    if (typeof streamId !== 'string' || !streamId.trim()) {
      throw new TypeError('GitWarpEventStore.writeSnapshot() requires a non-empty streamId');
    }

    this._ensureReady();
    writeFileSync(this._snapshotPath(streamId), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    return snapshot;
  }

  _ensureReady() {
    mkdirSync(this.streamsDir, { recursive: true });
    mkdirSync(this.snapshotsDir, { recursive: true });
  }

  _streamPath(streamId) {
    return path.join(this.streamsDir, `${encodeURIComponent(streamId)}${STREAM_FILE_SUFFIX}`);
  }

  _snapshotPath(streamId) {
    return path.join(this.snapshotsDir, `${encodeURIComponent(streamId)}${SNAPSHOT_FILE_SUFFIX}`);
  }
}

export async function resolveLedgerRootDir({
  repoRoot = process.cwd(),
  env = process.env,
  configPath = null
} = {}) {
  const requested = normalizeOptionalString(env?.WESLEY_LEDGER_PATH);
  if (requested) {
    return resolveFromRoot(repoRoot, requested);
  }

  const candidateConfigPath = await resolveConfigPath(repoRoot, configPath);
  if (candidateConfigPath) {
    const loaded = await import(pathToFileURL(candidateConfigPath).href);
    const configured = normalizeOptionalString(loaded?.default?.ledger?.repoPath);
    if (configured) {
      return resolveFromRoot(repoRoot, configured);
    }
  }

  return path.join(repoRoot, GENERATED_LEDGER_DIR);
}

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

export function listRuntimeRunReports(eventStore, filters = {}) {
  const requestedTransmutation = normalizeOptionalString(filters.transmutation);
  const requestedStatus = normalizeOptionalString(filters.status);
  const runs = [];

  for (const streamId of listRuntimeRunStreamIds(eventStore)) {
    const record = readRuntimeRunRecord(eventStore, streamId, { includeEvents: false });
    const run = record.run;
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

export function resolveRuntimeRunStream(eventStore, { runId, transmutation = null } = {}) {
  const requestedRunId = normalizeOptionalString(runId);
  const requestedTransmutation = normalizeOptionalString(transmutation);
  if (!requestedRunId) {
    throw runtimeLookupError('Runtime run lookup requires a non-empty runId.', 'EUSAGE');
  }

  if (requestedTransmutation) {
    const streamId = createRuntimeStreamId({
      transmutation: requestedTransmutation,
      runId: requestedRunId
    });
    if (!runtimeRunStreamExists(eventStore, streamId)) {
      throw runtimeLookupError(
        `No persisted run found for ${requestedTransmutation}/${requestedRunId}.`,
        'RUN_NOT_FOUND'
      );
    }
    return { streamId };
  }

  const matches = [];
  for (const streamId of listRuntimeRunStreamIds(eventStore)) {
    const snapshot = readRuntimeRunSnapshot(eventStore, streamId);
    if (snapshot?.runId === requestedRunId) {
      matches.push({ streamId });
      continue;
    }

    const events = eventStore.readStream(streamId);
    if (events.some((event) => event?.runId === requestedRunId)) {
      matches.push({ streamId });
    }
  }

  if (matches.length === 0) {
    throw runtimeLookupError(
      `No persisted run found for runId ${requestedRunId}.`,
      'RUN_NOT_FOUND'
    );
  }
  if (matches.length > 1) {
    throw runtimeLookupError(
      `Multiple persisted runs match ${requestedRunId}; pass --transmutation.`,
      'RUN_AMBIGUOUS'
    );
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
    transmutation:
      transmutation || snapshot?.transmutation || last.transmutation || first.transmutation || null,
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

function applyRuntimeEvent(report, event) {
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

function replayRuntimeRun(events, seed = {}) {
  const snapshot = seed.snapshot ? createRuntimeRunSnapshot(seed.snapshot) : null;
  const run = snapshot ? createRuntimeRunSnapshot(snapshot).run : buildRuntimeRunReport([], seed);
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

  if (!Array.isArray(events) || events.length === 0) {
    return { run, replay };
  }

  if (!isTerminal(run.status)) {
    run.status = 'running';
  }

  let expectedSequence = snapshot ? snapshot.lastSequence + 1 : 1;

  for (const [index, event] of events.entries()) {
    const sequence = Number.isInteger(event?.sequence) ? event.sequence : null;
    if (sequence == null) {
      pushReplayIssue(replay, 'SEQUENCE_MISSING', `Event ${index} is missing an integer sequence.`);
    } else {
      if (replay.firstSequence == null) replay.firstSequence = sequence;
      replay.lastSequence = sequence;
      if (sequence !== expectedSequence) {
        pushReplayIssue(
          replay,
          'SEQUENCE_GAP',
          `Event ${index} has sequence ${sequence}, expected ${expectedSequence}.`
        );
        expectedSequence = sequence + 1;
      } else {
        expectedSequence += 1;
      }
    }

    applyRuntimeEvent(run, event);
    replay.appliedEventCount += 1;
  }

  replay.terminal = isTerminal(run.status);
  replay.integrity.valid = replay.integrity.issues.length === 0;
  return { run, replay };
}

function buildRuntimeRunSnapshot(events, seed = {}) {
  let snapshot = createRuntimeRunSnapshot(seed);
  if (!Array.isArray(events) || events.length === 0) {
    return snapshot;
  }

  for (const event of events) {
    snapshot = applyRuntimeEventToSnapshot(snapshot, event);
  }
  return snapshot;
}

function createRuntimeRunSnapshot(seed = {}) {
  const run = seed.run ? cloneRunReport(seed.run) : buildRuntimeRunReport([], seed);
  const eventCount = normalizeNonNegativeInteger(seed.eventCount, run.eventCount);
  return {
    schemaVersion: seed.schemaVersion || '1.0.0',
    streamId: seed.streamId ?? run.streamId ?? null,
    runId: seed.runId ?? run.runId ?? null,
    transmutation: seed.transmutation ?? run.transmutation ?? null,
    lastSequence: normalizeNonNegativeInteger(seed.lastSequence, 0),
    eventCount,
    updatedAt: seed.updatedAt ?? run.lastEventAt ?? null,
    run
  };
}

function applyRuntimeEventToSnapshot(snapshot, event) {
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

function readRuntimeRunSnapshot(eventStore, streamId) {
  if (typeof eventStore?.readSnapshot !== 'function') {
    return null;
  }
  try {
    return eventStore.readSnapshot(streamId);
  } catch {
    return null;
  }
}

function readRuntimeRunStreamSince(eventStore, streamId, afterSequence = 0) {
  if (typeof eventStore?.readStreamSince === 'function') {
    return eventStore.readStreamSince(streamId, afterSequence);
  }
  return eventStore.readStream(streamId).filter((event) => {
    return Number.isInteger(event?.sequence) ? event.sequence > afterSequence : true;
  });
}

function runtimeRunStreamExists(eventStore, streamId) {
  if (readRuntimeRunSnapshot(eventStore, streamId)) {
    return true;
  }
  return eventStore.readStream(streamId).length > 0;
}

function listRuntimeRunStreamIds(eventStore) {
  if (typeof eventStore?.listStreams !== 'function') {
    return [];
  }
  return eventStore.listStreams();
}

function resolveConfigPath(repoRoot, configPath) {
  const explicit = normalizeOptionalString(configPath);
  if (explicit) {
    const resolved = resolveFromRoot(repoRoot, explicit);
    return existsSync(resolved) ? resolved : null;
  }

  const localConfig = path.join(repoRoot, 'wesley.config.mjs');
  return existsSync(localConfig) ? localConfig : null;
}

function resolveFromRoot(repoRoot, target) {
  return path.isAbsolute(target) ? target : path.resolve(repoRoot, target);
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeTimestamp(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.toISOString === 'function') return value.toISOString();
  return new Date().toISOString();
}

function shouldInjectCrash(crashAfterEvent, sequence) {
  return Number.isInteger(crashAfterEvent) && crashAfterEvent > 0 && sequence === crashAfterEvent;
}

function buildInjectedCrashError({ crashAfterEvent, eventStore, streamId, runId, transmutation }) {
  const error = new Error(`Injected crash after event ${crashAfterEvent} for stream ${streamId}.`);
  error.name = 'InjectedRuntimeCrashError';
  error.code = 'PIPELINE_EXEC_FAILED';
  error.injectedCrash = true;
  error.runId = runId;
  error.transmutation = transmutation;
  error.streamId = streamId;
  error.events = eventStore.readStream(streamId);
  return error;
}

function findExistingByIdempotencyKey(events, idempotencyKey) {
  if (!Array.isArray(events)) {
    return null;
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return null;
  }
  return events.find((event) => event?.idempotencyKey === idempotencyKey) || null;
}

function isTerminalRuntimeEvent(type) {
  return type === 'RunCompleted' || type === 'RunFailed' || type === 'RunCancelled';
}

function isTerminal(status) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
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

function normalizeEventCount(snapshot) {
  return Number.isInteger(snapshot?.eventCount) && snapshot.eventCount >= 0
    ? snapshot.eventCount
    : 0;
}

function normalizeNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function pushReplayIssue(replay, code, message) {
  replay.integrity.issues.push({ code, message });
}

function compareRunsDescending(left, right) {
  return (
    compareTimestampDescending(
      left.lastEventAt || left.completedAt || left.startedAt,
      right.lastEventAt || right.completedAt || right.startedAt
    ) || String(right.runId || '').localeCompare(String(left.runId || ''))
  );
}

function compareTimestampDescending(left, right) {
  const leftTs = Date.parse(left || '');
  const rightTs = Date.parse(right || '');
  if (Number.isNaN(leftTs) && Number.isNaN(rightTs)) return 0;
  if (Number.isNaN(leftTs)) return 1;
  if (Number.isNaN(rightTs)) return -1;
  return rightTs - leftTs;
}

function runtimeLookupError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
