import test from 'node:test';
import assert from 'node:assert/strict';

import { registryHash, canonicalizeJSON } from '../../src/domain/registryHash.mjs';

// ─── canonicalizeJSON contract ──────────────────────────────────────

test('canonicalizeJSON: sorts object keys at top level', () => {
  const result = canonicalizeJSON({ z: 1, a: 2, m: 3 });
  assert.equal(result, '{"a":2,"m":3,"z":1}');
});

test('canonicalizeJSON: recursively sorts nested object keys', () => {
  const result = canonicalizeJSON({ b: { z: 1, a: 2 }, a: { y: 3, x: 4 } });
  assert.equal(result, '{"a":{"x":4,"y":3},"b":{"a":2,"z":1}}');
});

test('canonicalizeJSON: preserves array element order', () => {
  const result = canonicalizeJSON({ items: [3, 1, 2] });
  assert.equal(result, '{"items":[3,1,2]}');
});

test('canonicalizeJSON: sorts keys inside objects nested within arrays', () => {
  const result = canonicalizeJSON([{ z: 1, a: 2 }, { b: 3, a: 4 }]);
  assert.equal(result, '[{"a":2,"z":1},{"a":4,"b":3}]');
});

test('canonicalizeJSON: compact output with no whitespace', () => {
  const result = canonicalizeJSON({ hello: 'world', nested: { foo: 'bar' } });
  assert.ok(!result.includes(' '));
  assert.ok(!result.includes('\n'));
});

test('canonicalizeJSON: handles null, booleans, and numbers', () => {
  const result = canonicalizeJSON({ n: null, b: true, f: false, i: 42, d: 3.14 });
  assert.equal(result, '{"b":true,"d":3.14,"f":false,"i":42,"n":null}');
});

// ─── registryHash basic contract ────────────────────────────────────

test('registryHash: returns a 64-char lowercase hex string', async () => {
  const hash = await registryHash({ types: [], ops: [] });
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('registryHash: determinism — hashing same object twice yields identical result', async () => {
  const data = { types: [{ name: 'User', kind: 'OBJECT' }], ops: [] };
  const a = await registryHash(data);
  const b = await registryHash(data);
  assert.equal(a, b);
});

test('registryHash: different key insertion order → same hash', async () => {
  const a = await registryHash({ z: 1, a: 2, m: 3 });
  const b = await registryHash({ a: 2, m: 3, z: 1 });
  assert.equal(a, b);
});

test('registryHash: different objects → different hashes', async () => {
  const a = await registryHash({ types: [{ name: 'User' }] });
  const b = await registryHash({ types: [{ name: 'Post' }] });
  assert.notEqual(a, b);
});

// ─── sensitivity ────────────────────────────────────────────────────

test('registryHash: adding a field changes hash', async () => {
  const before = await registryHash({ types: [{ name: 'User' }] });
  const after = await registryHash({ types: [{ name: 'User', extra: true }] });
  assert.notEqual(before, after);
});

test('registryHash: removing a field changes hash', async () => {
  const before = await registryHash({ types: [{ name: 'User', extra: true }] });
  const after = await registryHash({ types: [{ name: 'User' }] });
  assert.notEqual(before, after);
});

test('registryHash: nested key order does not affect hash', async () => {
  const a = await registryHash({
    types: [{ fields: [{ name: 'id', type: 'ID' }], name: 'User', kind: 'OBJECT' }],
  });
  const b = await registryHash({
    types: [{ kind: 'OBJECT', name: 'User', fields: [{ type: 'ID', name: 'id' }] }],
  });
  assert.equal(a, b);
});

test('registryHash: array order matters', async () => {
  const a = await registryHash({ items: ['alpha', 'beta'] });
  const b = await registryHash({ items: ['beta', 'alpha'] });
  assert.notEqual(a, b);
});

// ─── golden vectors (pinned expected hashes) ────────────────────────

const GOLDEN_VECTORS = [
  {
    name: 'empty-registry',
    data: { ops: [], types: [] },
    // canonical: {"ops":[],"types":[]}
    hash: null, // computed below
  },
  {
    name: 'single-type',
    data: { types: [{ kind: 'OBJECT', name: 'User', fields: [{ name: 'id', type: 'ID', required: true, list: false }] }] },
    hash: null,
  },
  {
    name: 'with-ops',
    data: {
      types: [{ kind: 'ENUM', name: 'Status', values: ['ACTIVE', 'INACTIVE'] }],
      ops: [{ kind: 'QUERY', name: 'getStatus', op_id: 12345, args: [], result_type: 'Status' }],
    },
    hash: null,
  },
];

// Pre-compute golden hashes on first run, then pin them.
// We compute them here so the test file is self-contained.
// The actual pinned values are asserted below.

test('registryHash: golden vector — empty-registry', async () => {
  const hash = await registryHash(GOLDEN_VECTORS[0].data);
  assert.equal(hash, '37ddc2a41b81b9dd7f1cc4da7969b936803ef6780469b6a262d7c2a32bd73831');
});

test('registryHash: golden vector — single-type', async () => {
  const hash = await registryHash(GOLDEN_VECTORS[1].data);
  assert.equal(hash, 'e434facf57cc631ad3de015d9998bba33faeba0c0c01349f8380b408783ed814');
});

test('registryHash: golden vector — with-ops', async () => {
  const hash = await registryHash(GOLDEN_VECTORS[2].data);
  assert.equal(hash, 'db7405e986a5c4ca02a03d022c84ed3bf2833632da2d1cbb439e79311c986d68');
});
