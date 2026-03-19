import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSnapshotProjection,
  buildRealmProjection
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
    transmutation: 'legacy-supabase',
    runId: 'run-realm-123',
    provider: 'postgres',
    verdict: 'PASS',
    durationMs: 10,
    steps: 2,
    timestamp: '2026-03-19T05:00:00.000Z'
  });

  assert.deepEqual(projection, {
    transmutation: 'legacy-supabase',
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
    transmutation: 'legacy-supabase',
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
