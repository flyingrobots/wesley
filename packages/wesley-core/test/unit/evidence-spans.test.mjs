import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countContentLines,
  extractContentForLineSpan,
  isExactLineSpan,
  lineSpanForContent,
  parseLineSpan
} from '../../src/application/EvidenceSpans.mjs';

test('countContentLines counts logical lines without inventing a trailing blank line', () => {
  assert.equal(countContentLines(''), 1);
  assert.equal(countContentLines('one line'), 1);
  assert.equal(countContentLines('first\nsecond'), 2);
  assert.equal(countContentLines('first\nsecond\n'), 2);
  assert.equal(countContentLines('first\r\nsecond\r\nthird'), 3);
});

test('lineSpanForContent returns an exact whole-file span', () => {
  assert.equal(lineSpanForContent(''), '1-1');
  assert.equal(lineSpanForContent('-- ddl\ncreate table users ();'), '1-2');
  assert.equal(lineSpanForContent('-- ddl\r\ncreate table users ();'), '1-2');
});

test('parseLineSpan and exactness helpers reject wildcards and malformed ranges', () => {
  assert.deepEqual(parseLineSpan('2-4'), { start: 2, end: 4 });
  assert.deepEqual(parseLineSpan([3, 3]), { start: 3, end: 3 });
  assert.equal(parseLineSpan('1-*'), null);
  assert.equal(parseLineSpan('nope'), null);
  assert.equal(isExactLineSpan('2-4'), true);
  assert.equal(isExactLineSpan('1-*'), false);
});

test('extractContentForLineSpan returns the cited lines only', () => {
  const content = ['one', 'two', 'three', ''].join('\n');
  assert.equal(extractContentForLineSpan(content, '2-3'), 'two\nthree');
  assert.equal(extractContentForLineSpan(content, [1, 1]), 'one');
  assert.equal(extractContentForLineSpan(content, '1-*'), null);
  assert.equal(extractContentForLineSpan(content, '8-9'), null);
});
