export function renderMoriartyPrediction(data, { context = {}, minSlope = 0.01 } = {}) {
  const report = [];
  report.push("### 🧠 Professor Moriarty's Temporal Predictions");
  report.push('');
  report.push('_The Mathematics of Inevitability_');
  report.push('');
  report.push(`- Analysis Date: ${data.metadata.analysisAt}`);
  if (data.metadata.runId) {
    report.push(`- Run ID: ${data.metadata.runId}`);
  }
  if (data.metadata.transmutation) {
    report.push(`- Transmutation: ${data.metadata.transmutation}`);
  }
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
  report.push(`**SCS**: ${makeProgressBar(latest.scs)} ${(latest.scs * 100).toFixed(1)}%`);
  report.push(`**TCI**: ${makeProgressBar(latest.tci)} ${(latest.tci * 100).toFixed(1)}%`);
  report.push(`**MRI**: ${(latest.mri * 100).toFixed(1)}% risk`);
  if (latest.evidenceTrust) {
    report.push(`**Evidence Trust**: ${latest.evidenceTrust}`);
  }
  report.push('');

  report.push('## 📈 Velocity Analysis');
  report.push('');
  report.push(
    `**SCS Velocity**: ${data.velocity.recent >= 0 ? '+' : ''}${(data.velocity.recent * 100).toFixed(2)}%/day`
  );
  if (data.gitActivity?.window) {
    const w = data.gitActivity.window;
    const filesPerDay =
      w.windowHours > 0 ? w.uniqueRelevantFiles * (24 / w.windowHours) : w.uniqueRelevantFiles;
    const relLinesPerDay =
      w.windowHours > 0 ? w.relevantLinesChanged * (24 / w.windowHours) : w.relevantLinesChanged;
    report.push(
      `**Git Activity (window)**: ${w.windowHours}h · commits ${w.commits} (${w.relevantCommits} relevant) · ~${w.commitsPerDay.toFixed(2)} commits/day`
    );
    report.push(
      `↳ Magnitude: ~${Math.round(relLinesPerDay)} relevant LOC/day across ~${filesPerDay.toFixed(1)} files/day`
    );
  }
  if (data.gitActivity?.pr) {
    const p = data.gitActivity.pr;
    const filesPerDay = p.days > 0 ? p.uniqueRelevantFiles / p.days : p.uniqueRelevantFiles;
    const relLinesPerDay = p.days > 0 ? p.relevantLinesChanged / p.days : p.relevantLinesChanged;
    report.push(
      `**Git Activity (PR range)**: commits ${p.commits} (${p.relevantCommits} relevant) over ~${p.days.toFixed(2)} days · ~${p.commitsPerDay.toFixed(2)} commits/day`
    );
    report.push(
      `↳ Magnitude: ~${Math.round(relLinesPerDay)} relevant LOC/day across ~${filesPerDay.toFixed(1)} files/day`
    );
  }
  if (data.gitActivity) {
    const br = data.gitActivity.indexBreakdown || { pr: 0, window: 0 };
    report.push(
      `**Activity Index**: ${Math.round((data.velocity.gitActivityIndex || 0) * 100)} / 100  (PR ${Math.round(br.pr * 100)}, Window ${Math.round(br.window * 100)})`
    );
    report.push(
      `**Blended Velocity**: ${data.velocity.blendedRecent >= 0 ? '+' : ''}${(data.velocity.blendedRecent * 100).toFixed(2)}%/day`
    );
    if (Number.isFinite(data.gitActivity.burstinessIndex)) {
      report.push(
        `**Commit Size Burstiness**: ${(data.gitActivity.burstinessIndex * 100).toFixed(0)} / 100 (higher = more uneven commit sizes)`
      );
    }
  }
  if (data.plateauDetected) {
    report.push('⚠️ **PLATEAU DETECTED** - Low SCS movement and low recent Git activity.');
  } else if (data.velocity.recent < minSlope && data.gitActivity) {
    report.push(
      'ℹ️ Low SCS movement, but recent Git activity suggests ongoing work. Plateau not flagged.'
    );
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

  if (Array.isArray(data.warnings) && data.warnings.length > 0) {
    report.push('');
    report.push('## ⚠️ Warnings');
    report.push('');
    for (const warning of data.warnings) {
      report.push(`- ${warning}`);
    }
  }

  if (data.runtime?.run) {
    report.push('');
    report.push('## 🧾 Runtime Run Context');
    report.push('');
    report.push(`- Run ID: ${data.runtime.run.runId}`);
    report.push(`- Transmutation: ${data.runtime.run.transmutation || 'n/a'}`);
    report.push(`- Command: ${data.runtime.run.command || 'n/a'}`);
    report.push(`- Status: ${data.runtime.run.status}`);
    report.push(`- Stream: ${data.runtime.run.streamId || 'n/a'}`);
    report.push(`- Events: ${data.runtime.run.eventCount}`);
    report.push(`- Artifacts: ${data.runtime.run.artifactCount}`);
    if (data.runtime.snapshot) {
      report.push(`- Snapshot: yes (seq=${data.runtime.snapshot.lastSequence ?? 'n/a'})`);
    } else {
      report.push('- Snapshot: no');
    }
    if (data.runtime.replay) {
      report.push(
        `- Replay: ${data.runtime.replay.valid ? 'valid' : 'invalid'} · ${data.runtime.replay.terminal ? 'terminal' : 'non-terminal'}`
      );
    }
    if (data.runtime.run.failure?.code) {
      report.push(
        `- Failure: ${data.runtime.run.failure.code}${data.runtime.run.failure.message ? ` - ${data.runtime.run.failure.message}` : ''}`
      );
    }
  }

  if (data.explain) {
    report.push('');
    report.push('## 🧪 Readiness EXPLAIN');
    report.push('');
    const r = data.explain.readiness;
    report.push(
      `- SCS ≥ ${(data.explain.thresholds.scs * 100).toFixed(0)}% → ${r.scs.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.scs.value * 100).toFixed(1)}%)`
    );
    report.push(
      `- TCI ≥ ${(data.explain.thresholds.tci * 100).toFixed(0)}% → ${r.tci.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.tci.value * 100).toFixed(1)}%)`
    );
    report.push(
      `- MRI ≤ ${(data.explain.thresholds.mri * 100).toFixed(0)}% → ${r.mri.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.mri.value * 100).toFixed(1)}%)`
    );
    if (Number.isFinite(r.ci.value)) {
      report.push(
        `- CI Stability ≥ ${(data.explain.thresholds.ci * 100).toFixed(0)}% (branch ${context?.ci?.branch || 'base'}) → ${r.ci.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${(r.ci.value * 100).toFixed(0)}% over ~${r.ci.windowHours ?? '?'}h)`
      );
    }
    if (r.evidenceTrust) {
      const reason =
        Array.isArray(r.evidenceTrust.reasons) && r.evidenceTrust.reasons.length > 0
          ? ` — ${r.evidenceTrust.reasons[0]}`
          : '';
      report.push(
        `- Evidence Trust ≥ ${r.evidenceTrust.threshold} → ${r.evidenceTrust.pass ? 'PASS ✅' : 'FAIL ❌'} (actual ${r.evidenceTrust.value})${reason}`
      );
    }
    if (r.counterfactual) {
      const reason =
        Array.isArray(r.counterfactual.reasons) && r.counterfactual.reasons.length > 0
          ? ` — ${r.counterfactual.reasons[0]}`
          : '';
      const details = [
        `actual ${r.counterfactual.value}`,
        `status ${r.counterfactual.status}`,
        `risk ${r.counterfactual.riskClass}`
      ];
      if (r.counterfactual.wouldFail) {
        details.push('would fail under hard gating');
      }
      report.push(
        `- Counterfactual gate must be ${r.counterfactual.threshold} → ${r.counterfactual.pass ? 'PASS ✅' : 'FAIL ❌'} (${details.join(', ')})${reason}`
      );
    }
    if (data.explain.delivery) {
      report.push(
        `- Delivery context (last ${context?.timeframeHours ?? 168}h): ${data.explain.delivery.issuesClosed} issues closed · ${data.explain.delivery.prsMerged} PRs merged (informational, not gating)`
      );
    }
    report.push('');
    report.push(
      '_Signals blend:_ SCS velocity (70%) + Git activity (30%, branch-first). Activity only suppresses false plateaus; it never inflates readiness.'
    );
  }

  report.push('');
  report.push('## 📊 Historical Trajectory');
  report.push('');
  for (const point of data.history) {
    const date = point.timestamp
      ? new Date(point.timestamp).toISOString().slice(5, 10)
      : (point.day ?? '?');
    report.push(`${date}: ${makeProgressBar(point.scs)} ${(point.scs * 100).toFixed(1)}%`);
  }
  report.push('');
  report.push('*"Every problem becomes elementary when reduced to mathematics"*');
  report.push('— Professor Moriarty');

  if (data.counterfactual) {
    const c = data.counterfactual;
    report.push('');
    report.push('---');
    report.push('');
    report.push('## 🪞 Counterfactual Analysis');
    report.push('');
    report.push(`Composition: ${c.composition || 'merge'}`);
    report.push(`Base: ${c.requested?.baseRef || 'main'} → ${c.resolved?.baseSha || 'unknown'}`);
    report.push(`Head: ${c.requested?.headRef || 'HEAD'} → ${c.resolved?.headSha || 'unknown'}`);
    if (Array.isArray(c.resolved?.braidRefs) && c.resolved.braidRefs.length > 0) {
      report.push(
        `Braids: ${c.resolved.braidRefs.map((item) => `${item.ref}@${item.sha.slice(0, 7)}`).join(', ')}`
      );
    }
    report.push(`Lane Fingerprint: ${c.laneFingerprint}`);
    report.push(`Status: ${c.judgment?.status || 'unknown'}`);
    report.push(
      `Gate: ${c.judgment?.gate || 'pass'}${c.judgment?.wouldFail ? ' (would fail under hard gating)' : ''}`
    );
    report.push(`Risk: ${c.judgment?.riskClass || 'none'}`);
    if (Number.isFinite(c.judgment?.confidenceAdjustment)) {
      report.push(
        `Confidence Adjustment: ${c.judgment.confidenceAdjustment >= 0 ? '+' : ''}${c.judgment.confidenceAdjustment}`
      );
    }
    if (Array.isArray(c.judgment?.signals) && c.judgment.signals.length > 0) {
      report.push(`Signals: ${c.judgment.signals.join(', ')}`);
    }
    if (c.facts?.comparison?.factDigest) {
      report.push(`Comparison Fact: ${c.facts.comparison.factDigest}`);
    }
    if (c.facts?.transferPlan?.factDigest) {
      report.push(`Transfer Fact: ${c.facts.transferPlan.factDigest}`);
    }
    if (Array.isArray(c.judgment?.reasons) && c.judgment.reasons.length > 0) {
      report.push('');
      for (const reason of c.judgment.reasons) {
        report.push(`- ${reason}`);
      }
    }
  }

  return report.join('\n');
}

function makeProgressBar(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const filled = Math.round(clamped * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
