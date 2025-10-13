/**
 * SHA-lock HOLMES - The Consulting Detective
 * Investigates Wesley's evidence bundle
 */

import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_WEIGHTS = {
  password: 10,
  email: 8,
  id: 7,
  user: 6,
  created: 5,
  theme: 2,
  default: 5
};

export class Holmes {
  constructor(bundle) {
    this.bundle = bundle;
    this.sha = bundle.sha;
    this.evidence = bundle.evidence;
    this.scores = bundle.scores;
    this.weights = this.loadWeightOverrides();
  }

  /**
   * Conduct investigation and return report
   */
  investigate() {
    return this.renderInvestigation(this.investigationData());
  }

  investigationData() {
    const scores = this.extractScores();
    const summary = {
      generatedAt: this.bundle.timestamp,
      sha: this.sha,
      weightedCompletion: scores.scs,
      verificationCount: this.countVerifications(),
      verificationStatus: this.scores?.readiness?.verdict ?? 'UNKNOWN',
      tci: scores.tci,
      mri: scores.mri
    };

    const elements = [];
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      const weight = this.inferWeight(uid);
      const status = this.getStatus(evidence);
      const citation = this.getCitation(evidence);
      const deduction = this.makeDeduction(uid, status);
      elements.push({ element: uid, weight, status, evidence: citation, deduction });
    }

    const gates = [];
    const mri = summary.mri;
    const tci = summary.tci;
    gates.push({ gate: 'Migration Risk', status: mri < 0.4 ? '✅' : '⛔', evidence: `MRI: ${(mri * 100).toFixed(1)}%`, ruling: this.assessRisk(mri) });
    gates.push({ gate: 'Test Coverage', status: tci > 0.7 ? '✅' : '⚠️', evidence: `TCI: ${(tci * 100).toFixed(1)}%`, ruling: this.assessTests(tci) });
    const sensitive = this.checkSensitiveFields();
    gates.push({ gate: 'Sensitive Fields', status: sensitive.safe ? '✅' : '⛔', evidence: `${sensitive.count} fields`, ruling: sensitive.ruling });

    const verdict = this.buildVerdict(summary.verificationStatus);

    return {
      metadata: summary,
      scores,
      evidence: elements,
      gates,
      verdict
    };
  }

  renderInvestigation(data) {
    const { metadata, evidence, gates, verdict } = data;
    const lines = [];
    lines.push('### 🕵️ SHA-lock HOLMES Investigation');
    lines.push('');
    lines.push(`- Generated: ${metadata.generatedAt}`);
    lines.push(`- Commit SHA: ${metadata.sha}`);
    lines.push('');
    lines.push(`> ⚠️ Evidence valid only for commit \`${metadata.sha.substring(0, 7)}\``);
    lines.push('');

    lines.push('## 🔍 Executive Deduction');
    lines.push('');
    lines.push('"Watson, after careful examination of the evidence, I deduce..."');
    lines.push('');
    lines.push(`**Weighted Completion**: ${this.progressBar(metadata.weightedCompletion)} ${(metadata.weightedCompletion * 100).toFixed(1)}%`);
    lines.push(`**Scores**: SCS ${(data.scores.scs * 100).toFixed(1)}% · TCI ${(data.scores.tci * 100).toFixed(1)}% · MRI ${(data.scores.mri * 100).toFixed(1)}%`);
    lines.push(`**Verification Status**: ${metadata.verificationCount} claims verified`);
    lines.push(`**Ship Verdict**: ${metadata.verificationStatus}`);
    lines.push('');

    lines.push('## 📊 The Weight of Evidence');
    lines.push('');
    lines.push('"Observe, Watson, how not all features carry equal importance..."');
    lines.push('');
    lines.push('| Element | Weight | Status | Evidence | Deduction |');
    lines.push('|---------|--------|--------|----------|-----------|');
    for (const row of evidence) {
      lines.push(`| ${row.element} | ${row.weight} | ${row.status} | ${row.evidence} | ${row.deduction} |`);
    }
    lines.push('');

    lines.push('## 🚪 Security & Performance Gates');
    lines.push('');
    lines.push('"Elementary security measures, Watson..."');
    lines.push('');
    lines.push('| Gate | Status | Evidence | Holmes\'s Ruling |');
    lines.push('|------|--------|----------|-----------------|');
    for (const gate of gates) {
      lines.push(`| ${gate.gate} | ${gate.status} | ${gate.evidence} | "${gate.ruling}" |`);
    }
    lines.push('');

    lines.push('## 📋 The Verdict');
    lines.push('');
    lines.push(verdict.markdown);
    lines.push('');
    lines.push('Signed and sealed,');
    lines.push('- S. Holmes, Consulting Detective');
    lines.push('');
    lines.push(`[END OF INVESTIGATION FOR COMMIT ${metadata.sha.substring(0, 7)}]`);
    return lines.join('\n');
  }

  buildVerdict(code) {
    switch (code) {
      case 'ELEMENTARY': {
        const message = 'Ship immediately! The evidence is conclusive.';
        return { code, message, markdown: `✅ **ELEMENTARY** - Ship immediately!\n"The evidence is conclusive. No mysteries remain."` };
      }
      case 'REQUIRES INVESTIGATION': {
        const message = 'Further investigation required before shipping.';
        return { code, message, markdown: `⚠️ **REQUIRES FURTHER INVESTIGATION**\n"Some clues remain unclear. Address the noted issues."` };
      }
      case 'YOU SHALL NOT PASS':
      default: {
        const message = 'Do not ship. Critical evidence is missing.';
        return { code: 'YOU SHALL NOT PASS', message, markdown: `⛔ **YOU SHALL NOT PASS**\n"Critical evidence is missing! Return to your laboratory!"` };
      }
    }
  }

  progressBar(value) {
    const filled = Math.round(Math.min(Math.max(value, 0), 1) * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  }

  // Helper methods
  extractScores() {
    const source = this.scores?.scores ?? {};
    return {
      scs: typeof source.scs === 'number' ? source.scs : 0,
      tci: typeof source.tci === 'number' ? source.tci : 0,
      mri: typeof source.mri === 'number' ? source.mri : 0
    };
  }

  countVerifications() {
    let count = 0;
    for (const evidence of Object.values(this.evidence.evidence || {})) {
      for (const locations of Object.values(evidence)) {
        count += locations.length;
      }
    }
    return count;
  }

  inferWeight(uid) {
    const lowered = uid.toLowerCase();
    for (const [needle, weight] of Object.entries(this.weights)) {
      if (needle === 'default') continue;
      if (lowered.includes(needle)) {
        return weight;
      }
    }
    return this.weights.default;
  }

  getStatus(evidence) {
    const hasSQL = evidence.sql?.length > 0;
    const hasTests = evidence.tests?.length > 0;
    
    if (hasSQL && hasTests) return '✅ SQL & tests';
    if (hasSQL) return '⚠️ SQL only';
    if (hasTests) return '⚠️ Tests only';
    return '⛔ Missing';
  }

  getCitation(evidence) {
    const citations = [];
    for (const [kind, locations] of Object.entries(evidence)) {
      if (locations?.[0]) {
        citations.push(`${locations[0].file}:${locations[0].lines}@${this.sha.substring(0, 7)}`);
        break;
      }
    }
    return citations[0] || 'No evidence';
  }

  makeDeduction(uid, status) {
    if (status.startsWith('✅')) return 'Elementary!';
    if (status.startsWith('⚠️')) return 'Incomplete';
    if (uid.includes('password') || uid.includes('sensitive')) {
      return 'CRITICAL OVERSIGHT!';
    }
    return 'Missing';
  }

  assessRisk(mri) {
    if (mri < 0.2) return 'Trivial risk';
    if (mri < 0.4) return 'Acceptable risk';
    if (mri < 0.6) return 'Moderate risk';
    return 'HIGH RISK!';
  }

  assessTests(tci) {
    if (tci > 0.8) return 'Excellent coverage';
    if (tci > 0.7) return 'Adequate coverage';
    if (tci > 0.5) return 'Insufficient coverage';
    return 'Theatrical tests!';
  }

  checkSensitiveFields() {
    let count = 0;
    let unsafe = 0;
    
    for (const uid of Object.keys(this.evidence.evidence || {})) {
      if (uid.includes('password') || uid.includes('sensitive') || uid.includes('pii')) {
        count++;
        // Check if has proper constraints
        const evidence = this.evidence.evidence[uid];
        if (!evidence.sql || !evidence.tests) {
          unsafe++;
        }
      }
    }
    
    return {
      count,
      safe: unsafe === 0,
      ruling: unsafe === 0 ? 'All secured' : `${unsafe} EXPOSED!`
    };
  }

  loadWeightOverrides() {
    const weights = { ...DEFAULT_WEIGHTS };
    try {
      if (process.env.WESLEY_HOLMES_WEIGHT_FILE && existsSync(process.env.WESLEY_HOLMES_WEIGHT_FILE)) {
        const fileWeights = JSON.parse(readFileSync(process.env.WESLEY_HOLMES_WEIGHT_FILE, 'utf8'));
        Object.assign(weights, fileWeights);
      } else if (process.env.WESLEY_HOLMES_WEIGHTS) {
        const envWeights = JSON.parse(process.env.WESLEY_HOLMES_WEIGHTS);
        Object.assign(weights, envWeights);
      }
    } catch (err) {
      console.warn('[Holmes] Unable to load weight overrides:', err?.message);
    }
    if (typeof weights.default !== 'number') {
      weights.default = DEFAULT_WEIGHTS.default;
    }
    return weights;
  }
}
