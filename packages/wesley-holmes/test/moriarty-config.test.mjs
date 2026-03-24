import test from 'node:test';
import assert from 'node:assert/strict';

import { createMoriartyConfig } from '../src/moriarty-config.mjs';

test('createMoriartyConfig provides stable defaults', () => {
  const config = createMoriartyConfig({ env: {} });

  assert.equal(config.alpha, 0.4);
  assert.equal(config.minSlope, 0.01);
  assert.equal(config.useGitActivity, true);
  assert.equal(config.gitWindowHours, 24);
  assert.equal(config.baseRef, 'main');
  assert.deepEqual(config.readinessThresholds, {
    scs: 0.8,
    tci: 0.7,
    mri: 0.4,
    ci: 0.9,
    evidenceTrust: 'moderate'
  });
});

test('createMoriartyConfig honors environment overrides', () => {
  const config = createMoriartyConfig({
    env: {
      MORIARTY_USE_GIT: '0',
      MORIARTY_GIT_WINDOW_HOURS: '6',
      MORIARTY_ACTIVITY_THRESHOLD: '0.55',
      MORIARTY_ACTIVITY_COMMITS_PER_DAY: '9',
      MORIARTY_ACTIVITY_RELEVANT_PER_DAY: '7',
      MORIARTY_ACTIVITY_LINES_PER_DAY: '900',
      MORIARTY_ACTIVITY_FILES_PER_DAY: '16',
      MORIARTY_CONFIDENCE_BURSTINESS_MAX_PCT: '22',
      MORIARTY_BASE_REF: 'release/next',
      MORIARTY_READY_SCS: '0.9',
      MORIARTY_READY_TCI: '0.85',
      MORIARTY_READY_MRI: '0.2',
      MORIARTY_READY_CI_STABILITY: '0.97',
      MORIARTY_READY_EVIDENCE_TRUST: 'strong'
    }
  });

  assert.equal(config.useGitActivity, false);
  assert.equal(config.gitWindowHours, 6);
  assert.equal(config.activityPlateauThreshold, 0.55);
  assert.equal(config.activityCommitThreshold, 9);
  assert.equal(config.activityRelevantCommitThreshold, 7);
  assert.equal(config.activityLinesPerDayTarget, 900);
  assert.equal(config.activityFilesPerDayTarget, 16);
  assert.equal(config.confidenceBurstinessMax, 22);
  assert.equal(config.baseRef, 'release/next');
  assert.deepEqual(config.readinessThresholds, {
    scs: 0.9,
    tci: 0.85,
    mri: 0.2,
    ci: 0.97,
    evidenceTrust: 'strong'
  });
});
