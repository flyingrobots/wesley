import test from 'node:test';
import assert from 'node:assert/strict';
import { WesleyError, OpsError, PluginError } from '../../src/domain/WesleyError.mjs';

test('WesleyError carries code, message, and meta', () => {
  const err = new WesleyError('TEST_CODE', 'something broke', { file: 'x.mjs' });
  assert.equal(err.code, 'TEST_CODE');
  assert.equal(err.message, 'something broke');
  assert.deepEqual(err.meta, { file: 'x.mjs' });
  assert.equal(err.name, 'WesleyError');
  assert.ok(err instanceof Error);
  assert.ok(err instanceof WesleyError);
});

test('WesleyError defaults meta to empty object', () => {
  const err = new WesleyError('CODE', 'msg');
  assert.deepEqual(err.meta, {});
});

test('OpsError extends WesleyError', () => {
  const err = new OpsError('OPS_FAIL', 'op broke', { op: 'foo' });
  assert.equal(err.name, 'OpsError');
  assert.equal(err.code, 'OPS_FAIL');
  assert.ok(err instanceof WesleyError);
  assert.ok(err instanceof Error);
});

test('PluginError extends WesleyError', () => {
  const err = new PluginError('WPLY002', 'plugin crashed', { plugin: 'echo', phase: 'generate' });
  assert.equal(err.name, 'PluginError');
  assert.equal(err.code, 'WPLY002');
  assert.deepEqual(err.meta, { plugin: 'echo', phase: 'generate' });
  assert.ok(err instanceof WesleyError);
});

test('WesleyError has a stack trace', () => {
  const err = new WesleyError('X', 'y');
  assert.ok(typeof err.stack === 'string');
  assert.ok(err.stack.includes('WesleyError'));
});

test('WesleyError forwards cause to native Error cause chain', () => {
  const original = new Error('root cause');
  const err = new WesleyError('WRAP', 'wrapped', { file: 'x.mjs' }, original);
  assert.equal(err.cause, original);
  assert.equal(err.message, 'wrapped');
  assert.deepEqual(err.meta, { file: 'x.mjs' });
});

test('WesleyError cause defaults to undefined when omitted', () => {
  const err = new WesleyError('CODE', 'msg');
  assert.equal(err.cause, undefined);
});

test('OpsError forwards cause', () => {
  const original = new Error('db down');
  const err = new OpsError('OPS_FAIL', 'op broke', { op: 'foo' }, original);
  assert.equal(err.cause, original);
});

test('PluginError forwards cause', () => {
  const original = new TypeError('bad input');
  const err = new PluginError('WPLY002', 'crashed', { plugin: 'x' }, original);
  assert.equal(err.cause, original);
});
