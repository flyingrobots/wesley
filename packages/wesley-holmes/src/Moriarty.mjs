/**
 * Professor MORIARTY - The Napoleon of Crime... Prevention
 * Predictive analytics for schema completion
 */

import { realGitAdapter } from './ports/git.mjs';
import { analyzeMoriartyPredictionCore } from './moriarty-analysis.mjs';
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
    const analysis = analyzeMoriartyPredictionCore({
      historyPoints,
      context: this.context,
      config: this.config,
      clock: this.clock,
      gitActivity,
      activityIndex,
      burstinessIndex,
      latestEvidenceTrust,
      latestEvidenceTrustReasons
    });

    const result = {
      ...base,
      status: 'OK',
      ...analysis
    };

    return result;
  }

  renderPrediction(data) {
    return renderMoriartyPrediction(data, {
      context: this.context,
      minSlope: this.config.minSlope
    });
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
