import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adjustReadinessVerdictForEvidenceTrust,
  assessEvidenceTrust,
  classifyEvidenceLocation,
  confidencePenaltyForEvidenceTrust,
  evidenceTrustMeetsThreshold,
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

test('assessEvidenceTrust downgrades coarse citation mixes and explains why', () => {
  assert.deepEqual(
    assessEvidenceTrust({ exact: 2, wholeFile: 1, coarse: 0 }),
    {
      level: 'moderate',
      reasons: ['1 whole-file citation still relies on broad file-level proof.']
    }
  );

  assert.deepEqual(
    assessEvidenceTrust({ exact: 1, wholeFile: 0, coarse: 1 }),
    {
      level: 'weak',
      reasons: ['1 coarse citation remains unpinned to exact line spans.']
    }
  );
});

test('evidence trust helpers drive readiness and confidence decisions', () => {
  assert.equal(evidenceTrustMeetsThreshold('strong'), true);
  assert.equal(evidenceTrustMeetsThreshold('moderate'), true);
  assert.equal(evidenceTrustMeetsThreshold('weak'), false);
  assert.equal(evidenceTrustMeetsThreshold('missing'), false);

  assert.equal(confidencePenaltyForEvidenceTrust('strong'), 0);
  assert.equal(confidencePenaltyForEvidenceTrust('moderate'), 0);
  assert.equal(confidencePenaltyForEvidenceTrust('weak'), 12);
  assert.equal(confidencePenaltyForEvidenceTrust('missing'), 20);

  assert.equal(adjustReadinessVerdictForEvidenceTrust('ELEMENTARY', 'weak'), 'REQUIRES INVESTIGATION');
  assert.equal(adjustReadinessVerdictForEvidenceTrust('ELEMENTARY', 'missing'), 'REQUIRES INVESTIGATION');
  assert.equal(adjustReadinessVerdictForEvidenceTrust('REQUIRES INVESTIGATION', 'weak'), 'REQUIRES INVESTIGATION');
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
