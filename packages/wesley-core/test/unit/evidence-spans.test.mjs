import test from 'node:test';
import assert from 'node:assert/strict';

import { countContentLines, lineSpanForContent } from '../../src/application/EvidenceSpans.mjs';

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
