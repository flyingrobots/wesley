import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHolmesSuiteComment,
  HOLMES_SUITE_COMMENT_MARKER
} from '../src/pr-comment.mjs';

function sampleHolmesReport(overrides = {}) {
  return {
    metadata: {
      generatedAt: '2026-03-30T00:00:00Z',
      sha: 'abcdef1234567890',
      verificationStatus: 'REQUIRES INVESTIGATION',
      readinessStatus: 'ELEMENTARY',
      verificationCount: 12,
      weightedCompletion: 0.74,
      tci: 0.52,
      mri: 0.46,
      bundleVersion: '1.0.0',
      evidenceTrust: 'weak',
      citationQuality: {
        exact: 4,
        wholeFile: 3,
        coarse: 2
      }
    },
    scores: {
      scs: 0.74,
      tci: 0.52,
      mri: 0.46
    },
    gates: [
      { gate: 'Migration Risk', status: '⛔', evidence: 'MRI: 46.0%', ruling: 'HIGH RISK!' },
      { gate: 'Test Coverage', status: '⚠️', evidence: 'TCI: 52.0%', ruling: 'Insufficient coverage' },
      { gate: 'Sensitive Fields', status: '⛔', evidence: '2 fields', ruling: '1 EXPOSED!' },
      { gate: 'Evidence Quality', status: '⚠️', evidence: '4 exact · 3 whole-file · 2 coarse', ruling: 'Some claims still rely on coarse citations.' }
    ],
    verdict: {
      code: 'REQUIRES INVESTIGATION',
      message: 'Further investigation required before shipping.',
      markdown: '⚠️ investigate'
    },
    ...overrides
  };
}

function sampleWatsonReport(overrides = {}) {
  return {
    metadata: {
      examinedAt: '2026-03-30T00:10:00Z',
      sha: 'abcdef1234567890'
    },
    citations: {
      total: 10,
      verified: 6,
      failed: 1,
      unverified: 3,
      exact: 4,
      wholeFile: 3,
      coarse: 2,
      trust: 'weak',
      reasons: ['Some citations are too coarse to trust blindly.'],
      rate: 0.6
    },
    math: {
      claimedScs: 0.74,
      recalculatedScs: 0.74,
      difference: 0,
      acceptable: true
    },
    inconsistencies: ['One cited span no longer matches the current file contents.'],
    opinion: {
      verdict: 'CONCERNS',
      message: 'Discrepancies detected; further investigation recommended.',
      markdown: '⚠️ concerns'
    },
    ...overrides
  };
}

function sampleMoriartyReport(overrides = {}) {
  return {
    metadata: { analysisAt: '2026-03-30T00:20:00Z' },
    status: 'OK',
    history: [
      { timestamp: '2026-03-28T00:00:00Z', scs: 0.6, tci: 0.4, mri: 0.5 },
      { timestamp: '2026-03-29T00:00:00Z', scs: 0.68, tci: 0.48, mri: 0.47 },
      { timestamp: '2026-03-30T00:00:00Z', scs: 0.74, tci: 0.52, mri: 0.46, evidenceTrust: 'weak', evidenceTrustReasons: ['Citations are still coarse.'] }
    ],
    plateauDetected: false,
    regressionDetected: false,
    eta: {
      optimistic: 3,
      realistic: 5,
      pessimistic: 8,
      optimisticDate: '2026-04-02',
      realisticDate: '2026-04-04',
      pessimisticDate: '2026-04-07'
    },
    confidence: 61,
    patterns: [],
    warnings: ['Evidence trust is weak; Citations are still coarse.'],
    ...overrides
  };
}

test('buildHolmesSuiteComment adds a plain-English summary, next actions, and glossary', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    statuses: {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    },
    holmesReport: sampleHolmesReport(),
    watsonReport: sampleWatsonReport(),
    moriartyReport: sampleMoriartyReport(),
    holmesMarkdown: '### raw holmes',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: '### raw moriarty'
  });

  assert.ok(comment.includes(HOLMES_SUITE_COMMENT_MARKER));
  assert.ok(comment.includes('## Plain-English Readout'));
  assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
  assert.ok(comment.includes('## Suggested next actions'));
  assert.ok(comment.includes('Tighten citations so the report points to exact lines instead of whole files or coarse references.'));
  assert.ok(comment.includes('<details><summary>📚 Glossary (what the Holmes terms mean)</summary>'));

  const visibleSummary = comment.split('<details><summary>📚 Glossary')[0];
  assert.equal(visibleSummary.includes('SCS'), false, 'visible summary should avoid unexplained score acronyms');
  assert.equal(visibleSummary.includes('TCI'), false, 'visible summary should avoid unexplained score acronyms');
  assert.equal(visibleSummary.includes('MRI'), false, 'visible summary should avoid unexplained score acronyms');
});

test('buildHolmesSuiteComment explains unavailable reports without crashing the comment', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    statuses: {
      holmes: 'failure',
      watson: 'success',
      moriarty: 'cancelled'
    },
    holmesReport: null,
    watsonReport: sampleWatsonReport({ opinion: { verdict: 'PASSED', message: 'ok', markdown: 'ok' }, inconsistencies: [] }),
    moriartyReport: null,
    holmesMarkdown: '',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: ''
  });

  assert.ok(comment.includes('The Holmes report is unavailable because the workflow status is failure.'));
  assert.ok(comment.includes('The Moriarty forecast is unavailable because the workflow status is cancelled.'));
  assert.ok(comment.includes('Fix the HOLMES workflow job first so the PR has a real evidence investigation again.'));
});
