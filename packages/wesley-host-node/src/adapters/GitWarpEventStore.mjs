import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { EventStorePort } from '@wesley/core';

const STREAM_FILE_SUFFIX = '.jsonl';

export class GitWarpEventStore extends EventStorePort {
  constructor({ rootDir = '.wesley/ledger' } = {}) {
    super();
    this.rootDir = rootDir;
    this.streamsDir = path.join(rootDir, 'streams');
    this._gitInitAttempted = false;
  }

  append(event) {
    if (!event || typeof event !== 'object') {
      throw new TypeError('GitWarpEventStore.append() requires an event object');
    }
    if (typeof event.streamId !== 'string' || !event.streamId.trim()) {
      throw new TypeError('GitWarpEventStore.append() requires a non-empty event.streamId');
    }

    this._ensureReady();
    const existing = findExistingByIdempotencyKey(this.readStream(event.streamId), event.idempotencyKey);
    if (existing) {
      return existing;
    }
    appendFileSync(this._streamPath(event.streamId), `${JSON.stringify(event)}\n`, 'utf8');
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
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  listStreams() {
    if (!existsSync(this.streamsDir)) {
      return [];
    }

    return readdirSync(this.streamsDir)
      .filter(name => name.endsWith(STREAM_FILE_SUFFIX))
      .map(name => decodeURIComponent(name.slice(0, -STREAM_FILE_SUFFIX.length)))
      .sort();
  }

  _ensureReady() {
    mkdirSync(this.streamsDir, { recursive: true });
    if (this._gitInitAttempted || existsSync(path.join(this.rootDir, '.git'))) {
      this._gitInitAttempted = true;
      return;
    }

    this._gitInitAttempted = true;
    const result = spawnSync('git', ['init', '-q'], {
      cwd: this.rootDir,
      stdio: 'ignore'
    });

    if (result.status !== 0) {
      return;
    }
  }

  _streamPath(streamId) {
    return path.join(this.streamsDir, `${encodeURIComponent(streamId)}${STREAM_FILE_SUFFIX}`);
  }
}

function findExistingByIdempotencyKey(events, idempotencyKey) {
  if (!Array.isArray(events)) {
    return null;
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return null;
  }
  return events.find(event => event?.idempotencyKey === idempotencyKey) || null;
}
