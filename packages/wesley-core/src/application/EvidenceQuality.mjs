import {
  isExactLineSpan,
  isWholeFileLineSpan,
  lineSpanWidth
} from './EvidenceSpans.mjs';

export function createEvidenceQualitySummary() {
  return {
    exact: 0,
    wholeFile: 0,
    coarse: 0
  };
}

export function summarizeEvidenceQuality(payload, resolver = () => null) {
  const summary = createEvidenceQualitySummary();

  for (const evidence of Object.values(payload?.evidence || {})) {
    for (const locations of Object.values(evidence || {})) {
      for (const location of locations || []) {
        const classification = classifyEvidenceLocation(location, resolver);
        summary[classification.strength] += 1;
      }
    }
  }

  return summary;
}

export function summarizeEvidenceKinds(evidence, resolver = () => null) {
  const summary = {};
  for (const [kind, locations] of Object.entries(evidence || {})) {
    summary[kind] = createEvidenceQualitySummary();
    for (const location of locations || []) {
      const classification = classifyEvidenceLocation(location, resolver);
      summary[kind][classification.strength] += 1;
    }
  }
  return summary;
}

export function pickBestEvidenceLocation(evidence, resolver = () => null) {
  let best = null;
  for (const [kind, locations] of Object.entries(evidence || {})) {
    for (const location of locations || []) {
      if (!location?.file) continue;
      const classification = classifyEvidenceLocation(location, resolver);
      const candidate = { kind, location, classification };
      if (!best || compareEvidenceCandidates(candidate, best) < 0) {
        best = candidate;
      }
    }
  }
  return best;
}

export function classifyEvidenceLocation(location, resolver = () => null) {
  const lines = location?.lines;
  if (!isExactLineSpan(lines)) {
    return {
      strength: 'coarse',
      exact: false,
      wholeFile: false,
      width: Number.POSITIVE_INFINITY
    };
  }

  const content = resolver(location?.file);
  const wholeFile = typeof content === 'string' && isWholeFileLineSpan(content, lines);
  return {
    strength: wholeFile ? 'wholeFile' : 'exact',
    exact: true,
    wholeFile,
    width: lineSpanWidth(lines) ?? Number.POSITIVE_INFINITY
  };
}

export function listEvidenceFiles(payload) {
  const files = new Set();

  for (const evidence of Object.values(payload?.evidence || {})) {
    for (const locations of Object.values(evidence || {})) {
      for (const location of locations || []) {
        if (typeof location?.file === 'string' && location.file.length > 0) {
          files.add(location.file);
        }
      }
    }
  }

  return [...files].sort();
}

export function totalEvidenceCitations(summary) {
  if (!summary) return 0;
  return Number(summary.exact || 0) + Number(summary.wholeFile || 0) + Number(summary.coarse || 0);
}

export function strongestEvidenceStrength(summary) {
  if (!summary) return 'missing';
  if (Number(summary.exact || 0) > 0) return 'exact';
  if (Number(summary.wholeFile || 0) > 0) return 'whole-file';
  if (Number(summary.coarse || 0) > 0) return 'coarse';
  return 'missing';
}

function compareEvidenceCandidates(left, right) {
  const leftRank = strengthRank(left.classification.strength);
  const rightRank = strengthRank(right.classification.strength);
  if (leftRank !== rightRank) return leftRank - rightRank;

  if (left.classification.width !== right.classification.width) {
    return left.classification.width - right.classification.width;
  }

  if (left.kind !== right.kind) {
    return String(left.kind).localeCompare(String(right.kind));
  }

  return String(left.location.file).localeCompare(String(right.location.file));
}

function strengthRank(strength) {
  switch (strength) {
  case 'exact':
    return 0;
  case 'wholeFile':
    return 1;
  default:
    return 2;
  }
}
