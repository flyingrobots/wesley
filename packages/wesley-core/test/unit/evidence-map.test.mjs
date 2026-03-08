import test from 'node:test';
import assert from 'node:assert/strict';

import { EvidenceMap } from '../../src/application/EvidenceMap.mjs';

// ---------------------------------------------------------------------------
// fromJSON round-trip
// ---------------------------------------------------------------------------

test('EvidenceMap.fromJSON — restores evidence entries', () => {
  const original = new EvidenceMap();
  original.setSha('abc123');
  original.record('col:User.id', 'ddl', { file: 'ddl/User.sql', lines: [1, 1] });

  const restored = EvidenceMap.fromJSON(original.toJSON());

  assert.equal(restored.sha, 'abc123');
  const evidence = restored.getEvidence('col:User.id');
  assert.ok(evidence.ddl);
  assert.equal(evidence.ddl.length, 1);
  assert.equal(evidence.ddl[0].file, 'ddl/User.sql');
});

test('EvidenceMap.fromJSON — restores errors', () => {
  const original = new EvidenceMap();
  original.recordError('col:User.id', {
    message: 'Missing NOT NULL',
    type: 'constraint',
    severity: 'error'
  });

  const json = original.toJSON();
  assert.ok(json.errors['col:User.id'], 'toJSON should include errors');

  const restored = EvidenceMap.fromJSON(json);

  const errors = restored.getErrors('col:User.id');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Missing NOT NULL');
  assert.equal(errors[0].type, 'constraint');
  assert.ok(restored.hasErrors());
});

test('EvidenceMap.fromJSON — restores warnings', () => {
  const original = new EvidenceMap();
  original.recordWarning('col:User.email', {
    message: 'Consider adding index',
    type: 'performance',
    severity: 'warning'
  });

  const json = original.toJSON();
  assert.ok(json.warnings['col:User.email'], 'toJSON should include warnings');

  const restored = EvidenceMap.fromJSON(json);

  const warnings = restored.getWarnings('col:User.email');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].message, 'Consider adding index');
  assert.equal(warnings[0].type, 'performance');
});

test('EvidenceMap.fromJSON — full round-trip preserves all data', () => {
  const original = new EvidenceMap();
  original.setSha('deadbeef');
  original.record('col:User.id', 'ddl', { file: 'x.sql', lines: [1, 1] });
  original.record('col:User.id', 'ts', { file: 'x.ts', lines: [5, 10] });
  original.recordError('col:User.id', { message: 'err1', type: 't', severity: 'error' });
  original.recordError('col:User.name', { message: 'err2', type: 't', severity: 'error' });
  original.recordWarning('col:User.id', { message: 'warn1', type: 't', severity: 'warning' });

  const json = original.toJSON();
  const restored = EvidenceMap.fromJSON(json);
  const roundTripped = restored.toJSON();

  assert.deepEqual(roundTripped.evidence, json.evidence);
  assert.deepEqual(roundTripped.errors, json.errors);
  assert.deepEqual(roundTripped.warnings, json.warnings);
  assert.equal(roundTripped.sha, json.sha);
  assert.equal(roundTripped.version, json.version);
});

test('EvidenceMap.fromJSON — handles empty errors/warnings gracefully', () => {
  const json = {
    version: '1.0.0',
    sha: 'abc',
    timestamp: '2026-01-01T00:00:00.000Z',
    evidence: {}
  };

  const restored = EvidenceMap.fromJSON(json);
  assert.equal(restored.hasErrors(), false);
  assert.deepEqual(restored.getAllWarnings(), []);
});
