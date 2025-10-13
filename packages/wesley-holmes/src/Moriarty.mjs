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
    const report = [];
    report.push('### 🧠 Professor Moriarty\'s Temporal Predictions');
    report.push('');
    report.push('_The Mathematics of Inevitability_');
    report.push('');
    report.push(`- Analysis Date: ${new Date().toISOString()}`);
    report.push('');
    
    if (!this.history.points || this.history.points.length < 2) {
      report.push('**INSUFFICIENT DATA**');
      report.push('');
      report.push('> "I require at least two data points to predict the future."');
      report.push('> "Run Wesley generate multiple times to build history."');
      return report.join('\n');
    }
    
    const latest = this.history.points[this.history.points.length - 1];
    const series = this.calculateEMA();
    const slope = this.calculateSlope(series);
    const recentVelocity = this.calculateRecentVelocity(series);
    
    report.push('## 🔮 Current State');
    report.push('');
    
    const scsBar = this.makeProgressBar(latest.scs);
    const tciBar = this.makeProgressBar(latest.tci);
    
    report.push(`**SCS**: ${scsBar} ${(latest.scs * 100).toFixed(1)}%`);
    report.push(`**TCI**: ${tciBar} ${(latest.tci * 100).toFixed(1)}%`);
    report.push(`**MRI**: ${(latest.mri * 100).toFixed(1)}% risk`);
    report.push('');
    
    report.push('## 📈 Velocity Analysis');
    report.push('');
    
    const velocity = recentVelocity;
    report.push(`**SCS Velocity**: ${velocity >= 0 ? '+' : ''}${(velocity * 100).toFixed(2)}%/day`);
    
    if (Math.abs(velocity) < this.minSlope) {
      report.push('⚠️ **PLATEAU DETECTED** - Progress has stalled!');
    }
    
    if (series.length >= 2 && series[series.length - 1].scs < series[series.length - 2].scs) {
      report.push('🚨 **REGRESSION DETECTED** - Score decreasing!');
    }
    
    report.push('');
    
    // ETA Calculation
    report.push('## ⏰ Completion Predictions');
    report.push('');
    
    if (velocity > this.minSlope) {
      const daysToComplete = (1.0 - latest.scs) / velocity;
      const etaDate = new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000);
      
      report.push(`**Optimistic**: ${Math.ceil(daysToComplete * 0.7)} days → ${this.formatDate(new Date(Date.now() + daysToComplete * 0.7 * 24 * 60 * 60 * 1000))}`);
      report.push(`**Realistic**: ${Math.ceil(daysToComplete)} days → ${this.formatDate(etaDate)}`);
      report.push(`**Pessimistic**: ${Math.ceil(daysToComplete * 1.5)} days → ${this.formatDate(new Date(Date.now() + daysToComplete * 1.5 * 24 * 60 * 60 * 1000))}`);
      
      // Confidence calculation
      const variance = this.calculateVariance(series);
      const confidence = Math.max(0, Math.min(100, 100 - variance * 120));
      
      report.push('');
      report.push(`**Confidence**: ${confidence.toFixed(0)}%`);
    } else {
      report.push('**ETA**: Cannot predict (insufficient velocity)');
      report.push('');
      report.push('"At current velocity, completion is... improbable."');
    }
    
    // Pattern detection
    const patterns = this.detectPatterns();
    if (patterns.length > 0) {
      report.push('');
      report.push('## 🎭 Crime Patterns Detected');
      report.push('');
      for (const pattern of patterns) {
        report.push(`- **${pattern.type}**: ${pattern.description}`);
      }
    }
    
    // Historical chart
    report.push('');
    report.push('## 📊 Historical Trajectory');
    report.push('');
    
    const last7 = this.history.points.slice(-7);
    for (const point of last7) {
      const date = new Date(point.timestamp).toISOString().slice(5, 10);
      const bar = this.makeProgressBar(point.scs);
      report.push(`${date}: ${bar} ${(point.scs * 100).toFixed(1)}%`);
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
    const filled = Math.round(value * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  }

  formatDate(date) {
    return date.toISOString().slice(0, 10);
  }
}
