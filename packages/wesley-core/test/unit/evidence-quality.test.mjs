import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyEvidenceLocation,
  pickBestEvidenceLocation,
  strongestEvidenceStrength,
  summarizeEvidenceQuality,
  totalEvidenceCitations
} from '../../src/application/EvidenceQuality.mjs';

test('classifyEvidenceLocation distinguishes exact, whole-file, and coarse citations', () => {
  const resolver = (file) => {
    if (file === 'schema.sql') return ['one', 'two', 'three', ''].join('\n');
    if (file === 'tests.sql') return ['alpha', 'beta', ''].join('\n');
    return null;
  };

  assert.equal(classifyEvidenceLocation({ file: 'tests.sql', lines: '1-1' }, resolver).strength, 'exact');
  assert.equal(classifyEvidenceLocation({ file: 'schema.sql', lines: '1-3' }, resolver).strength, 'wholeFile');
  assert.equal(classifyEvidenceLocation({ file: 'schema.sql', lines: '1-*' }, resolver).strength, 'coarse');
});

test('summarizeEvidenceQuality and helpers produce cert-friendly totals', () => {
  const resolver = (file) => {
    if (file === 'schema.sql') return ['one', 'two', 'three', ''].join('\n');
    if (file === 'tests.sql') return ['alpha', 'beta', ''].join('\n');
    return null;
  };
  const payload = {
    evidence: {
      schema: {
        sql: [
          { file: 'schema.sql', lines: '1-3' },
          { file: 'schema.sql', lines: '1-*' }
        ],
        tests: [
          { file: 'tests.sql', lines: '1-1' }
        ]
      }
    }
  };

  const summary = summarizeEvidenceQuality(payload, resolver);
  assert.deepEqual(summary, {
    exact: 1,
    wholeFile: 1,
    coarse: 1
  });
  assert.equal(totalEvidenceCitations(summary), 3);
  assert.equal(strongestEvidenceStrength(summary), 'exact');
});

test('pickBestEvidenceLocation prefers narrow exact citations over whole-file and coarse fallbacks', () => {
  const resolver = (file) => {
    if (file === 'schema.sql') return ['one', 'two', 'three', ''].join('\n');
    if (file === 'tests.sql') return ['alpha', 'beta', ''].join('\n');
    return null;
  };
  const evidence = {
    sql: [
      { file: 'schema.sql', lines: '1-3' },
      { file: 'schema.sql', lines: '1-*' }
    ],
    tests: [
      { file: 'tests.sql', lines: '1-1' }
    ]
  };

  const best = pickBestEvidenceLocation(evidence, resolver);
  assert.equal(best.location.file, 'tests.sql');
  assert.equal(best.location.lines, '1-1');
  assert.equal(best.classification.strength, 'exact');
});
