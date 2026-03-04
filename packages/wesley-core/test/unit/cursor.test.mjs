import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeCursor, decodeCursor } from '../../src/domain/qir/Cursor.mjs';

test('cursor encode/decode round-trip', () => {
  const obj = { id: '123', after: 10, flags: ['a','b'] };
  const cur = encodeCursor(obj);
  const out = decodeCursor(cur);
  assert.deepEqual(out, obj);
});

test('cursor decode handles garbage', () => {
  assert.deepEqual(decodeCursor('not-base64'), {});
  assert.deepEqual(decodeCursor(''), {});
});

test('cursor decode strips __proto__ and constructor keys (m6)', () => {
  // Manually encode a payload with __proto__
  const malicious = JSON.stringify({ __proto__: { admin: true }, constructor: 'bad', id: '1' });
  const b64 = btoa(malicious).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decoded = decodeCursor(b64);
  assert.strictEqual(decoded.__proto__, Object.prototype, '__proto__ must not carry attacker value');
  assert.strictEqual(decoded.constructor, Object.prototype.constructor, 'constructor must not carry attacker value');
  assert.strictEqual(decoded.id, '1');
});

