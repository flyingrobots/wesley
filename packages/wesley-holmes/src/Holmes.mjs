/**
 * SHA-lock HOLMES - The Consulting Detective
 * Investigates Wesley's evidence bundle
 */

import { existsSync, readFileSync } from 'node:fs';
import { assessEvidenceTrust } from './support/evidence-quality.mjs';
import {
  pickBestEvidenceLocation,
  summarizeEvidenceKinds,
  summarizeEvidenceQuality
} from './evidence-selection.mjs';

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
    this.schemaDirectives = {};
  }

  /**
   * Conduct investigation and return report
   */
  investigate() {
    return this.renderInvestigation(this.investigationData());
  }

  investigationData() {
    const scores = this.extractScores();
    const citationQuality = summarizeEvidenceQuality(this.evidence);
    const evidenceTrust = assessEvidenceTrust(citationQuality);
    const readinessStatus = this.scores?.readiness?.verdict ?? 'UNKNOWN';
    const summary = {
      generatedAt: this.bundle.timestamp,
      sha: this.sha,
      weightedCompletion: scores.scs,
      verificationCount: this.countVerifications(),
      readinessStatus,
      verificationStatus: readinessStatus,
      tci: scores.tci,
      mri: scores.mri,
      bundleVersion: this.bundle.bundleVersion || this.scores?.version || '1.0.0',
      citationQuality,
      evidenceTrust: evidenceTrust.level
    };

    const elements = [];
    for (const [uid, evidence] of Object.entries(this.evidence.evidence || {})) {
      const w = this.inferWeight(uid);
      const weight = typeof w === 'object' ? w.value : w;
      const weightSource = typeof w === 'object' ? w.source : undefined;
      const status = this.getStatus(evidence);
      const citation = this.getCitation(evidence);
      const evidenceStrength = this.getEvidenceStrength(evidence);
      const deduction = this.makeDeduction(uid, status);
      const row = { element: uid, weight, status, evidence: citation, evidenceStrength, deduction };
      if (weightSource) row.weightSource = weightSource;
      elements.push(row);
    }

    const gates = [];
    const mri = summary.mri;
    const tci = summary.tci;
    gates.push({
      gate: 'Migration Risk',
      status: mri < 0.4 ? '✅' : '⛔',
      evidence: `MRI: ${(mri * 100).toFixed(1)}%`,
      ruling: this.assessRisk(mri)
    });
    gates.push({
      gate: 'Test Coverage',
      status: tci > 0.7 ? '✅' : '⚠️',
      evidence: `TCI: ${(tci * 100).toFixed(1)}%`,
      ruling: this.assessTests(tci)
    });
    const sensitive = this.checkSensitiveFields();
    gates.push({
      gate: 'Sensitive Fields',
      status: sensitive.safe ? '✅' : '⛔',
      evidence: `${sensitive.count} fields`,
      ruling: sensitive.ruling
    });
    gates.push({
      gate: 'Evidence Quality',
      status:
        evidenceTrust.level === 'strong' ? '✅' : evidenceTrust.level === 'missing' ? '⛔' : '⚠️',
      evidence: `${citationQuality.exact} exact · ${citationQuality.wholeFile} whole-file · ${citationQuality.coarse} coarse`,
      ruling: evidenceTrust.reasons.join(' ')
    });

    const verdict = this.buildVerdict(readinessStatus, evidenceTrust);
    summary.verificationStatus = verdict.code;

    const rawBreakdown = this.scores?.breakdown || this.scores?.scores?.breakdown || {};
    const breakdown = normalizeBreakdown(rawBreakdown);
    return {
      metadata: summary,
      scores,
      breakdown,
      evidence: elements,
      gates,
      verdict
    };
  }

  /**
   * Build a simple index of directives by column UID: col:Table.field -> ['primarykey','unique','foreignkey']
   */
  buildDirectiveIndex(schema) {
    const index = {};
    try {
      const tables = schema?.tables || {};
      for (const [tableName, table] of Object.entries(tables)) {
        const fields = table?.fields || {};
        for (const [fieldName, field] of Object.entries(fields)) {
          const uid = `col:${tableName}.${fieldName}`;
          const dirs = Object.keys(field?.directives || {}).map((k) =>
            (k.startsWith('@') ? k.slice(1) : k).toLowerCase()
          );
          if (dirs.length) index[uid] = dirs;
        }
      }
    } catch {
      /* empty */
    }
    this.schemaDirectives = index;
    return index;
  }

  renderInvestigation(data) {
    const { metadata, evidence, gates, verdict, scores, breakdown } = data;
    const lines = [];
    lines.push('### 🕵️ SHA-lock HOLMES Investigation');
    lines.push('');
    lines.push(`- Generated: ${metadata.generatedAt}`);
    lines.push(`- Commit SHA: ${metadata.sha}`);
    lines.push(`- Bundle Version: ${metadata.bundleVersion}`);
    lines.push('');
    lines.push(`> ⚠️ Evidence valid only for commit \`${metadata.sha.substring(0, 7)}\``);
    lines.push('');

    lines.push('## 🔍 Executive Deduction');
    lines.push('');
    lines.push('"Watson, after careful examination of the evidence, I deduce..."');
    lines.push('');
    lines.push(
      `**Weighted Completion**: ${this.progressBar(metadata.weightedCompletion)} ${(metadata.weightedCompletion * 100).toFixed(1)}%`
    );
    lines.push(
      `**Scores**: SCS ${(scores.scs * 100).toFixed(1)}% · TCI ${(scores.tci * 100).toFixed(1)}% · MRI ${(scores.mri * 100).toFixed(1)}%`
    );
    lines.push(`**Verification Status**: ${metadata.verificationCount} claims verified`);
    if (metadata.citationQuality) {
      lines.push(
        `**Citation Quality**: ${metadata.citationQuality.exact} exact · ${metadata.citationQuality.wholeFile} whole-file · ${metadata.citationQuality.coarse} coarse`
      );
    }
    if (metadata.evidenceTrust) {
      lines.push(`**Evidence Trust**: ${metadata.evidenceTrust}`);
    }
    if (metadata.readinessStatus && metadata.readinessStatus !== metadata.verificationStatus) {
      lines.push(`**Base Readiness**: ${metadata.readinessStatus}`);
    }
    lines.push(`**Ship Verdict**: ${metadata.verificationStatus}`);
    lines.push('');

    if (breakdown?.scs) {
      lines.push('## 🧩 SCS Breakdown');
      lines.push('');
      lines.push('| Component | Score | Coverage |');
      lines.push('|-----------|-------|----------|');
      for (const [label, detail] of Object.entries(breakdown.scs)) {
        const score = detail.score === null ? 'N/A' : `${(detail.score * 100).toFixed(1)}%`;
        const coverage = detail.totalWeight
          ? `${detail.earnedWeight.toFixed(2)}/${detail.totalWeight.toFixed(2)}`
          : '—';
        lines.push(`| ${this.formatLabel(label)} | ${score} | ${coverage} |`);
      }
      lines.push('');
    }

    if (breakdown?.tci) {
      lines.push('## 🧪 TCI Breakdown');
      lines.push('');
      lines.push('| Component | Score | Coverage | Note |');
      lines.push('|-----------|-------|----------|------|');
      for (const [label, detail] of Object.entries(breakdown.tci)) {
        if (label === 'legacy_components') continue;
        const score = detail.score === null ? 'N/A' : `${(detail.score * 100).toFixed(1)}%`;
        const coverage = detail.total ? `${detail.covered}/${detail.total}` : '—';
        const note = detail.note || '';
        lines.push(`| ${this.formatLabel(label)} | ${score} | ${coverage} | ${note} |`);
      }
      lines.push('');
    }

    if (breakdown?.mri) {
      lines.push('## ⚠️ MRI Breakdown');
      lines.push('');
      lines.push('| Component | Risk Share | Points | Count |');
      lines.push('|-----------|------------|--------|-------|');
      const totalPoints = breakdown.mri.totalPoints || 0;
      for (const [label, detail] of Object.entries(breakdown.mri)) {
        if (label === 'totalPoints') continue;
        const share =
          totalPoints > 0 ? `${((detail.points / totalPoints) * 100).toFixed(1)}%` : '0%';
        lines.push(
          `| ${this.formatLabel(label)} | ${share} | ${detail.points} | ${detail.count} |`
        );
      }
      lines.push('');
    }

    lines.push('## 📊 The Weight of Evidence');
    lines.push('');
    lines.push('"Observe, Watson, how not all features carry equal importance..."');
    lines.push('');
    lines.push('| Element | Weight | Status | Evidence | Strength | Deduction |');
    lines.push('|---------|--------|--------|----------|----------|-----------|');
    for (const row of evidence) {
      lines.push(
        `| ${row.element} | ${row.weight} | ${row.status} | ${row.evidence} | ${row.evidenceStrength} | ${row.deduction} |`
      );
    }
    lines.push('');

    lines.push('## 🚪 Security & Performance Gates');
    lines.push('');
    lines.push('"Elementary security measures, Watson..."');
    lines.push('');
    lines.push("| Gate | Status | Evidence | Holmes's Ruling |");
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

  buildVerdict(code, evidenceTrust = { level: 'strong', reasons: [] }) {
    if (
      code === 'ELEMENTARY' &&
      (evidenceTrust.level === 'weak' || evidenceTrust.level === 'missing')
    ) {
      const reason =
        evidenceTrust.reasons[0] || 'Citation quality is too coarse to call this conclusive.';
      return {
        code: 'REQUIRES INVESTIGATION',
        message: `Further investigation required before shipping. ${reason}`,
        markdown: `⚠️ **REQUIRES FURTHER INVESTIGATION**\n"Some clues remain too coarse to trust blindly. ${reason}"`
      };
    }
    switch (code) {
      case 'ELEMENTARY': {
        const message = 'Ship immediately! The evidence is conclusive.';
        return {
          code,
          message,
          markdown:
            '✅ **ELEMENTARY** - Ship immediately!\n"The evidence is conclusive. No mysteries remain."'
        };
      }
      case 'REQUIRES INVESTIGATION': {
        const message = 'Further investigation required before shipping.';
        return {
          code,
          message,
          markdown:
            '⚠️ **REQUIRES FURTHER INVESTIGATION**\n"Some clues remain unclear. Address the noted issues."'
        };
      }
      case 'YOU SHALL NOT PASS':
      default: {
        const message = 'Do not ship. Critical evidence is missing.';
        return {
          code: 'YOU SHALL NOT PASS',
          message,
          markdown:
            '⛔ **YOU SHALL NOT PASS**\n"Critical evidence is missing! Return to your laboratory!"'
        };
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
    const cfg = this.weightConfig ||
      this.weights || {
        default: DEFAULT_WEIGHTS.default,
        substrings: {},
        directives: {},
        overrides: {}
      };
    // 1) Explicit overrides (table/column patterns)
    for (const [pattern, weight] of Object.entries(cfg.overrides || {})) {
      // Support simple wildcard: tbl:Table.* covering all columns
      if (pattern.startsWith('tbl:') && pattern.endsWith('.*')) {
        const tbl = pattern.slice(4, -2);
        if (lowered.startsWith(`col:${tbl.toLowerCase()}.`)) {
          return { value: weight, source: `override ${pattern}` };
        }
      }
      if (lowered === pattern.toLowerCase()) {
        return { value: weight, source: `override ${pattern}` };
      }
    }

    // 2) Directive-based weights
    const dirs = this.schemaDirectives?.[uid] || [];
    for (const d of dirs) {
      const w = cfg.directives?.[d];
      if (typeof w === 'number') {
        return { value: w, source: `directive @${d}` };
      }
    }

    // 3) Substring heuristics
    for (const [needle, weight] of Object.entries(cfg.substrings || {})) {
      if (needle && lowered.includes(needle)) {
        return { value: weight, source: `substring ${needle}` };
      }
    }

    // 4) Default
    return { value: cfg.default ?? DEFAULT_WEIGHTS.default, source: 'default' };
  }

  getStatus(evidence) {
    const quality = summarizeEvidenceKinds(evidence);
    const hasSQL = hasAnyEvidence(quality.sql);
    const hasTests = hasAnyEvidence(quality.tests);
    const exactSQL = hasExactSubrange(quality.sql);
    const exactTests = hasExactSubrange(quality.tests);
    const structuredSQL = hasStructuredEvidence(quality.sql);
    const structuredTests = hasStructuredEvidence(quality.tests);

    if (exactSQL && exactTests) return '✅ Exact SQL & tests';
    if (structuredSQL && structuredTests) return '⚠️ Whole-file/mixed SQL & tests';
    if (hasSQL && hasTests) return '⚠️ Coarse/mixed SQL & tests';
    if (hasSQL) return structuredSQL ? '⚠️ Whole-file/mixed SQL only' : '⚠️ Coarse SQL only';
    if (hasTests)
      return structuredTests ? '⚠️ Whole-file/mixed tests only' : '⚠️ Coarse tests only';
    return '⛔ Missing';
  }

  getCitation(evidence) {
    const best = pickBestEvidenceLocation(evidence);
    if (!best) return 'No evidence';
    return `${best.location.file}:${best.location.lines}@${this.sha.substring(0, 7)}`;
  }

  getEvidenceStrength(evidence) {
    const best = pickBestEvidenceLocation(evidence);
    if (!best) return 'missing';
    switch (best.classification.strength) {
      case 'exact':
        return 'exact';
      case 'wholeFile':
        return 'whole-file';
      default:
        return 'coarse';
    }
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

  formatLabel(label) {
    return label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
      if (
        process.env.WESLEY_HOLMES_WEIGHT_FILE &&
        existsSync(process.env.WESLEY_HOLMES_WEIGHT_FILE)
      ) {
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

function hasAnyEvidence(summary) {
  return Boolean(summary) && summary.exact + summary.wholeFile + summary.coarse > 0;
}

function hasStructuredEvidence(summary) {
  return Boolean(summary) && summary.exact + summary.wholeFile > 0;
}

function hasExactSubrange(summary) {
  return Boolean(summary) && summary.exact > 0;
}

function normalizeBreakdown(b) {
  if (!b || typeof b !== 'object') return {};
  const out = { scs: {}, tci: {}, mri: {} };
  // SCS (fields already match: score, earnedWeight, totalWeight)
  if (b.scs) {
    out.scs.sql = b.scs.sql || { score: 0, earnedWeight: 0, totalWeight: 0 };
    out.scs.types = b.scs.types || { score: 0, earnedWeight: 0, totalWeight: 0 };
    out.scs.validation = b.scs.validation || { score: 0, earnedWeight: 0, totalWeight: 0 };
    out.scs.tests = b.scs.tests || { score: 0, earnedWeight: 0, totalWeight: 0 };
    // If legacy fields used different names, attempt to map total/covered → totalWeight/earnedWeight
    for (const k of Object.keys(out.scs)) {
      const comp = out.scs[k];
      if (comp.total !== undefined && comp.totalWeight === undefined) comp.totalWeight = comp.total;
      if (comp.covered !== undefined && comp.earnedWeight === undefined)
        comp.earnedWeight = comp.covered;
    }
  }
  // TCI (normalize legacy keys and fields)
  if (b.tci) {
    const map = {
      unit_constraints: b.tci.unit_constraints || b.tci.unitConstraints,
      unit_rls: b.tci.unit_rls || b.tci.rls,
      integration_relations: b.tci.integration_relations || b.tci.integrationRelations,
      e2e_ops: b.tci.e2e_ops ||
        b.tci.e2eOps || {
          score: null,
          covered: 0,
          total: 0,
          note: 'Query operation test tracking not yet implemented'
        }
    };
    for (const [key, val] of Object.entries(map)) {
      if (!val) {
        out.tci[key] = { score: null, covered: 0, total: 0 };
        continue;
      }
      out.tci[key] = {
        score: val.score ?? null,
        covered: val.covered ?? val.coveredWeight ?? 0,
        total: val.total ?? val.totalWeight ?? 0,
        note: val.note ?? 'N/A'
      };
    }
    if (b.tci.legacy_components) out.tci.legacy_components = b.tci.legacy_components;
  }
  // MRI (normalize legacy component names and ensure count/points present)
  if (b.mri) {
    const map = {
      drops: b.mri.drops,
      renames_without_uid: b.mri.renames_without_uid || b.mri.renames,
      add_not_null_without_default: b.mri.add_not_null_without_default || b.mri.defaults,
      non_concurrent_indexes: b.mri.non_concurrent_indexes || b.mri.indexes
    };
    for (const [key, val] of Object.entries(map)) {
      const comp = val || {};
      out.mri[key] = {
        score: comp.score ?? 0,
        points: comp.points ?? 0,
        count: comp.count ?? 0
      };
    }
    out.mri.totalPoints =
      b.mri.totalPoints ??
      Object.values(out.mri).reduce(
        (s, c) => s + (c && typeof c.points === 'number' ? c.points : 0),
        0
      );
  }
  return out;
}
