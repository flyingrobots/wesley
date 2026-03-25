import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { decodeCursor, encodeCursor } from '../../src/domain/qir/Cursor.mjs';
import { derivePrefixedOpName, sanitizeOpName } from '../../src/domain/qir/validateOpName.mjs';

const LOWER_ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const UPPER_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const UNDERSCORE = '_';

function identifierArbitrary({ minLength = 1, maxLength = 16 } = {}) {
  return fc.tuple(
    fc.constantFrom(...(LOWER_ALPHA + UPPER_ALPHA + UNDERSCORE)),
    fc.array(fc.constantFrom(...(LOWER_ALPHA + UPPER_ALPHA + DIGITS + UNDERSCORE)), {
      minLength: Math.max(0, minLength - 1),
      maxLength: Math.max(0, maxLength - 1)
    })
  ).map(([first, rest]) => first + rest.join(''));
}

const shallowJsonValueArbitrary = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), { maxLength: 5 })
);

const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);

const safeCursorPayloadArbitrary = fc.dictionary(identifierArbitrary(), shallowJsonValueArbitrary, {
  maxKeys: 8
}).map((payload) => Object.fromEntries(
  Object.entries(payload).filter(([key]) => !dangerousKeys.has(key))
));

test('cursor fuzz: encode/decode round-trips safe shallow payloads', () => {
  fc.assert(
    fc.property(
      safeCursorPayloadArbitrary,
      (payload) => {
        assert.deepEqual(decodeCursor(encodeCursor(payload)), payload);
      }
    ),
    { numRuns: 200, seed: 42 }
  );
});

test('cursor fuzz: decode never throws and always returns a plain object', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const output = decodeCursor(input);
      assert.equal(typeof output, 'object');
      assert.notEqual(output, null);
      assert.equal(Array.isArray(output), false);
    }),
    { numRuns: 500, seed: 42 }
  );
});

test('op-name fuzz: sanitization stays within the safe identifier envelope', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const sanitized = sanitizeOpName(input);
      const prefixed = derivePrefixedOpName(input);

      assert.match(sanitized, /^(unnamed|_?[a-z0-9]+(?:_[a-z0-9]+)*)$/);
      assert.ok(!sanitized.endsWith('_'));
      assert.match(prefixed, /^op_[a-z0-9_]+$/);
    }),
    { numRuns: 300, seed: 42 }
  );
});
