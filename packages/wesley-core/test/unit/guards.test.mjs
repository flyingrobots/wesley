import test from 'node:test';
import assert from 'node:assert/strict';
import { mustFind, mustMatch } from '../../src/util/guards.mjs';

// ─── mustFind ───────────────────────────────────────────────────────

test('mustFind: returns the matching element', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const result = mustFind(items, (i) => i.id === 2, 'not found');
  assert.deepStrictEqual(result, { id: 2 });
});

test('mustFind: throws with the provided message when no element matches', () => {
  assert.throws(() => mustFind([1, 2, 3], (n) => n > 10, 'too small'), { message: 'too small' });
});

test('mustFind: throws an Error instance', () => {
  assert.throws(() => mustFind([], () => true, 'empty'), Error);
});

test('mustFind: returns the first match when multiple elements satisfy the predicate', () => {
  const items = [{ v: 'a' }, { v: 'a' }, { v: 'b' }];
  const result = mustFind(items, (i) => i.v === 'a', 'miss');
  assert.equal(result, items[0]);
});

test('mustFind: works with primitive arrays', () => {
  assert.equal(
    mustFind([10, 20, 30], (n) => n > 15, 'miss'),
    20
  );
});

// ─── mustMatch ──────────────────────────────────────────────────────

test('mustMatch: returns the match array on success', () => {
  const result = mustMatch('foo-42-bar', /(\d+)/, 'no number');
  assert.equal(result[1], '42');
});

test('mustMatch: throws with the provided message when the pattern does not match', () => {
  assert.throws(() => mustMatch('hello', /\d+/, 'expected digits'), { message: 'expected digits' });
});

test('mustMatch: throws an Error instance', () => {
  assert.throws(() => mustMatch('', /x/, 'miss'), Error);
});

test('mustMatch: returns full match info including index', () => {
  const result = mustMatch('abc123', /(\d+)/, 'miss');
  assert.equal(result[0], '123');
  assert.equal(result.index, 3);
});

test('mustMatch: works with string patterns', () => {
  const result = mustMatch('hello world', 'world', 'miss');
  assert.equal(result[0], 'world');
});

test('mustMatch: supports capture groups', () => {
  const result = mustMatch('col_name INTEGER NOT NULL', /^(\w+)\s+(\w+)/, 'bad column def');
  assert.equal(result[1], 'col_name');
  assert.equal(result[2], 'INTEGER');
});
