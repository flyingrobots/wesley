/**
 * Professor MORIARTY - The Napoleon of Crime... Prevention
 * Predictive analytics for schema completion
 */

import {
  confidencePenaltyForEvidenceTrust,
  evidenceTrustMeetsThreshold
} from '@wesley/core';
import { realGitAdapter } from './ports/git.mjs';
import { createMoriartyConfig } from './moriarty-config.mjs';
import { analyzeMoriartyGitActivity } from './moriarty-git-activity.mjs';
import { renderMoriartyPrediction } from './moriarty-render.mjs';

export class Moriarty {
  /**
   * @param {Object} history - Historical score data
   * @param {Object} [context] - Additional context (CI, delivery, etc.)
   * @param {Object} [options] - Configuration options
   * @param {Object} [options.git] - Git adapter (defaults to realGitAdapter)
   */
  constructor(history, context = {}, options = {}) {
    this.history = history;
    this.context = context || {};
    this.git = options.git || realGitAdapter;
    this.config = createMoriartyConfig({ env: options.env });
    this.clock = options.clock || {
      nowMs: () => Date.now(),
      nowIso: () => new Date().toISOString()
    };
    this.alpha = this.config.alpha;
    this.minSlope = this.config.minSlope;
  }

  /**
   * Predict completion based on historical data
   */
  predict() {
    return this.renderPrediction(this.predictionData());
  }

  predictionData() {
    const analysisAt = this.clock.nowIso();
    const historyPoints = Array.isArray(this.history?.points) ? this.history.points : [];
    const recentHistory = historyPoints.slice(-7).map(point => {
      const normalizedTrust = normalizeEvidenceTrustLevel(point.evidenceTrust);
      const normalizedReasons = normalizedTrust
        ? normalizeEvidenceTrustReasons(point.evidenceTrustReasons, normalizedTrust)
        : [];
      return {
        timestamp: point.timestamp ?? formatDateString(point.day),
        scs: point.scs ?? 0,
        tci: point.tci ?? 0,
        mri: point.mri ?? 0,
        ...(normalizedTrust ? { evidenceTrust: normalizedTrust } : {}),
        ...(normalizedReasons.length > 0 ? { evidenceTrustReasons: normalizedReasons } : {})
      };
    });
    const base = {
      metadata: {
        analysisAt
      },
      history: recentHistory,
      plateauDetected: false,
      regressionDetected: false,
      patterns: [],
      warnings: []
    };

    if (!historyPoints || historyPoints.length < 2) {
      return {
        ...base,
        status: 'INSUFFICIENT_DATA',
        message: 'At least two historical points are required for prediction.'
      };
    }

    const series = this.calculateEMA();
    const slope = this.calculateSlope(series);
    const recentVelocity = this.calculateRecentVelocity(series);
    const latest = this.history.points[this.history.points.length - 1];
    const latestEvidenceTrust = normalizeEvidenceTrustLevel(latest?.evidenceTrust);
    const latestEvidenceTrustReasons = latestEvidenceTrust
      ? normalizeEvidenceTrustReasons(latest?.evidenceTrustReasons, latestEvidenceTrust)
      : [];
    // Optional: blend SCS velocity with Git activity to avoid false plateaus
    let gitActivity = null;
    let activityIndex = 0;
    let burstinessIndex = 0;
    if (this.config.useGitActivity) {
      const gitAnalysis = analyzeMoriartyGitActivity({
        git: this.git,
        clock: this.clock,
        config: this.config
      });
      gitActivity = gitAnalysis.gitActivity;
      activityIndex = gitAnalysis.activityIndex;
      burstinessIndex = gitAnalysis.burstinessIndex;
    }
    const blendedRecentVelocity = (recentVelocity * 0.7) + (activityIndex * 0.3 * 0.02); // map activity to ~2%/day max
    const plateau = Math.abs(blendedRecentVelocity) < this.config.minSlope && (activityIndex < this.config.activityPlateauThreshold);
    const regression = series.length >= 2 && series[series.length - 1].scs < series[series.length - 2].scs;

    let eta = null;
    let confidence = null;
    if (recentVelocity > this.config.minSlope) {
      const daysToComplete = (1 - latest.scs) / recentVelocity;
      const optimistic = Math.ceil(daysToComplete * 0.7);
      const realistic = Math.ceil(daysToComplete);
      const pessimistic = Math.ceil(daysToComplete * 1.5);
      const nowMs = this.clock.nowMs();
      eta = {
        optimistic,
        realistic,
        pessimistic,
        optimisticDate: formatDate(new Date(nowMs + optimistic * 24 * 60 * 60 * 1000)),
        realisticDate: formatDate(new Date(nowMs + realistic * 24 * 60 * 60 * 1000)),
        pessimisticDate: formatDate(new Date(nowMs + pessimistic * 24 * 60 * 60 * 1000))
      };
      const variance = this.calculateVariance(series);
      confidence = Math.max(0, Math.min(100, 100 - variance * 120));
    }

    // Confidence adjuster: penalize bursty commit size distributions
    if (gitActivity && burstinessIndex > 0 && confidence !== null) {
      const penalty = Math.min(this.config.confidenceBurstinessMax, burstinessIndex * this.config.confidenceBurstinessMax);
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

    const result = {
      ...base,
      status: 'OK',
      latest,
      velocity: {
        recent: recentVelocity,
        blendedSlope: slope.scs,
        gitActivityIndex: activityIndex,
        blendedRecent: blendedRecentVelocity
      },
      gitActivity: gitActivity ? { ...gitActivity, burstinessIndex } : undefined,
      plateauDetected: plateau,
      regressionDetected: regression,
      patterns: this.detectPatterns(),
      warnings
    };

    // Readiness EXPLAIN (non-blocking): clarify what "prod-ready" means
    const thresholds = this.config.readinessThresholds;
    const ci = this.context?.ci || {};
    const readiness = {
      scs: { value: latest.scs ?? 0, pass: (latest.scs ?? 0) >= thresholds.scs, threshold: thresholds.scs },
      tci: { value: latest.tci ?? 0, pass: (latest.tci ?? 0) >= thresholds.tci, threshold: thresholds.tci },
      mri: { value: latest.mri ?? 0, pass: (latest.mri ?? 0) <= thresholds.mri, threshold: thresholds.mri },
      ci:  { value: Number(ci.stability ?? 0), pass: Number(ci.stability ?? 0) >= thresholds.ci, threshold: thresholds.ci, windowHours: this.context?.timeframeHours }
    };
    if (latestEvidenceTrust) {
      readiness.evidenceTrust = {
        value: latestEvidenceTrust,
        pass: evidenceTrustMeetsThreshold(latestEvidenceTrust, thresholds.evidenceTrust),
        threshold: thresholds.evidenceTrust,
        reasons: latestEvidenceTrustReasons
      };
    }
    result.explain = {
      thresholds,
      readiness,
      delivery: {
        issuesClosed: Number(this.context?.issuesClosed || 0),
        prsMerged: Number(this.context?.prsMerged || 0),
        baseRef: this.context?.baseRef || null,
        since: this.context?.since || this.context?.generatedAt || null
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

  renderPrediction(data) {
    return renderMoriartyPrediction(data, {
      context: this.context,
      minSlope: this.config.minSlope
    });
  }

  calculateEMA() {
    let emaSCS = null;
    let emaTCI = null;
    const series = [];

    for (const point of this.history.points) {
      emaSCS = emaSCS === null ? point.scs : (this.config.alpha * point.scs + (1 - this.config.alpha) * emaSCS);
      emaTCI = emaTCI === null ? point.tci : (this.config.alpha * point.tci + (1 - this.config.alpha) * emaTCI);

      series.push({
        day: point.day,
        scs: emaSCS,
        tci: emaTCI,
        mri: point.mri
      });
    }

    return series;
  }

  calculateSlope(series) {
    if (series.length < 2) return { scs: 0, tci: 0 };

    const n = series.length;
    const xs = series.map(s => s.day);
    const scsList = series.map(s => s.scs);
    const tciList = series.map(s => s.tci);

    const xBar = xs.reduce((a, b) => a + b, 0) / n;
    const scsBar = scsList.reduce((a, b) => a + b, 0) / n;
    const tciBar = tciList.reduce((a, b) => a + b, 0) / n;

    const denominator = xs.reduce((acc, x) => acc + Math.pow(x - xBar, 2), 0) || 1e-9;

    const scsSlope = xs.reduce((acc, x, i) => acc + (x - xBar) * (scsList[i] - scsBar), 0) / denominator;
    const tciSlope = xs.reduce((acc, x, i) => acc + (x - xBar) * (tciList[i] - tciBar), 0) / denominator;

    return { scs: scsSlope, tci: tciSlope };
  }

  calculateRecentVelocity(series) {
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
    const longSlope = this.calculateSlope(series).scs;
    // Blend recent velocity with long-term slope to avoid drastic swings
    return (velocity * 0.7) + (longSlope * 0.3);
  }

  calculateVariance(series) {
    if (series.length < 2) return 1;

    const mean = series.reduce((acc, s) => acc + s.scs, 0) / series.length;
    const variance = series.reduce((acc, s) => acc + Math.pow(s.scs - mean, 2), 0) / (series.length - 1);

    return Math.sqrt(variance);
  }

  detectPatterns() {
    const patterns = [];

    if (this.history.points.length >= 5) {
      const recent = this.history.points.slice(-5);
      const velocities = [];

      for (let i = 1; i < recent.length; i++) {
        const daysDiff = recent[i].day - recent[i-1].day || 1;
        const scsDiff = recent[i].scs - recent[i-1].scs;
        velocities.push(scsDiff / daysDiff);
      }

      // Check for velocity decay
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

      // Check for test lag
      const latest = this.history.points[this.history.points.length - 1];
      if (latest.scs > 0.7 && latest.tci < 0.5) {
        patterns.push({
          type: 'TEST_LAG',
          description: 'Schema complete but tests lagging behind'
        });
      }
    }

    return patterns;
  }
}

function normalizeEvidenceTrustLevel(level) {
  switch (level) {
  case 'strong':
  case 'moderate':
  case 'weak':
  case 'missing':
    return level;
  default:
    return null;
  }
}

function normalizeEvidenceTrustReasons(reasons, level) {
  if (Array.isArray(reasons) && reasons.length > 0) {
    return reasons.filter((reason) => typeof reason === 'string' && reason.length > 0);
  }

  switch (level) {
  case 'moderate':
    return ['Whole-file citations still rely on broad file-level proof.'];
  case 'weak':
    return ['Coarse citations remain unpinned to exact line spans.'];
  case 'missing':
    return ['No evidence citations were available for trust analysis.'];
  default:
    return ['All citations resolve to exact line spans.'];
  }
}

function formatDateString(day) {
  if (typeof day === 'number' && Number.isFinite(day)) {
    const millis = day * 24 * 60 * 60 * 1000;
    return new Date(millis).toISOString();
  }
  return new Date(0).toISOString();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
