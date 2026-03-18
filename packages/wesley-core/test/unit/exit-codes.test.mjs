import test from 'node:test';
import assert from 'node:assert/strict';

import { exitCodeFor, isRegistered, getRegistry } from '../../src/domain/ExitCodes.mjs';

// ---------------------------------------------------------------------------
// exitCodeFor
// ---------------------------------------------------------------------------

test('exitCodeFor — returns 2 for configuration/input errors', () => {
  for (const code of [
    'ENOENT', 'EEMPTYSCHEMA', 'EEXIST', 'EARGS', 'EUSAGE',
    'ERR_MISSING_ARGUMENT', 'DIRTY_WORKTREE', 'NO_DSN',
    'INVALID_TARGET', 'UNSUPPORTED_OPTION', 'INVALID_LOG_FORMAT',
    'UNKNOWN_TRANSMUTATION',
    'OPS_ALLOW_ERRORS_FORBIDDEN', 'OPS_INVALID_SECURITY'
  ]) {
    assert.equal(exitCodeFor(code), 2, `${code} should map to exit code 2`);
  }
});

test('exitCodeFor — returns 3 for parsing errors', () => {
  for (const code of [
    'PARSE_FAILED', 'SCHEMA_RESOLUTION_FAILED',
    'OPS_COLLISION', 'OPS_IDENTIFIER_TOO_LONG'
  ]) {
    assert.equal(exitCodeFor(code), 3, `${code} should map to exit code 3`);
  }
});

test('exitCodeFor — returns 4 for generation/plugin errors', () => {
  for (const code of [
    'GENERATION_FAILED', 'REALM_FAILED', 'TTD_COMPILE_FAILED',
    'OPS_EMPTY_SET', 'WPLY001', 'WPLY002', 'WPLY003', 'WPLY004'
  ]) {
    assert.equal(exitCodeFor(code), 4, `${code} should map to exit code 4`);
  }
});

test('exitCodeFor — returns 5 for validation/certification errors', () => {
  for (const code of [
    'VALIDATION_FAILED', 'CERT_INVALID',
    'OPS_MANIFEST_INVALID', 'OPS_COMPILE_FAILED', 'DIFF_FAILED'
  ]) {
    assert.equal(exitCodeFor(code), 5, `${code} should map to exit code 5`);
  }
});

test('exitCodeFor — returns 6 for pipeline execution errors', () => {
  assert.equal(exitCodeFor('PIPELINE_EXEC_FAILED'), 6);
});

test('exitCodeFor — returns 1 for unknown error codes', () => {
  assert.equal(exitCodeFor('UNKNOWN_CODE'), 1);
  assert.equal(exitCodeFor(''), 1);
  assert.equal(exitCodeFor(undefined), 1);
});

// ---------------------------------------------------------------------------
// isRegistered
// ---------------------------------------------------------------------------

test('isRegistered — returns true for known codes', () => {
  assert.equal(isRegistered('ENOENT'), true);
  assert.equal(isRegistered('WPLY003'), true);
  assert.equal(isRegistered('PARSE_FAILED'), true);
});

test('isRegistered — returns false for unknown codes', () => {
  assert.equal(isRegistered('NOT_A_REAL_CODE'), false);
  assert.equal(isRegistered(''), false);
});

// ---------------------------------------------------------------------------
// getRegistry
// ---------------------------------------------------------------------------

test('getRegistry — returns an object with all known codes', () => {
  const registry = getRegistry();
  assert.equal(typeof registry, 'object');
  assert.equal(Object.keys(registry).length, 32, 'should have exactly 32 registered codes');
  assert.equal(registry.UNKNOWN_TRANSMUTATION, 2);
});

test('getRegistry — registry is immutable (frozen object)', () => {
  const registry = getRegistry();
  assert.throws(() => { registry.NEW_CODE = 99; }, TypeError);
  assert.throws(() => { registry.ENOENT = 99; }, TypeError);
});
