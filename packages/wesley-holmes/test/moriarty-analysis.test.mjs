import test from 'node:test';
import assert from 'node:assert/strict';

import { createMoriartyConfig } from '../src/moriarty-config.mjs';
import {
  analyzeMoriartyPredictionCore,
  calculateMoriartySeries,
  calculateMoriartyRecentVelocity,
  detectMoriartyPatterns
} from '../src/moriarty-analysis.mjs';
import { applyCounterfactualJudgmentToPrediction } from '../src/moriarty-predict-workflow.mjs';
import { renderMoriartyPrediction } from '../src/moriarty-render.mjs';

test('analyzeMoriartyPredictionCore returns ETA, confidence, and readiness from pure inputs', () => {
  const config = createMoriartyConfig({ env: {} });
  const clock = {
    nowMs: () => Date.parse('2026-03-24T00:00:00.000Z')
  };
  const historyPoints = [
    { day: 10, scs: 0.4, tci: 0.55, mri: 0.2 },
    { day: 11, scs: 0.62, tci: 0.68, mri: 0.18 },
    { day: 12, scs: 0.84, tci: 0.74, mri: 0.16 }
  ];

  const result = analyzeMoriartyPredictionCore({
    historyPoints,
    context: { ci: { stability: 0.95 }, timeframeHours: 72 },
    config,
    clock,
    gitActivity: null,
    activityIndex: 0,
    burstinessIndex: 0,
    latestEvidenceTrust: 'weak',
    latestEvidenceTrustReasons: ['Coarse citations remain unpinned to exact line spans.']
  });

  assert.equal(result.latest.scs, 0.84);
  assert.ok(result.eta.realistic > 0);
  assert.equal(result.explain.readiness.scs.pass, true);
  assert.equal(result.explain.readiness.evidenceTrust.pass, false);
  assert.ok(result.confidence < 100);
  assert.ok(result.warnings.some((warning) => warning.includes('Evidence trust is weak')));
});

test('Moriarty analysis helpers stay deterministic', () => {
  const historyPoints = [
    { day: 1, scs: 0.2, tci: 0.3, mri: 0.2 },
    { day: 2, scs: 0.5, tci: 0.35, mri: 0.19 },
    { day: 3, scs: 0.7, tci: 0.4, mri: 0.18 },
    { day: 4, scs: 0.71, tci: 0.42, mri: 0.18 },
    { day: 5, scs: 0.72, tci: 0.43, mri: 0.18 }
  ];

  const series = calculateMoriartySeries(historyPoints, 0.4);
  const velocity = calculateMoriartyRecentVelocity(series);
  const patterns = detectMoriartyPatterns(historyPoints);

  assert.ok(Number.isFinite(velocity));
  assert.ok(patterns.some((pattern) => pattern.type === 'VELOCITY_CLIFF'));
});

test('counterfactual judgment becomes a first-class readiness signal in Moriarty explain output', () => {
  const config = createMoriartyConfig({ env: {} });
  const clock = {
    nowMs: () => Date.parse('2026-03-24T00:00:00.000Z')
  };
  const historyPoints = [
    { day: 10, scs: 0.4, tci: 0.55, mri: 0.2 },
    { day: 11, scs: 0.62, tci: 0.68, mri: 0.18 },
    { day: 12, scs: 0.84, tci: 0.74, mri: 0.16 }
  ];

  const result = analyzeMoriartyPredictionCore({
    historyPoints,
    context: { ci: { stability: 0.95 }, timeframeHours: 72 },
    config,
    clock,
    gitActivity: null,
    activityIndex: 0,
    burstinessIndex: 0,
    latestEvidenceTrust: 'strong',
    latestEvidenceTrustReasons: ['All citations resolve to exact line spans.']
  });
  const baselineConfidence = result.confidence;

  applyCounterfactualJudgmentToPrediction(result, {
    judgment: {
      gate: 'audit',
      status: 'divergent',
      riskClass: 'high',
      wouldFail: true,
      confidenceAdjustment: -12,
      reasons: ['Transfer planning still finds non-trivial divergence from the base lane.']
    }
  });

  assert.equal(result.explain.readiness.counterfactual.pass, false);
  assert.equal(result.explain.readiness.counterfactual.value, 'audit');
  assert.equal(result.explain.readiness.counterfactual.status, 'divergent');
  assert.ok(
    result.confidence < baselineConfidence,
    'counterfactual adjustment should lower confidence'
  );
  assert.ok(
    result.warnings.some((warning) => warning.includes('Counterfactual gate is audit')),
    'counterfactual gate warning should be surfaced'
  );
  assert.ok(
    result.patterns.some((pattern) => pattern.type === 'COUNTERFACTUAL_RISK'),
    'counterfactual risk should produce a first-class pattern'
  );

  result.metadata = {
    analysisAt: '2026-03-24T00:00:00.000Z',
    runId: null,
    transmutation: null
  };
  result.status = 'OK';
  result.history = historyPoints;

  const output = renderMoriartyPrediction(result, { context: { timeframeHours: 72 } });
  assert.match(output, /Counterfactual gate must be pass → FAIL ❌/);
  assert.match(output, /status divergent, risk high, would fail under hard gating/);
});
