import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERATED_REALM_PATH, GENERATED_SNAPSHOT_PATH } from '@wesley/core';

import {
  buildSnapshotProjection,
  buildRealmProjection,
  readRealmProjection,
  readSnapshotProjection
} from '../src/utils/runtime-projections.mjs';

test('buildSnapshotProjection returns the canonical snapshot shape', () => {
  const projection = buildSnapshotProjection({
    tables: [{ name: 'User', fields: [] }]
  });

  assert.deepEqual(projection, {
    irVersion: '1.0.0',
    tables: [{ name: 'User', fields: [] }]
  });
});

test('buildRealmProjection returns the canonical realm shape', () => {
  const projection = buildRealmProjection({
    transmutation: 'null-generator',
    runId: 'run-realm-123',
    provider: 'postgres',
    verdict: 'PASS',
    durationMs: 10,
    steps: 2,
    timestamp: '2026-03-19T05:00:00.000Z'
  });

  assert.deepEqual(projection, {
    transmutation: 'null-generator',
    runId: 'run-realm-123',
    provider: 'postgres',
    verdict: 'PASS',
    duration_ms: 10,
    steps: 2,
    timestamp: '2026-03-19T05:00:00.000Z'
  });
});

test('buildRealmProjection omits nullish optional fields', () => {
  const projection = buildRealmProjection({
    transmutation: 'null-generator',
    runId: 'run-realm-456',
    provider: 'postgres',
    verdict: 'FAIL',
    durationMs: 20,
    error: 'boom',
    timestamp: '2026-03-19T05:00:01.000Z'
  });

  assert.equal(projection.steps, undefined);
  assert.equal(projection.error, 'boom');
});

test('readSnapshotProjection parses the canonical snapshot file shape', async () => {
  const projection = await readSnapshotProjection({
    async read(path) {
      assert.equal(path, GENERATED_SNAPSHOT_PATH);
      return JSON.stringify({ irVersion: '1.0.0', tables: [{ name: 'User', fields: [] }] });
    }
  });

  assert.deepEqual(projection, {
    irVersion: '1.0.0',
    tables: [{ name: 'User', fields: [] }]
  });
});

test('readRealmProjection parses the canonical realm file shape', async () => {
  const projection = await readRealmProjection({
    async read(path) {
      assert.equal(path, GENERATED_REALM_PATH);
      return JSON.stringify({
        transmutation: 'null-generator',
        runId: 'run-realm-789',
        provider: 'postgres',
        verdict: 'PASS',
        duration_ms: 30,
        timestamp: '2026-03-19T05:00:02.000Z'
      });
    }
  });

  assert.deepEqual(projection, {
    transmutation: 'null-generator',
    runId: 'run-realm-789',
    provider: 'postgres',
    verdict: 'PASS',
    duration_ms: 30,
    timestamp: '2026-03-19T05:00:02.000Z'
  });
});
