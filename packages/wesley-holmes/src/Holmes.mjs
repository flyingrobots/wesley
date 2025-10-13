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
    const report = [];
    report.push('### 🕵️ SHA-lock HOLMES Investigation');
    report.push('');
    report.push(`- Generated: ${this.bundle.timestamp}`);
    report.push(`- Commit SHA: ${this.sha}`);
    report.push('');
    report.push(`> ⚠️ Evidence valid only for commit \`${this.sha.substring(0, 7)}\``);
    report.push('');
    
    // Executive Deduction
    report.push('## 🔍 Executive Deduction');
    report.push('');
    report.push('"Watson, after careful examination of the evidence, I deduce..."');
    report.push('');
    
    const scs = this.scores.scores.scs;
    const bar = '█'.repeat(Math.round(scs * 10)) + '░'.repeat(10 - Math.round(scs * 10));
    report.push(`**Weighted Completion**: ${bar} ${(scs * 100).toFixed(1)}%`);
    report.push(`**Verification Status**: ${this.countVerifications()} claims verified`);
    report.push(`**Ship Verdict**: ${this.scores.readiness.verdict}`);
    report.push('');
    
    // The Weight of Evidence
    report.push('## 📊 The Weight of Evidence');
    report.push('');
    report.push('"Observe, Watson, how not all features carry equal importance..."');
    report.push('');
    report.push('| Element | Weight | Status | Evidence | Deduction |');
    report.push('|---------|--------|--------|----------|-----------|');
    
    // Analyze each element
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      const weight = this.inferWeight(uid);
      const status = this.getStatus(evidence);
      const citation = this.getCitation(evidence);
      const deduction = this.makeDeduction(uid, status);
      
      report.push(`| ${uid} | ${weight} | ${status} | ${citation} | ${deduction} |`);
    }
    
    report.push('');
    
    // Risk Assessment
    report.push('## 🚪 Security & Performance Gates');
    report.push('');
    report.push('"Elementary security measures, Watson..."');
    report.push('');
    report.push('| Gate | Status | Evidence | Holmes\'s Ruling |');
    report.push('|------|--------|----------|-----------------|');
    
    const mri = this.scores.scores.mri;
    const tci = this.scores.scores.tci;
    
    report.push(`| Migration Risk | ${mri < 0.4 ? '✅' : '⛔'} | MRI: ${(mri * 100).toFixed(1)}% | "${this.assessRisk(mri)}" |`);
    report.push(`| Test Coverage | ${tci > 0.7 ? '✅' : '⚠️'} | TCI: ${(tci * 100).toFixed(1)}% | "${this.assessTests(tci)}" |`);
    
    // Check for sensitive fields
    const hasSensitive = this.checkSensitiveFields();
    report.push(`| Sensitive Fields | ${hasSensitive.safe ? '✅' : '⛔'} | ${hasSensitive.count} fields | "${hasSensitive.ruling}" |`);
    
    report.push('');
    
    // The Verdict
    report.push('## 📋 The Verdict');
    report.push('');
    
    switch (this.scores.readiness.verdict) {
      case 'ELEMENTARY':
        report.push('✅ **ELEMENTARY** - Ship immediately!');
        report.push('"The evidence is conclusive. No mysteries remain."');
        break;
      case 'REQUIRES INVESTIGATION':
        report.push('⚠️ **REQUIRES FURTHER INVESTIGATION**');
        report.push('"Some clues remain unclear. Address the noted issues."');
        break;
      case 'YOU SHALL NOT PASS':
        report.push('⛔ **YOU SHALL NOT PASS**');
        report.push('"Critical evidence is missing! Return to your laboratory!"');
        break;
    }
    
    report.push('');
    report.push('Signed and sealed,');
    report.push('- S. Holmes, Consulting Detective');
    report.push('');
    report.push(`[END OF INVESTIGATION FOR COMMIT ${this.sha.substring(0, 7)}]`);
    
    return report.join('\n');
  }

  // Helper methods
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
