import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceMap } from '../../src/application/EvidenceMap.mjs';
import { findSourceForSql } from '../../src/application/SourceMap.mjs';

test('findSourceForSql maps SQL line to SDL location via uid', () => {
  const ev = new EvidenceMap();
  const uid = 'col:post.title';
  ev.record(uid, 'sql',    { file: 'out/schema.sql', lines: '10-10' });
  ev.record(uid, 'source', { file: 'schema.graphql', lines: '3-3', columns: '5-16' });

  const result = findSourceForSql(ev, { file: 'out/schema.sql', line: 10 });
  assert.ok(result);
  assert.equal(result.uid, uid);
  assert.equal(result.source.file, 'schema.graphql');
  assert.equal(result.source.lines, '3-3');
});

