import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  buildHolmesSuiteComment,
  HOLMES_SUITE_COMMENT_MARKER,
  loadHolmesSuiteReports
} from '../src/pr-comment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prCommentCliPath = path.join(__dirname, '..', 'src', 'pr-comment-cli.mjs');

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
    headSha: 'feedface1234567890',
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
  assert.ok(comment.includes('<!-- HOLMES_SUITE_SHA:feedface1234567890 -->'));
  assert.ok(comment.includes('## Plain-English Readout'));
  assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
  assert.ok(comment.includes('## Suggested next actions'));
  assert.ok(comment.includes('Tighten citations so the report points to exact lines instead of whole files or coarse references.'));
  assert.ok(comment.includes('<details><summary>📚 Glossary (what the Holmes terms mean)</summary>'));

  const beforeGlossary = comment.split('<details><summary>📚 Glossary')[0];
  const unexplainedAcronyms = beforeGlossary.match(/\b(SCS|TCI|MRI)\b/gi);
  assert.equal(unexplainedAcronyms, null, `visible summary should avoid unexplained score acronyms: ${unexplainedAcronyms}`);
});

test('buildHolmesSuiteComment explains unavailable reports without crashing the comment', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: 'deadbeef1234567890',
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
  assert.ok(comment.includes('<!-- HOLMES_SUITE_SHA:deadbeef1234567890 -->'));
  assert.ok(comment.includes('The Moriarty forecast is unavailable because the workflow status is cancelled.'));
  assert.ok(comment.includes('Fix the HOLMES workflow job first so the PR has a real evidence investigation again.'));
});

test('buildHolmesSuiteComment distinguishes missing and invalid report artifacts from successful workflow status', { timeout: 5000 }, () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-load-'));
  try {
    writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### holmes raw\n');
    writeFileSync(path.join(reportsDir, 'watson-report.json'), '{"not":"valid"');

    const comment = buildHolmesSuiteComment({
      pullRequestNumber: 466,
      headSha: 'beadfeed1234567890',
      ...loadHolmesSuiteReports(reportsDir, {
        holmes: 'success',
        watson: 'success',
        moriarty: 'success'
      })
    });

    assert.ok(comment.includes('The Holmes report is unavailable because the workflow finished without a readable holmes-report.json artifact.'));
    assert.ok(comment.includes('The Watson report is unavailable because the watson-report.json artifact could not be parsed as JSON.'));
    assert.ok(comment.includes('The Moriarty forecast is unavailable because the workflow finished without a readable moriarty-report.json artifact.'));
    assert.ok(comment.includes('Regenerate the HOLMES artifacts and make sure holmes-report.json is uploaded before trusting this PR summary.'));
    assert.ok(comment.includes('Fix the WATSON report generation so watson-report.json contains valid JSON before trusting this PR summary.'));
    assert.ok(comment.includes('Regenerate the MORIARTY artifacts and make sure moriarty-report.json is uploaded before trusting this PR summary.'));
    assert.ok(comment.includes('_Report unavailable for watson: readable watson-report.md artifact not found._'));
    assert.ok(comment.includes('_Report unavailable for moriarty: readable moriarty-report.md artifact not found._'));
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('buildHolmesSuiteComment keeps raw report sections honest when markdown artifacts are missing', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-markdown-'));
  try {
    writeFileSync(path.join(reportsDir, 'holmes-report.json'), JSON.stringify(sampleHolmesReport()));

    const comment = buildHolmesSuiteComment({
      pullRequestNumber: 466,
      headSha: '0011223344556677',
      ...loadHolmesSuiteReports(reportsDir, {
        holmes: 'success',
        watson: 'failure',
        moriarty: 'failure'
      })
    });

    assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
    assert.ok(comment.includes('_Report unavailable for holmes: readable holmes-report.md artifact not found._'));
    assert.equal(comment.includes('job status: success'), false, 'raw section should not blame a success status for a missing markdown artifact');
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('buildHolmesSuiteComment normalizes repeated whitespace and trailing periods in summaries', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: 'cafebabe1234567890',
    statuses: {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    },
    holmesReport: sampleHolmesReport({
      gates: [
        { gate: 'Migration Risk', status: '⛔', evidence: 'MRI: 46.0%', ruling: 'HIGH   RISK!....' }
      ]
    }),
    watsonReport: sampleWatsonReport({
      inconsistencies: ['One   cited span no longer matches the current file contents....']
    }),
    moriartyReport: sampleMoriartyReport(),
    holmesMarkdown: '### raw holmes',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: '### raw moriarty'
  });

  assert.equal(comment.includes('One   cited span'), false, 'summary should collapse repeated whitespace');
  assert.equal(comment.includes('current file contents....'), false, 'summary should trim trailing periods from source phrases');
  assert.ok(comment.includes('Most important concern: One cited span no longer matches the current file contents.'), 'Watson concern should collapse internal whitespace and trim trailing periods');
});

test('buildHolmesSuiteComment preserves at least one next action per suite before truncating to four items', () => {
  const comment = buildHolmesSuiteComment({
    pullRequestNumber: 466,
    headSha: '0123abc456def789',
    statuses: {
      holmes: 'success',
      watson: 'success',
      moriarty: 'success'
    },
    holmesReport: sampleHolmesReport(),
    watsonReport: sampleWatsonReport(),
    moriartyReport: sampleMoriartyReport({
      plateauDetected: true,
      warnings: []
    }),
    holmesMarkdown: '### raw holmes',
    watsonMarkdown: '### raw watson',
    moriartyMarkdown: '### raw moriarty'
  });

  const actionSection = comment
    .split('## Suggested next actions\n\n')[1]
    .split('\n\n<details><summary>📚 Glossary')[0]
    .trim()
    .split('\n');

  assert.deepEqual(actionSection, [
    '1. Tighten citations so the report points to exact lines instead of whole files or coarse references.',
    '2. Resolve Watson’s verification concerns before trusting the Holmes verdict as final.',
    '3. Treat the readiness forecast as stalled until new evidence or real progress moves the trend again.',
    '4. Add or strengthen tests for the schema elements and operations HOLMES flagged as weakly proven.'
  ]);
});

test('buildHolmesSuiteComment keeps loaded reports visible when workflow statuses are omitted', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-implicit-status-'));
  try {
    writeFileSync(path.join(reportsDir, 'holmes-report.json'), JSON.stringify(sampleHolmesReport()));
    writeFileSync(path.join(reportsDir, 'watson-report.json'), JSON.stringify(sampleWatsonReport()));
    writeFileSync(path.join(reportsDir, 'moriarty-report.json'), JSON.stringify(sampleMoriartyReport()));
    writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### raw holmes\n');
    writeFileSync(path.join(reportsDir, 'watson-report.md'), '### raw watson\n');
    writeFileSync(path.join(reportsDir, 'moriarty-report.md'), '### raw moriarty\n');

    const comment = buildHolmesSuiteComment({
      pullRequestNumber: 466,
      headSha: 'statusless1234567890',
      ...loadHolmesSuiteReports(reportsDir)
    });

    assert.equal(comment.includes('workflow status is unknown'), false, 'omitted statuses should not hide loaded reports');
    assert.equal(comment.includes('Fix the HOLMES workflow job first'), false, 'omitted statuses should not trigger workflow-failure actions');
    assert.ok(comment.includes('Holmes says this change needs investigation before shipping.'));
    assert.ok(comment.includes('### raw holmes'));
    assert.ok(comment.includes('### raw watson'));
    assert.ok(comment.includes('### raw moriarty'));
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});

test('pr-comment CLI builds comment output without external argument parser dependencies', () => {
  const reportsDir = mkdtempSync(path.join(os.tmpdir(), 'holmes-pr-comment-'));
  try {
    writeFileSync(path.join(reportsDir, 'holmes-report.md'), '### holmes raw\n');
    const result = spawnSync(process.execPath, [
      prCommentCliPath,
      '--reports-dir', reportsDir,
      '--pr-number', '467',
      '--head-sha', '0123456789abcdef',
      '--holmes-status', 'failure',
      '--watson-status', 'failure',
      '--moriarty-status', 'failure'
    ], {
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(HOLMES_SUITE_COMMENT_MARKER));
    assert.ok(result.stdout.includes('<!-- HOLMES_SUITE_SHA:0123456789abcdef -->'));
    assert.ok(result.stdout.includes('The Holmes report is unavailable because the workflow status is failure.'));
  } finally {
    rmSync(reportsDir, { recursive: true, force: true });
  }
});
