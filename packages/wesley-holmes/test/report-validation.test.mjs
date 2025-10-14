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
    mri: 0.1,
    bundleVersion: '2.0.0'
  },
  scores: {
    scs: 0.9,
    tci: 0.8,
    mri: 0.1,
    breakdown: {
      scs: {
        sql: { score: 0.95, totalWeight: 10, coveredWeight: 9.5 },
        types: { score: 0.9, totalWeight: 10, coveredWeight: 9 },
        validation: { score: 0.85, totalWeight: 10, coveredWeight: 8.5 },
        tests: { score: 0.88, totalWeight: 10, coveredWeight: 8.8 }
      },
      tci: {
        unitConstraints: { score: 0.8, total: 40, covered: 32, components: { structure: 0.9, constraints: 0.8, defaults: 0.7, indexes: 0.75 } },
        rls: { score: 1, total: 1, covered: 1 },
        integrationRelations: { score: 0.7, total: 5, covered: 3.5 },
        e2eOps: { score: 0.6, total: 5, covered: 3 }
      },
      mri: {
        drops: { score: 0.1, points: 10, contribution: 0.25 },
        renames: { score: 0, points: 0, contribution: 0 },
        defaults: { score: 0.05, points: 5, contribution: 0.1 },
        typeChanges: { score: 0, points: 0, contribution: 0 },
        indexes: { score: 0.02, points: 2, contribution: 0.05 },
        other: { score: 0.03, points: 3, contribution: 0.07 }
      }
    }
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
