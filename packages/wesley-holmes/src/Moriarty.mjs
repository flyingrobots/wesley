/**
 * Professor MORIARTY - The Napoleon of Crime... Prevention
 * Predictive analytics for schema completion
 */

export class Moriarty {
  constructor(history) {
    this.history = history;
    this.alpha = 0.4; // EMA smoothing factor
    this.minSlope = 0.01; // Minimum progress per day
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
    const plateau = Math.abs(recentVelocity) < this.minSlope;
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

    const result = {
      ...base,
      status: 'OK',
      latest,
      velocity: {
        recent: recentVelocity,
        blendedSlope: slope.scs
      },
      plateauDetected: plateau,
      regressionDetected: regression,
      patterns: this.detectPatterns()
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
    if (data.plateauDetected) {
      report.push('⚠️ **PLATEAU DETECTED** - Progress has stalled!');
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
}
