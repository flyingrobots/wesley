/**
 * Professor MORIARTY - The Napoleon of Crime... Prevention
 * Predictive analytics for schema completion
 */

import { realGitAdapter } from './ports/git.mjs';
import { analyzeMoriartyPredictionCore } from './moriarty-analysis.mjs';
import { createMoriartyConfig } from './moriarty-config.mjs';
import { analyzeMoriartyGitActivity } from './moriarty-git-activity.mjs';
import {
  normalizeMoriartyEvidenceTrustLevel,
  normalizeMoriartyEvidenceTrustReasons,
  normalizeMoriartyHistoryPoints
} from './moriarty-history.mjs';
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
    const base = {
      metadata: {
        analysisAt
      },
      history: normalizeMoriartyHistoryPoints(historyPoints),
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
    const latestEvidenceTrust = normalizeMoriartyEvidenceTrustLevel(latest?.evidenceTrust);
    const latestEvidenceTrustReasons = latestEvidenceTrust
      ? normalizeMoriartyEvidenceTrustReasons(latest?.evidenceTrustReasons, latestEvidenceTrust)
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
