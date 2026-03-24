import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoriartyHistoryTimestamp,
  normalizeMoriartyEvidenceTrustLevel,
  normalizeMoriartyEvidenceTrustReasons,
  normalizeMoriartyHistoryPoints
} from '../src/moriarty-history.mjs';

test('normalizeMoriartyHistoryPoints keeps latest seven points and normalizes trust', () => {
  const points = Array.from({ length: 8 }, (_, index) => ({
    day: index,
    scs: index,
    tci: index / 10,
    mri: index / 100,
    evidenceTrust: index === 7 ? 'weak' : 'unknown'
  }));

  const normalized = normalizeMoriartyHistoryPoints(points);

  assert.equal(normalized.length, 7);
  assert.equal(normalized[0].timestamp, formatMoriartyHistoryTimestamp(1));
  assert.equal(normalized.at(-1).evidenceTrust, 'weak');
  assert.deepEqual(
    normalized.at(-1).evidenceTrustReasons,
    ['Coarse citations remain unpinned to exact line spans.']
  );
  assert.equal('evidenceTrust' in normalized[0], false);
});

test('normalizeMoriartyEvidenceTrustLevel rejects unsupported values', () => {
  assert.equal(normalizeMoriartyEvidenceTrustLevel('moderate'), 'moderate');
  assert.equal(normalizeMoriartyEvidenceTrustLevel('bogus'), null);
});

test('normalizeMoriartyEvidenceTrustReasons falls back to stable defaults', () => {
  assert.deepEqual(
    normalizeMoriartyEvidenceTrustReasons([], 'missing'),
    ['No evidence citations were available for trust analysis.']
  );
  assert.deepEqual(
    normalizeMoriartyEvidenceTrustReasons(['kept', '', 1], 'strong'),
    ['kept']
  );
});
