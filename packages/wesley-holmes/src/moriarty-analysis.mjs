import {
  confidencePenaltyForEvidenceTrust,
  evidenceTrustMeetsThreshold
} from '@wesley/core';

export function analyzeMoriartyPredictionCore({
  historyPoints,
  context = {},
  config,
  clock,
  gitActivity = null,
  activityIndex = 0,
  burstinessIndex = 0,
  latestEvidenceTrust = null,
  latestEvidenceTrustReasons = []
}) {
  const series = calculateMoriartySeries(historyPoints, config.alpha);
  const slope = calculateMoriartySlope(series);
  const recentVelocity = calculateMoriartyRecentVelocity(series);
  const latest = historyPoints[historyPoints.length - 1];
  const blendedRecentVelocity = (recentVelocity * 0.7) + (activityIndex * 0.3 * 0.02);
  const plateauDetected = Math.abs(blendedRecentVelocity) < config.minSlope && (activityIndex < config.activityPlateauThreshold);
  const regressionDetected = series.length >= 2 && series[series.length - 1].scs < series[series.length - 2].scs;

  let eta = null;
  let confidence = null;
  if (recentVelocity > config.minSlope) {
    const daysToComplete = (1 - latest.scs) / recentVelocity;
    const optimistic = Math.ceil(daysToComplete * 0.7);
    const realistic = Math.ceil(daysToComplete);
    const pessimistic = Math.ceil(daysToComplete * 1.5);
    const nowMs = clock.nowMs();
    eta = {
      optimistic,
      realistic,
      pessimistic,
      optimisticDate: formatDate(new Date(nowMs + optimistic * 24 * 60 * 60 * 1000)),
      realisticDate: formatDate(new Date(nowMs + realistic * 24 * 60 * 60 * 1000)),
      pessimisticDate: formatDate(new Date(nowMs + pessimistic * 24 * 60 * 60 * 1000))
    };
    const variance = calculateMoriartyVariance(series);
    confidence = Math.max(0, Math.min(100, 100 - variance * 120));
  }

  if (gitActivity && burstinessIndex > 0 && confidence !== null) {
    const penalty = Math.min(config.confidenceBurstinessMax, burstinessIndex * config.confidenceBurstinessMax);
    confidence = Math.max(0, confidence - penalty);
  }

  const warnings = [];
  if (latestEvidenceTrust) {
    const trustPenalty = confidencePenaltyForEvidenceTrust(latestEvidenceTrust);
    if (confidence !== null && trustPenalty > 0) {
      confidence = Math.max(0, confidence - trustPenalty);
    }
    if (!evidenceTrustMeetsThreshold(latestEvidenceTrust, 'moderate')) {
      warnings.push(`Evidence trust is ${latestEvidenceTrust}; ${latestEvidenceTrustReasons[0]}`);
    }
  }

  const thresholds = config.readinessThresholds;
  const ci = context?.ci || {};
  const readiness = {
    scs: { value: latest.scs ?? 0, pass: (latest.scs ?? 0) >= thresholds.scs, threshold: thresholds.scs },
    tci: { value: latest.tci ?? 0, pass: (latest.tci ?? 0) >= thresholds.tci, threshold: thresholds.tci },
    mri: { value: latest.mri ?? 0, pass: (latest.mri ?? 0) <= thresholds.mri, threshold: thresholds.mri },
    ci: { value: Number(ci.stability ?? 0), pass: Number(ci.stability ?? 0) >= thresholds.ci, threshold: thresholds.ci, windowHours: context?.timeframeHours }
  };
  if (latestEvidenceTrust) {
    readiness.evidenceTrust = {
      value: latestEvidenceTrust,
      pass: evidenceTrustMeetsThreshold(latestEvidenceTrust, thresholds.evidenceTrust),
      threshold: thresholds.evidenceTrust,
      reasons: latestEvidenceTrustReasons
    };
  }

  const result = {
    latest,
    velocity: {
      recent: recentVelocity,
      blendedSlope: slope.scs,
      gitActivityIndex: activityIndex,
      blendedRecent: blendedRecentVelocity
    },
    gitActivity: gitActivity ? { ...gitActivity, burstinessIndex } : undefined,
    plateauDetected,
    regressionDetected,
    patterns: detectMoriartyPatterns(historyPoints),
    warnings,
    explain: {
      thresholds,
      readiness,
      delivery: {
        issuesClosed: Number(context?.issuesClosed || 0),
        prsMerged: Number(context?.prsMerged || 0),
        baseRef: context?.baseRef || null,
        since: context?.since || context?.generatedAt || null
      }
    }
  };

  if (eta) {
    result.eta = eta;
  }
  if (confidence !== null) {
    result.confidence = confidence;
  }

  return result;
}

export function calculateMoriartySeries(historyPoints, alpha) {
  let emaSCS = null;
  let emaTCI = null;
  const series = [];

  for (const point of historyPoints) {
    emaSCS = emaSCS === null ? point.scs : (alpha * point.scs + (1 - alpha) * emaSCS);
    emaTCI = emaTCI === null ? point.tci : (alpha * point.tci + (1 - alpha) * emaTCI);
    series.push({
      day: point.day,
      scs: emaSCS,
      tci: emaTCI,
      mri: point.mri
    });
  }

  return series;
}

export function calculateMoriartySlope(series) {
  if (series.length < 2) return { scs: 0, tci: 0 };

  const n = series.length;
  const xs = series.map(s => s.day);
  const scsList = series.map(s => s.scs);
  const tciList = series.map(s => s.tci);
  const xBar = xs.reduce((a, b) => a + b, 0) / n;
  const scsBar = scsList.reduce((a, b) => a + b, 0) / n;
  const tciBar = tciList.reduce((a, b) => a + b, 0) / n;
  const denominator = xs.reduce((acc, x) => acc + Math.pow(x - xBar, 2), 0) || 1e-9;

  return {
    scs: xs.reduce((acc, x, i) => acc + (x - xBar) * (scsList[i] - scsBar), 0) / denominator,
    tci: xs.reduce((acc, x, i) => acc + (x - xBar) * (tciList[i] - tciBar), 0) / denominator
  };
}

export function calculateMoriartyRecentVelocity(series) {
  if (series.length < 2) return 0;
  const window = Math.min(4, series.length);
  const recent = series.slice(-window);
  let velocity = 0;
  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i].scs - recent[i - 1].scs;
    const days = (recent[i].day - recent[i - 1].day) || 1;
    velocity += delta / days;
  }
  velocity /= (recent.length - 1);
  return (velocity * 0.7) + (calculateMoriartySlope(series).scs * 0.3);
}

export function calculateMoriartyVariance(series) {
  if (series.length < 2) return 1;
  const mean = series.reduce((acc, s) => acc + s.scs, 0) / series.length;
  const variance = series.reduce((acc, s) => acc + Math.pow(s.scs - mean, 2), 0) / (series.length - 1);
  return Math.sqrt(variance);
}

export function detectMoriartyPatterns(historyPoints) {
  const patterns = [];
  if (historyPoints.length < 5) {
    return patterns;
  }

  const recent = historyPoints.slice(-5);
  const velocities = [];
  for (let i = 1; i < recent.length; i++) {
    const daysDiff = recent[i].day - recent[i - 1].day || 1;
    const scsDiff = recent[i].scs - recent[i - 1].scs;
    velocities.push(scsDiff / daysDiff);
  }

  const firstHalf = velocities.slice(0, 2);
  const secondHalf = velocities.slice(2);
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  if (secondAvg < firstAvg * 0.6) {
    patterns.push({
      type: 'VELOCITY_CLIFF',
      description: 'Progress rate dropped 40%+ - exhaustion detected'
    });
  }

  const latest = historyPoints[historyPoints.length - 1];
  if (latest.scs > 0.7 && latest.tci < 0.5) {
    patterns.push({
      type: 'TEST_LAG',
      description: 'Schema complete but tests lagging behind'
    });
  }

  return patterns;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
