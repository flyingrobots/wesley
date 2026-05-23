/**
 * Unit tests for wesley doctor check functions
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkNodeVersion,
  checkHash,
  checkExperimental,
  formatText,
  formatJson
} from '../src/commands/doctor-checks.mjs';

// ── checkNodeVersion ───────────────────────────────────────────────

test('checkNodeVersion passes for v22.1.0', () => {
  const r = checkNodeVersion('v22.1.0');
  assert.equal(r.status, 'pass');
  assert.match(r.message, /Node\.js v22\.1\.0/);
});

test('checkNodeVersion passes for v22.0.0', () => {
  const r = checkNodeVersion('v22.0.0');
  assert.equal(r.status, 'pass');
});

test('checkNodeVersion passes for v25.0.0', () => {
  const r = checkNodeVersion('v25.0.0');
  assert.equal(r.status, 'pass');
});

test('checkNodeVersion fails for v16.20.0', () => {
  const r = checkNodeVersion('v16.20.0');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /does not meet/);
});

test('checkNodeVersion fails for v21.9.0', () => {
  const r = checkNodeVersion('v21.9.0');
  assert.equal(r.status, 'fail');
});

test('checkNodeVersion fails for unparseable version', () => {
  const r = checkNodeVersion('garbage');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /Unable to parse/);
});

// ── checkHash ──────────────────────────────────────────────────────

test('checkHash passes when crypto.sha256 works', () => {
  const ctx = {
    crypto: {
      sha256: () => 'a'.repeat(64)
    }
  };
  const r = checkHash(ctx);
  assert.equal(r.status, 'pass');
  assert.match(r.message, /SHA-256 available/);
});

test('checkHash fails when crypto is missing', () => {
  const r = checkHash({});
  assert.equal(r.status, 'fail');
});

test('checkHash fails when sha256 throws', () => {
  const ctx = {
    crypto: {
      sha256: () => {
        throw new Error('boom');
      }
    }
  };
  const r = checkHash(ctx);
  assert.equal(r.status, 'fail');
  assert.match(r.message, /boom/);
});

test('checkHash fails when digest has wrong length', () => {
  const ctx = {
    crypto: {
      sha256: () => 'short'
    }
  };
  const r = checkHash(ctx);
  assert.equal(r.status, 'fail');
});

// ── checkExperimental ──────────────────────────────────────────────

test('checkExperimental returns info with no flags', () => {
  const ctx = { env: { HOME: '/home/user' } };
  const r = checkExperimental(ctx);
  assert.equal(r.status, 'info');
  assert.match(r.message, /none/);
});

test('checkExperimental lists flags from env', () => {
  const ctx = {
    env: {
      WESLEY_EXPERIMENTAL_IRV2: '1',
      WESLEY_EXPERIMENTAL_RAWLE: 'false',
      OTHER_VAR: 'ignored'
    }
  };
  const r = checkExperimental(ctx);
  assert.equal(r.status, 'info');
  assert.match(r.message, /irv2=true/);
  assert.match(r.message, /rawle=false/);
  assert.ok(!r.message.includes('OTHER_VAR'));
});

// ── formatText ─────────────────────────────────────────────────────

test('formatText renders [pass], [fail], [info] prefixes', () => {
  const results = [
    { name: 'A', status: 'pass', message: 'all good' },
    { name: 'B', status: 'fail', message: 'broken' },
    { name: 'C', status: 'info', message: 'fyi' }
  ];
  const text = formatText(results);
  const lines = text.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^\[pass\] all good$/);
  assert.match(lines[1], /^\[fail\] broken$/);
  assert.match(lines[2], /^\[info\] fyi$/);
});

// ── formatJson ─────────────────────────────────────────────────────

test('formatJson produces valid JSON with ok: true when all pass', () => {
  const results = [
    { name: 'A', status: 'pass', message: 'ok' },
    { name: 'B', status: 'info', message: 'fyi' }
  ];
  const parsed = JSON.parse(formatJson(results));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.checks.length, 2);
});

test('formatJson produces ok: false when any fail', () => {
  const results = [
    { name: 'A', status: 'pass', message: 'ok' },
    { name: 'B', status: 'fail', message: 'bad' }
  ];
  const parsed = JSON.parse(formatJson(results));
  assert.equal(parsed.ok, false);
});
