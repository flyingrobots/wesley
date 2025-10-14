/**
 * SHA-lock HOLMES - The Consulting Detective
 * Investigates Wesley's evidence bundle
 */

import { relative } from 'node:path';
import { loadWeightConfig } from './weight-config.mjs';

export class Holmes {
  constructor(bundle) {
    this.bundle = bundle;
    this.sha = bundle.sha;
    this.evidence = bundle.evidence;
    this.scores = bundle.scores;
    this.bundleVersion = bundle.bundleVersion || '1.0.0';
    const { config, source } = loadWeightConfig();
    this.weightConfig = config;
    this.weightConfigSource = this.formatWeightConfigSource(source);
    this.schemaDirectives = this.buildDirectiveIndex(bundle?.schema);
  }

  /**
   * Conduct investigation and return report
   */
  investigate() {
    return this.renderInvestigation(this.investigationData());
  }

  investigationData() {
    const breakdown = this.extractBreakdown();
    const scores = { ...this.extractScores(), breakdown };
    const summary = {
      generatedAt: this.bundle.timestamp,
      sha: this.sha,
      weightedCompletion: scores.scs,
      verificationCount: this.countVerifications(),
      verificationStatus: this.scores?.readiness?.verdict ?? 'UNKNOWN',
      tci: scores.tci,
      mri: scores.mri,
      bundleVersion: this.bundleVersion,
      weightConfigSource: this.weightConfigSource
    };

    const elements = [];
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      const weightInfo = this.inferWeight(uid);
      const status = this.getStatus(evidence);
      const citation = this.getCitation(evidence);
      const deduction = this.makeDeduction(uid, status);
      elements.push({ element: uid, weight: weightInfo.value, weightSource: weightInfo.source, status, evidence: citation, deduction });
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
      breakdown,
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
    lines.push(`- Bundle Version: ${metadata.bundleVersion || '—'}`);
    lines.push('');
    lines.push(`> ⚠️ Evidence valid only for commit \`${metadata.sha.substring(0, 7)}\``);
    lines.push('');

    lines.push('## 🔍 Executive Deduction');
    lines.push('');
    lines.push('"Watson, after careful examination of the evidence, I deduce..."');
    lines.push('');
    lines.push(`**Weighted Completion**: ${this.progressBar(metadata.weightedCompletion)} ${(metadata.weightedCompletion * 100).toFixed(1)}%`);
    lines.push(`**Scores**: SCS ${(data.scores.scs * 100).toFixed(1)}% · TCI ${(data.scores.tci * 100).toFixed(1)}% · MRI ${(data.scores.mri * 100).toFixed(1)}%`);
    lines.push(`**Weight Config**: ${metadata.weightConfigSource}`);
    lines.push(`**Verification Status**: ${metadata.verificationCount} claims verified`);
    lines.push(`**Ship Verdict**: ${metadata.verificationStatus}`);
    lines.push('');

    lines.push('## 🧮 Score Breakdown');
    lines.push('');
    this.renderBreakdown(lines, data.breakdown);
    lines.push('');

    lines.push('## 📊 The Weight of Evidence');
    lines.push('');
    lines.push('"Observe, Watson, how not all features carry equal importance..."');
    lines.push('');
    lines.push('| Element | Weight | Source | Status | Evidence | Deduction |');
    lines.push('|---------|--------|--------|--------|----------|-----------|');
    for (const row of evidence) {
      lines.push(`| ${row.element} | ${row.weight} | ${this.prettyLabel(row.weightSource)} | ${row.status} | ${row.evidence} | ${row.deduction} |`);
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

  extractBreakdown() {
    const raw = this.scores?.scores?.breakdown || {};
    return {
      scs: raw.scs || {},
      tci: raw.tci || {},
      mri: raw.mri || {}
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

  renderBreakdown(lines, breakdown = {}) {
    const scs = breakdown.scs || {};
    const tci = breakdown.tci || {};
    const mri = breakdown.mri || {};

    if (!Object.keys(scs).length && !Object.keys(tci).length && !Object.keys(mri).length) {
      lines.push('_Breakdown not available in bundle._');
      return;
    }

    if (Object.keys(scs).length) {
      lines.push('### Schema Coverage (SCS)');
      lines.push('');
      lines.push('| Component | Score | Coverage |');
      lines.push('|-----------|-------|----------|');
      for (const [key, entry] of Object.entries(scs)) {
        const score = this.formatPercent(entry?.score);
        const coverage = typeof entry?.coveredWeight === 'number' && typeof entry?.totalWeight === 'number' && entry.totalWeight > 0
          ? `${this.formatPercent(entry.coveredWeight / entry.totalWeight)} (${entry.coveredWeight.toFixed(1)}/${entry.totalWeight.toFixed(1)})`
          : '—';
        lines.push(`| ${this.prettyLabel(key)} | ${score} | ${coverage} |`);
      }
      lines.push('');
    }

    if (Object.keys(tci).length) {
      lines.push('### Test Confidence (TCI)');
      lines.push('');
      lines.push('| Component | Score | Coverage | Notes |');
      lines.push('|-----------|-------|----------|-------|');
      for (const [key, entry] of Object.entries(tci)) {
        const score = this.formatPercent(entry?.score);
        const coverage = typeof entry?.covered === 'number' && typeof entry?.total === 'number' && entry.total > 0
          ? `${this.formatPercent(entry.covered / entry.total)} (${entry.covered.toFixed(1)}/${entry.total.toFixed(1)})`
          : '—';
        const notes = entry?.components
          ? Object.entries(entry.components)
              .map(([name, value]) => `${this.prettyLabel(name)} ${this.formatPercent(value)}`)
              .join(', ')
          : '';
        lines.push(`| ${this.prettyLabel(key)} | ${score} | ${coverage} | ${notes || '—'} |`);
      }
      lines.push('');
    }

    if (Object.keys(mri).length) {
      lines.push('### Migration Risk (MRI)');
      lines.push('');
      lines.push('| Risk Vector | Score | Contribution | Points |');
      lines.push('|-------------|-------|--------------|--------|');
      for (const [key, entry] of Object.entries(mri)) {
        const score = this.formatPercent(entry?.score);
        const contribution = this.formatPercent(entry?.contribution);
        const points = typeof entry?.points === 'number' ? entry.points.toFixed(1) : '0.0';
        lines.push(`| ${this.prettyLabel(key)} | ${score} | ${contribution} | ${points} |`);
      }
      lines.push('');
    }
  }

  prettyLabel(key) {
    return String(key || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, (m) => m.toUpperCase());
  }

  formatPercent(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${(value * 100).toFixed(1)}%`;
  }

  inferWeight(uid) {
    const override = this.matchOverride(uid);
    if (override) return override;

    const directiveWeight = this.matchDirective(uid);
    if (directiveWeight) return directiveWeight;

    const substringWeight = this.matchSubstring(uid);
    if (substringWeight) return substringWeight;

    return { value: this.weightConfig.default, source: 'default' };
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

  matchOverride(uid) {
    const overrides = this.weightConfig.overrides;
    if (!overrides || typeof overrides !== 'object') {
      return null;
    }

    const direct = overrides[uid];
    if (typeof direct === 'number') {
      return { value: direct, source: `override ${uid}` };
    }

    if (uid.startsWith('col:')) {
      const table = `tbl:${uid.split(':')[1].split('.')[0]}`;
      if (typeof overrides[table] === 'number') {
        return { value: overrides[table], source: `override ${table}` };
      }
    }

    for (const [pattern, weight] of Object.entries(overrides)) {
      if (pattern.endsWith('.*')) {
        const base = pattern.slice(0, -2);
        if (uid.startsWith(base)) {
          return { value: weight, source: `override ${pattern}` };
        }
      }
    }

    return null;
  }

  matchDirective(uid) {
    const directives = this.weightConfig.directives;
    if (!directives || typeof directives !== 'object') {
      return null;
    }

    const names = this.schemaDirectives[uid];
    if (!names || !names.length) {
      return null;
    }

    for (const name of names) {
      if (typeof directives[name] === 'number') {
        return { value: directives[name], source: `directive @${name}` };
      }
    }

    return null;
  }

  matchSubstring(uid) {
    const substrings = this.weightConfig.substrings || {};
    const lowered = uid.toLowerCase();
    const entries = Object.entries(substrings).sort((a, b) => b[0].length - a[0].length);
    for (const [needle, weight] of entries) {
      if (lowered.includes(needle)) {
        return { value: weight, source: `substring ${needle}` };
      }
    }
    return null;
  }

  buildDirectiveIndex(schema) {
    const index = {};
    if (!schema || typeof schema !== 'object' || !schema.tables) {
      return index;
    }

    for (const [tableName, table] of Object.entries(schema.tables || {})) {
      const tableKey = `tbl:${tableName}`;
      index[tableKey] = extractDirectiveNames(table?.directives);

      for (const [fieldName, field] of Object.entries(table?.fields || {})) {
        const fieldKey = `col:${tableName}.${fieldName}`;
        index[fieldKey] = extractDirectiveNames(field?.directives);
      }
    }

    return index;
  }

  formatWeightConfigSource(source) {
    if (!source || source === 'defaults') {
      return 'defaults';
    }
    if (source.startsWith('env:')) {
      return source.replace('env:', 'env ');
    }
    if (source.startsWith('file:')) {
      const absolute = source.slice(5);
      const rel = relative(process.cwd(), absolute);
      return `file ${rel}`;
    }
    return source;
  }
}

function extractDirectiveNames(directives) {
  if (!directives || typeof directives !== 'object') return [];
  return Object.keys(directives).map((name) => (name.startsWith('@') ? name.slice(1) : name).toLowerCase());
}
