import test from 'node:test';
import assert from 'node:assert/strict';

import { duplicateKey } from './json-duplicate-key.mjs';

// Oracle: specified. RFC 8259 leaves duplicate names undefined; JSON.parse keeps
// the last one, so a reader of the text sees a value the parser never returns.

test('text without a repeated key has none', () => {
  assert.equal(duplicateKey('{"a": 1, "b": {"a": 2}, "c": [{"a": 3}, {"a": 4}]}'), null);
});

test('a repeated key is found at any depth', () => {
  assert.equal(duplicateKey('{"a": 1, "a": 2}'), 'a');
  assert.equal(duplicateKey('[{"x": {"fieldName": "wrong", "fieldName": "answer"}}]'), 'fieldName');
});

test('keys are compared after unescaping', () => {
  assert.equal(duplicateKey('{"a": 1, "\\u0061": 2}'), 'a');
});

test('a string value that looks like a key is not one', () => {
  assert.equal(duplicateKey('{"a": "\\"a\\": 1", "b": "a"}'), null);
});
