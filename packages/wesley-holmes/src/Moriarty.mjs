/**
 * Professor MORIARTY - The Napoleon of Crime... Prevention
 * Predictive analytics for schema completion
 */

import { execSync } from 'node:child_process';

export class Moriarty {
  constructor(history, context = {}) {
    this.history = history;
    this.context = context || {};
    this.alpha = 0.4; // EMA smoothing factor
    this.minSlope = 0.01; // Minimum SCS progress per day to avoid plateau
    // Git-activity blending (optional, auto-detected when git is available)
    this.useGitActivity = (process.env.MORIARTY_USE_GIT || '1') !== '0';
    this.gitWindowHours = Number(process.env.MORIARTY_GIT_WINDOW_HOURS || '24');
    this.activityPlateauThreshold = Number(process.env.MORIARTY_ACTIVITY_THRESHOLD || '0.35');
    // Normalization knobs for activity index
    this.activityCommitThreshold = Number(process.env.MORIARTY_ACTIVITY_COMMITS_PER_DAY || '6');
    this.activityRelevantCommitThreshold = Number(process.env.MORIARTY_ACTIVITY_RELEVANT_PER_DAY || '4');
    this.activityLinesPerDayTarget = Number(process.env.MORIARTY_ACTIVITY_LINES_PER_DAY || '400');
    this.activityFilesPerDayTarget = Number(process.env.MORIARTY_ACTIVITY_FILES_PER_DAY || '10');
    this.confidenceBurstinessMax = Number(process.env.MORIARTY_CONFIDENCE_BURSTINESS_MAX_PCT || '15');
  }

  /**
   * Predict completion based on historical data
   */
  predict() {
    return this.renderPrediction(this.predictionData());
  }

  predictionData() {
    const analysisAt = new Date().toISOString();
    const historyPoints = Array.isArray(this.history?.points) ? this.history.points : [];
    const recentHistory = historyPoints.slice(-7).map(point => ({
      timestamp: point.timestamp ?? this.formatDateString(point.day),
      scs: point.scs ?? 0,
      tci: point.tci ?? 0,
      mri: point.mri ?? 0
    }));
    const base = {
      metadata: {
        analysisAt
      },
      history: recentHistory,
      plateauDetected: false,
      regressionDetected: false,
      patterns: []
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
    // Optional: blend SCS velocity with Git activity to avoid false plateaus
    let gitActivity = null;
    let activityIndex = 0;
    let prActivity = null;
    let prIndex = 0;
    if (this.useGitActivity) {
      // Prefer PR graph activity if base ref is available; blend with time-window activity
      prActivity = this.computeGitPRActivity();
      prIndex = this.normalizeActivity(prActivity);
      const windowActivity = this.computeGitActivityWindow();
      const windowIndex = this.normalizeActivity(windowActivity);
      activityIndex = (Number.isFinite(prIndex) ? prIndex * 0.6 : 0) + (Number.isFinite(windowIndex) ? windowIndex * 0.4 : 0);
      gitActivity = {
        window: windowActivity || undefined,
        pr: prActivity || undefined,
        indexBreakdown: { pr: prIndex, window: windowIndex }
      };
    }
    const blendedRecentVelocity = (recentVelocity * 0.7) + (activityIndex * 0.3 * 0.02); // map activity to ~2%/day max
    const plateau = Math.abs(blendedRecentVelocity) < this.minSlope && (activityIndex < this.activityPlateauThreshold);
    const regression = series.length >= 2 && series[series.length - 1].scs < series[series.length - 2].scs;

    let eta = null;
    let confidence = null;
    if (recentVelocity > this.minSlope) {
      const daysToComplete = (1 - latest.scs) / recentVelocity;
      const optimistic = Math.ceil(daysToComplete * 0.7);
      const realistic = Math.ceil(daysToComplete);
      const pessimistic = Math.ceil(daysToComplete * 1.5);
      eta = {
        optimistic,
        realistic,
        pessimistic,
        optimisticDate: this.formatDate(new Date(Date.now() + optimistic * 24 * 60 * 60 * 1000)),
        realisticDate: this.formatDate(new Date(Date.now() + realistic * 24 * 60 * 60 * 1000)),
        pessimisticDate: this.formatDate(new Date(Date.now() + pessimistic * 24 * 60 * 60 * 1000))
      };
      const variance = this.calculateVariance(series);
      confidence = Math.max(0, Math.min(100, 100 - variance * 120));
    }

    // Confidence adjuster: penalize bursty commit size distributions
    let burstinessIndex = 0;
    if (gitActivity) {
      const sizes = [];
      if (gitActivity?.pr?.commitRelevantSizes?.length) sizes.push(...gitActivity.pr.commitRelevantSizes);
      if (gitActivity?.window?.commitRelevantSizes?.length) sizes.push(...gitActivity.window.commitRelevantSizes);
      if (sizes.length >= 2) {
        burstinessIndex = this.computeBurstinessIndex(sizes);
        if (confidence !== null) {
          const penalty = Math.min(this.confidenceBurstinessMax, burstinessIndex * this.confidenceBurstinessMax);
          confidence = Math.max(0, confidence - penalty);
        }
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
      patterns: this.detectPatterns()
    };

    // Readiness EXPLAIN (non-blocking): clarify what "prod-ready" means
    const thresholds = {
      scs: Number(process.env.MORIARTY_READY_SCS || '0.8'),
      tci: Number(process.env.MORIARTY_READY_TCI || '0.7'),
      mri: Number(process.env.MORIARTY_READY_MRI || '0.4'),
      ci: Number(process.env.MORIARTY_READY_CI_STABILITY || '0.9')
    };
    const ci = this.context?.ci || {};
    const readiness = {
      scs: { value: latest.scs ?? 0, pass: (latest.scs ?? 0) >= thresholds.scs, threshold: thresholds.scs },
      tci: { value: latest.tci ?? 0, pass: (latest.tci ?? 0) >= thresholds.tci, threshold: thresholds.tci },
      mri: { value: latest.mri ?? 0, pass: (latest.mri ?? 0) <= thresholds.mri, threshold: thresholds.mri },
      ci:  { value: Number(ci.stability ?? 0), pass: Number(ci.stability ?? 0) >= thresholds.ci, threshold: thresholds.ci, windowHours: this.context?.timeframeHours }
    };
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
    const report = [];
    report.push('### 🧠 Professor Moriarty\'s Temporal Predictions');
    report.push('');
    report.push('_The Mathematics of Inevitability_');
    report.push('');
    report.push(`- Analysis Date: ${data.metadata.analysisAt}`);
    report.push('');

    if (data.status === 'INSUFFICIENT_DATA') {
      report.push('**INSUFFICIENT DATA**');
      report.push('');
      report.push('> "I require at least two data points to predict the future."');
      report.push('> "Run Wesley generate multiple times to build history."');
      return report.join('\n');
    }

    const latest = data.latest;
    report.push('## 🔮 Current State');
    report.push('');
    report.push(`**SCS**: ${this.makeProgressBar(latest.scs)} ${(latest.scs * 100).toFixed(1)}%`);
    report.push(`**TCI**: ${this.makeProgressBar(latest.tci)} ${(latest.tci * 100).toFixed(1)}%`);
    report.push(`**MRI**: ${(latest.mri * 100).toFixed(1)}% risk`);
    report.push('');

    report.push('## 📈 Velocity Analysis');
    report.push('');
    report.push(`**SCS Velocity**: ${data.velocity.recent >= 0 ? '+' : ''}${(data.velocity.recent * 100).toFixed(2)}%/day`);
    if (data.gitActivity?.window) {
      const w = data.gitActivity.window;
      const filesPerDay = w.windowHours > 0 ? (w.uniqueRelevantFiles * (24 / w.windowHours)) : w.uniqueRelevantFiles;
      const relLinesPerDay = w.windowHours > 0 ? (w.relevantLinesChanged * (24 / w.windowHours)) : w.relevantLinesChanged;
      report.push(`**Git Activity (window)**: ${w.windowHours}h · commits ${w.commits} (${w.relevantCommits} relevant) · ~${w.commitsPerDay.toFixed(2)} commits/day`);
      report.push(`↳ Magnitude: ~${Math.round(relLinesPerDay)} relevant LOC/day across ~${filesPerDay.toFixed(1)} files/day`);
    }
    if (data.gitActivity?.pr) {
      const p = data.gitActivity.pr;
      const filesPerDay = p.days > 0 ? (p.uniqueRelevantFiles / p.days) : p.uniqueRelevantFiles;
      const relLinesPerDay = p.days > 0 ? (p.relevantLinesChanged / p.days) : p.relevantLinesChanged;
      report.push(`**Git Activity (PR range)**: commits ${p.commits} (${p.relevantCommits} relevant) over ~${p.days.toFixed(2)} days · ~${p.commitsPerDay.toFixed(2)} commits/day`);
      report.push(`↳ Magnitude: ~${Math.round(relLinesPerDay)} relevant LOC/day across ~${filesPerDay.toFixed(1)} files/day`);
    }
    if (data.gitActivity) {
      const br = data.gitActivity.indexBreakdown || { pr: 0, window: 0 };
      report.push(`**Activity Index**: ${Math.round((data.velocity.gitActivityIndex || 0) * 100)} / 100  (PR ${Math.round(br.pr*100)}, Window ${Math.round(br.window*100)})`);
      report.push(`**Blended Velocity**: ${data.velocity.blendedRecent >= 0 ? '+' : ''}${(data.velocity.blendedRecent * 100).toFixed(2)}%/day`);
      if (Number.isFinite(data.gitActivity.burstinessIndex)) {
        report.push(`**Commit Size Burstiness**: ${(data.gitActivity.burstinessIndex * 100).toFixed(0)} / 100 (higher = more uneven commit sizes)`);
      }
    }
    if (data.plateauDetected) {
      report.push('⚠️ **PLATEAU DETECTED** - Low SCS movement and low recent Git activity.');
    } else if (data.velocity.recent < this.minSlope && data.gitActivity) {
      report.push('ℹ️ Low SCS movement, but recent Git activity suggests ongoing work. Plateau not flagged.');
    }
    if (data.regressionDetected) {
      report.push('🚨 **REGRESSION DETECTED** - Score decreasing!');
    }
    report.push('');

    report.push('## ⏰ Completion Predictions');
    report.push('');
    if (data.eta) {
      report.push(`**Optimistic**: ${data.eta.optimistic} days → ${data.eta.optimisticDate}`);
      report.push(`**Realistic**: ${data.eta.realistic} days → ${data.eta.realisticDate}`);
      report.push(`**Pessimistic**: ${data.eta.pessimistic} days → ${data.eta.pessimisticDate}`);
      report.push('');
      report.push(`**Confidence**: ${Math.round(data.confidence ?? 0)}%`);
    } else {
      report.push('**ETA**: Cannot predict (insufficient velocity)');
      report.push('');
      report.push('"At current velocity, completion is... improbable."');
    }

    if (data.patterns.length > 0) {
      report.push('');
      report.push('## 🎭 Crime Patterns Detected');
      report.push('');
      for (const pattern of data.patterns) {
        report.push(`- **${pattern.type}**: ${pattern.description}`);
      }
    }

    // Readiness EXPLAIN (clarify inputs/thresholds that imply "prod-ready")
    if (data.explain) {
      report.push('');
      report.push('## 🧪 Readiness EXPLAIN');
      report.push('');
      const r = data.explain.readiness;
      report.push(`- SCS ≥ ${(data.explain.thresholds.scs*100).toFixed(0)}% → ${r.scs.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.scs.value*100).toFixed(1)}%)`);
      report.push(`- TCI ≥ ${(data.explain.thresholds.tci*100).toFixed(0)}% → ${r.tci.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.tci.value*100).toFixed(1)}%)`);
      report.push(`- MRI ≤ ${(data.explain.thresholds.mri*100).toFixed(0)}% → ${r.mri.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.mri.value*100).toFixed(1)}%)`);
      if (Number.isFinite(r.ci.value)) {
        report.push(`- CI Stability ≥ ${(data.explain.thresholds.ci*100).toFixed(0)}% (branch ${this.context?.ci?.branch || 'base'}) → ${r.ci.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.ci.value*100).toFixed(0)}% over ~${r.ci.windowHours ?? '?'}h)`);
      }
      if (data.explain.delivery) {
        report.push(`- Delivery context (last ${this.context?.timeframeHours ?? 168}h): ${data.explain.delivery.issuesClosed} issues closed · ${data.explain.delivery.prsMerged} PRs merged (informational, not gating)`);
      }
      report.push('');
      report.push('_Signals blend:_ SCS velocity (70%) + Git activity (30%, branch-first). Activity only suppresses false plateaus; it never inflates readiness.');
    }

    report.push('');
    report.push('## 📊 Historical Trajectory');
    report.push('');
    for (const point of data.history) {
      const date = point.timestamp ? new Date(point.timestamp).toISOString().slice(5, 10) : point.day ?? '?';
      report.push(`${date}: ${this.makeProgressBar(point.scs)} ${(point.scs * 100).toFixed(1)}%`);
    }
    report.push('');
    report.push('*"Every problem becomes elementary when reduced to mathematics"*');
    report.push('— Professor Moriarty');

    // Optional: Projection section (MP-01..03 stub)
    if (data.projection) {
      report.push('');
      report.push('---');
      report.push('');
      report.push('## 🔭 Projected After Merge (stub)');
      const p = data.projection;
      report.push(`Status: ${p.status || 'unknown'}`);
      if (p.merge) {
        report.push(`Base: ${p.merge.baseRef || 'main'} · Strategy: ${p.merge.strategy || 'tbd'}`);
      }
      if (typeof p.notes === 'string' && p.notes) {
        report.push(p.notes);
      }
    }
    return report.join('\n');
  }

  calculateEMA() {
    let emaSCS = null;
    let emaTCI = null;
    const series = [];
    
    for (const point of this.history.points) {
      emaSCS = emaSCS === null ? point.scs : (this.alpha * point.scs + (1 - this.alpha) * emaSCS);
      emaTCI = emaTCI === null ? point.tci : (this.alpha * point.tci + (1 - this.alpha) * emaTCI);
      
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

  makeProgressBar(value) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const filled = Math.round(clamped * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  }

  formatDateString(day) {
    if (typeof day === 'number' && Number.isFinite(day)) {
      const millis = day * 24 * 60 * 60 * 1000;
      return new Date(millis).toISOString();
    }
    return new Date(0).toISOString();
  }

  formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  // --- Git activity helpers ---
  computeGitActivityWindow() {
    // Best effort: if git is not available or repo is too shallow, return null
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch {
      return null;
    }
    const windowHours = Math.max(1, Math.floor(this.gitWindowHours));
    const sinceIso = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
    let raw = '';
    try {
      // Use a log format that marks commit boundaries so we can parse numstat blocks.
      raw = execSync(`git log --since='${sinceIso}' --pretty=format:'--%ct' --numstat --no-merges`, { encoding: 'utf8' });
    } catch {
      return null;
    }
    if (!raw || !raw.trim()) {
      return { windowHours, commits: 0, relevantCommits: 0, commitsPerDay: 0, linesChanged: 0, relevantLinesChanged: 0 };
    }

    const lines = raw.split(/\r?\n/);
    let commits = 0;
    let relevantCommits = 0;
    let linesChanged = 0;
    let relevantLinesChanged = 0;
    let inCommit = false;
    let commitRelevant = false;
    let commitRelevantSize = 0;
    const commitRelevantSizes = [];
    const uniqueRelevantFilesSet = new Set();
    const isRelevant = (file) => {
      const f = String(file || '').toLowerCase();
      return f.endsWith('.graphql') || f.includes('/ddl/') || f.includes('pgtap') || f.endsWith('.sql') || f.includes('/schema') || f.includes('.wesley/bundle.json') || f.includes('.wesley/history.json');
    };

    for (const line of lines) {
      if (line.startsWith('--')) {
        // Commit boundary
        if (inCommit) {
          if (commitRelevant) {
            relevantCommits++;
            commitRelevantSizes.push(commitRelevantSize);
          }
        }
        inCommit = true;
        commitRelevant = false;
        commitRelevantSize = 0;
        commits++;
        continue;
      }
      // numstat line: additions deletions path
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const add = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
        const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
        const file = parts.slice(2).join(' ');
        const delta = add + del;
        linesChanged += delta;
        if (isRelevant(file)) {
          relevantLinesChanged += delta;
          commitRelevant = true;
          commitRelevantSize += delta;
          uniqueRelevantFilesSet.add(file);
        }
      }
    }
    // Close last commit
    if (inCommit && commitRelevant) {
      relevantCommits++;
      commitRelevantSizes.push(commitRelevantSize);
    }
    const commitsPerDay = commits * (24 / windowHours);
    return {
      windowHours,
      commits,
      relevantCommits,
      commitsPerDay,
      linesChanged,
      relevantLinesChanged,
      uniqueRelevantFiles: uniqueRelevantFilesSet.size,
      commitRelevantSizes
    };
  }

  normalizeActivity(act) {
    if (!act) return 0;
    const commitsPerDay = Number.isFinite(act.commitsPerDay) ? act.commitsPerDay : 0;
    const relPerDay = Number.isFinite(act.windowHours)
      ? (act.relevantCommits * (24 / act.windowHours))
      : (Number.isFinite(act.days) && act.days > 0 ? act.relevantCommits / act.days : 0);
    const locPerDay = Number.isFinite(act.windowHours)
      ? (act.relevantLinesChanged * (24 / act.windowHours))
      : (Number.isFinite(act.days) && act.days > 0 ? act.relevantLinesChanged / act.days : act.relevantLinesChanged);
    const filesPerDay = Number.isFinite(act.windowHours)
      ? (Number.isFinite(act.uniqueRelevantFiles) ? (act.uniqueRelevantFiles * (24 / act.windowHours)) : 0)
      : (Number.isFinite(act.days) && act.days > 0 && Number.isFinite(act.uniqueRelevantFiles) ? act.uniqueRelevantFiles / act.days : 0);
    const commitScore = Math.min(1, commitsPerDay / this.activityCommitThreshold);
    const relevantScore = Math.min(1, relPerDay / this.activityRelevantCommitThreshold);
    const volumeScore = Math.min(1, locPerDay / Math.max(1, this.activityLinesPerDayTarget));
    const breadthScore = Math.min(1, filesPerDay / Math.max(1, this.activityFilesPerDayTarget));
    // Weight relevant changes a bit more than raw volume
    return (
      (commitScore * 0.25) +
      (relevantScore * 0.35) +
      (volumeScore * 0.25) +
      (breadthScore * 0.15)
    );
  }

  computeGitPRActivity() {
    // Use MORIARTY_BASE_REF or GITHUB_BASE_REF as the base; fall back to origin/main
    let baseRef = process.env.MORIARTY_BASE_REF || process.env.GITHUB_BASE_REF || 'main';
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch {
      return null;
    }
    try {
      // Ensure we have the base ref locally
      try { execSync(`git fetch --prune origin ${baseRef}:${'refs/remotes/origin/' + baseRef}`, { stdio: 'ignore' }); } catch {}
      const remoteBase = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;
      const mergeBase = execSync(`git merge-base HEAD ${remoteBase}`, { encoding: 'utf8' }).trim();
      if (!mergeBase) return null;
      // Collect PR-only commits
      const raw = execSync(`git log ${mergeBase}..HEAD --pretty=format:'--%ct' --numstat --no-merges`, { encoding: 'utf8' });
      if (!raw || !raw.trim()) {
        return { commits: 0, relevantCommits: 0, days: 0, commitsPerDay: 0, linesChanged: 0, relevantLinesChanged: 0 };
      }
      const lines = raw.split(/\r?\n/);
      let commits = 0;
      let relevantCommits = 0;
      let linesChanged = 0;
      let relevantLinesChanged = 0;
      let inCommit = false;
      let commitRelevant = false;
      let firstTs = null;
      let lastTs = null;
      let commitRelevantSize = 0;
      const commitRelevantSizes = [];
      const uniqueRelevantFilesSet = new Set();
      const isRelevant = (file) => {
        const f = String(file || '').toLowerCase();
        return f.endsWith('.graphql') || f.includes('/ddl/') || f.endsWith('.sql') || f.includes('pgtap') || f.includes('/schema') || f.includes('.wesley/bundle.json') || f.includes('.wesley/history.json');
      };
      for (const line of lines) {
        if (line.startsWith('--')) {
          const ts = Number(line.slice(2).trim());
          if (Number.isFinite(ts)) {
            if (firstTs === null) firstTs = ts;
            lastTs = ts;
          }
          if (inCommit) {
            if (commitRelevant) {
              relevantCommits++;
              commitRelevantSizes.push(commitRelevantSize);
            }
          }
          inCommit = true;
          commitRelevant = false;
          commitRelevantSize = 0;
          commits++;
          continue;
        }
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const add = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
          const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
          const file = parts.slice(2).join(' ');
          const delta = add + del;
          linesChanged += delta;
          if (isRelevant(file)) {
            relevantLinesChanged += delta;
            commitRelevant = true;
            commitRelevantSize += delta;
            uniqueRelevantFilesSet.add(file);
          }
        }
      }
      if (inCommit && commitRelevant) {
        relevantCommits++;
        commitRelevantSizes.push(commitRelevantSize);
      }
      const spanSecs = firstTs && lastTs ? Math.max(1, Math.abs(lastTs - firstTs)) : 0;
      const days = spanSecs / 86400 || 0;
      const commitsPerDay = days > 0 ? commits / days : commits; // if span is too small, assume concentrated activity
      return {
        commits,
        relevantCommits,
        days,
        commitsPerDay,
        linesChanged,
        relevantLinesChanged,
        uniqueRelevantFiles: uniqueRelevantFilesSet.size,
        commitRelevantSizes
      };
    } catch {
      return null;
    }
  }

  computeBurstinessIndex(samples) {
    if (!Array.isArray(samples) || samples.length < 2) return 0;
    const nums = samples.map((n) => (Number.isFinite(n) ? n : 0)).filter((n) => n > 0);
    if (nums.length < 2) return 0;
    const mean = nums.reduce((a,b)=>a+b,0)/nums.length;
    if (mean <= 0) return 0;
    const variance = nums.reduce((a,n)=>a+Math.pow(n-mean,2),0)/(nums.length-1);
    const sd = Math.sqrt(variance);
    const cv = sd / mean; // coefficient of variation
    // Map CV to 0..1 with a soft cap; CV≈2 or more → ~1
    return Math.min(1, cv / 2);
  }
}
