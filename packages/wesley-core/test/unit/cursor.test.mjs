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

