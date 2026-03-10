import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSafeOpName,
  sanitizeOpName,
  derivePrefixedOpName,
  assertOpNameFitsLimit
} from '../../src/domain/qir/validateOpName.mjs';

// ────────────────────────────────────────────────────────────────────────────
// assertSafeOpName
// ────────────────────────────────────────────────────────────────────────────

test('assertSafeOpName: accepts valid names', () => {
  assert.doesNotThrow(() => assertSafeOpName('my_query'));
  assert.doesNotThrow(() => assertSafeOpName('all_users'));
  assert.doesNotThrow(() => assertSafeOpName('q'));
});

test('assertSafeOpName: rejects empty/null/non-string', () => {
  assert.throws(() => assertSafeOpName(''), /non-empty string/);
  assert.throws(() => assertSafeOpName(null), /non-empty string/);
  assert.throws(() => assertSafeOpName(undefined), /non-empty string/);
  assert.throws(() => assertSafeOpName(42), /non-empty string/);
});

test('assertSafeOpName: rejects forward slash', () => {
  assert.throws(() => assertSafeOpName('foo/bar'), /path-traversal/);
});

test('assertSafeOpName: rejects backslash', () => {
  assert.throws(() => assertSafeOpName('foo\\bar'), /path-traversal/);
});

test('assertSafeOpName: rejects dot-dot', () => {
  assert.throws(() => assertSafeOpName('../escape'), /path-traversal/);
  assert.throws(() => assertSafeOpName('foo..bar'), /path-traversal/);
});

// ────────────────────────────────────────────────────────────────────────────
// sanitizeOpName
// ────────────────────────────────────────────────────────────────────────────

test('sanitizeOpName: lowercases and replaces non-alnum', () => {
  assert.equal(sanitizeOpName('My Query!'), 'my_query');
});

test('sanitizeOpName: strips diacritics via NFKD', () => {
  assert.equal(sanitizeOpName('café'), 'cafe');
});

test('sanitizeOpName: prefixes digit-leading names', () => {
  assert.equal(sanitizeOpName('123go'), '_123go');
});

test('sanitizeOpName: falls back to unnamed for empty input', () => {
  assert.equal(sanitizeOpName(''), 'unnamed');
  assert.equal(sanitizeOpName(null), 'unnamed');
  assert.equal(sanitizeOpName('___'), 'unnamed');
});

test('sanitizeOpName: trims leading/trailing underscores', () => {
  assert.equal(sanitizeOpName('__hello__'), 'hello');
});

// ────────────────────────────────────────────────────────────────────────────
// derivePrefixedOpName
// ────────────────────────────────────────────────────────────────────────────

test('derivePrefixedOpName: prefixes with op_', () => {
  assert.equal(derivePrefixedOpName('my_query'), 'op_my_query');
});

test('derivePrefixedOpName: op base becomes op_unnamed', () => {
  assert.equal(derivePrefixedOpName('op'), 'op_unnamed');
});

test('derivePrefixedOpName: empty base becomes op_unnamed', () => {
  assert.equal(derivePrefixedOpName(''), 'op_unnamed');
});

// ────────────────────────────────────────────────────────────────────────────
// assertOpNameFitsLimit
// ────────────────────────────────────────────────────────────────────────────

test('assertOpNameFitsLimit: accepts names within limit', () => {
  assert.doesNotThrow(() => assertOpNameFitsLimit('short', 63));
});

test('assertOpNameFitsLimit: rejects base name exceeding limit', () => {
  const longName = 'a'.repeat(64);
  assert.throws(() => assertOpNameFitsLimit(longName, 63), /exceeds identifier limit/);
  try {
    assertOpNameFitsLimit(longName, 63, '/ops/test.graphql');
  } catch (e) {
    assert.equal(e.code, 'OPS_IDENTIFIER_TOO_LONG');
    assert.equal(e.meta.file, '/ops/test.graphql');
  }
});

test('assertOpNameFitsLimit: rejects prefixed name exceeding limit', () => {
  // Base fits (60 chars) but op_ prefix pushes it to 63 which is fine,
  // 61 chars + op_ = 64 which exceeds
  const name61 = 'a'.repeat(61);
  assert.throws(() => assertOpNameFitsLimit(name61, 63), /exceeds identifier limit/);
});

test('assertOpNameFitsLimit: counts UTF-8 bytes not chars', () => {
  // Each emoji is 4 bytes in UTF-8; 16 emojis = 64 bytes
  const emoji16 = '\u{1F600}'.repeat(16);
  assert.throws(() => assertOpNameFitsLimit(emoji16, 63), /exceeds identifier limit/);
});
