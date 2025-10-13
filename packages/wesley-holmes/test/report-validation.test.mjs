import test from 'node:test';
import assert from 'node:assert/strict';

import {
  holmesReportSchema,
  watsonReportSchema,
  moriartyReportSchema,
  validateReport
} from '../src/report-schemas.mjs';

const holmesSample = {
  metadata: {
    generatedAt: '2025-10-13T20:00:00.000Z',
    sha: 'abc123',
    verificationStatus: 'ELEMENTARY',
    verificationCount: 4,
    weightedCompletion: 0.9,
    tci: 0.8,
    mri: 0.1
  },
  scores: {
    scs: 0.9,
    tci: 0.8,
    mri: 0.1
  },
  evidence: [
    {
      element: 'schema',
      weight: 5,
      status: '✅ SQL & tests',
      evidence: 'schema.sql:1-5@abc123',
      deduction: 'Elementary!'
    }
  ],
  gates: [
    {
      gate: 'Migration Risk',
      status: '✅',
      evidence: 'MRI: 10%',
      ruling: 'Ship it'
    }
  ],
  verdict: {
    code: 'ELEMENTARY',
    message: 'Ship immediately',
    markdown: '✅'
  }
};

const watsonSample = {
  metadata: {
    examinedAt: '2025-10-13T20:00:00.000Z',
    sha: 'abc123'
  },
  citations: {
    total: 4,
    verified: 4,
    failed: 0,
    unverified: 0,
    rate: 1
  },
  math: {
    claimedScs: 0.9,
    recalculatedScs: 0.9,
    difference: 0,
    acceptable: true
  },
  inconsistencies: [],
  opinion: {
    verdict: 'PASSED',
    message: 'All clear',
    markdown: '✅'
  }
};

const moriartySample = {
  metadata: {
    analysisAt: '2025-10-13T20:00:00.000Z'
  },
  status: 'OK',
  history: [
    { timestamp: '2025-10-12T00:00:00.000Z', scs: 0.8, tci: 0.7, mri: 0.2 },
    { timestamp: '2025-10-13T00:00:00.000Z', scs: 0.85, tci: 0.72, mri: 0.18 }
  ],
  latest: {
    scs: 0.85,
    tci: 0.72,
    mri: 0.18
  },
  velocity: {
    recent: 0.02,
    blendedSlope: 0.01
  },
  plateauDetected: false,
  regressionDetected: false,
  eta: {
    optimistic: 2,
    realistic: 3,
    pessimistic: 5
  },
  confidence: 90,
  patterns: []
};

test('holmes report schema accepts valid sample', () => {
  const result = validateReport(holmesReportSchema, holmesSample);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('holmes report schema rejects missing scores', () => {
  const broken = structuredClone(holmesSample);
  delete broken.scores;
  const result = validateReport(holmesReportSchema, broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.includes('scores')));
});

test('watson report schema accepts valid sample', () => {
  const result = validateReport(watsonReportSchema, watsonSample);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('watson report schema rejects missing citations.total', () => {
  const broken = structuredClone(watsonSample);
  delete broken.citations.total;
  const result = validateReport(watsonReportSchema, broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.includes('citations.total')));
});

test('moriarty schema accepts valid sample', () => {
  const result = validateReport(moriartyReportSchema, moriartySample);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('moriarty schema enforces history array', () => {
  const broken = structuredClone(moriartySample);
  delete broken.history;
  const result = validateReport(moriartyReportSchema, broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.includes('history')));
});
