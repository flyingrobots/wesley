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

export function assessEvidenceTrust(summary) {
  const total = totalEvidenceCitations(summary);
  if (total === 0) {
    return {
      level: 'missing',
      reasons: ['No evidence citations were available for trust analysis.']
    };
  }

  const reasons = [];
  if (Number(summary.coarse || 0) > 0) {
    reasons.push(
      `${summary.coarse} coarse citation${plural(summary.coarse)} ${verb(summary.coarse, 'remains', 'remain')} unpinned to exact line spans.`
    );
  }
  if (Number(summary.wholeFile || 0) > 0) {
    reasons.push(
      `${summary.wholeFile} whole-file citation${plural(summary.wholeFile)} ${verb(summary.wholeFile, 'still relies', 'still rely')} on broad file-level proof.`
    );
  }
  if (reasons.length === 0 && Number(summary.exact || 0) > 0) {
    reasons.push(
      `All ${summary.exact} citation${plural(summary.exact)} resolve to exact line spans.`
    );
  }

  return {
    level: determineEvidenceTrustLevel(summary),
    reasons
  };
}

export function evidenceTrustMeetsThreshold(level, threshold = 'moderate') {
  const levelRank = evidenceTrustRank(level);
  const thresholdRank = evidenceTrustRank(threshold);
  if (levelRank === null || thresholdRank === null) return false;
  return levelRank >= thresholdRank;
}

export function confidencePenaltyForEvidenceTrust(level) {
  switch (level) {
    case 'weak':
      return 12;
    case 'missing':
      return 20;
    default:
      return 0;
  }
}

export function totalEvidenceCitations(summary) {
  if (!summary) return 0;
  return Number(summary.exact || 0) + Number(summary.wholeFile || 0) + Number(summary.coarse || 0);
}

export function parseLineSpan(lines) {
  if (Array.isArray(lines) && lines.length >= 2) {
    const start = Number(lines[0]);
    const end = Number(lines[1]);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
      return { start, end };
    }
    return null;
  }

  const value = String(lines ?? '').trim();
  const match = /^(\d+)-(\d+)$/.exec(value);
  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return null;
  }
  return { start, end };
}

export function isExactLineSpan(lines) {
  return parseLineSpan(lines) !== null;
}

export function isWholeFileLineSpan(content, lines) {
  const range = parseLineSpan(lines);
  if (!range) return false;

  const fullRange = parseLineSpan(lineSpanForContent(content));
  return fullRange !== null && range.start === fullRange.start && range.end === fullRange.end;
}

export function extractContentForLineSpan(content, lines) {
  const range = parseLineSpan(lines);
  if (!range) return null;

  const visibleLines = toVisibleLines(content);
  if (range.end > visibleLines.length) return null;
  return visibleLines.slice(range.start - 1, range.end).join('\n');
}

function lineSpanForContent(content) {
  const normalized = normalizeContent(content);
  const lineCount = countContentLines(normalized);
  return `1-${lineCount}`;
}

function lineSpanWidth(lines) {
  const range = parseLineSpan(lines);
  if (!range) return null;
  return range.end - range.start + 1;
}

function countContentLines(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return 1;

  const segmentCount = normalized.split('\n').length;
  const trailingTerminator = normalized.endsWith('\n') ? 1 : 0;
  return Math.max(1, segmentCount - trailingTerminator);
}

function normalizeContent(content) {
  return String(content ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function toVisibleLines(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return [''];
  const lines = normalized.split('\n');
  return normalized.endsWith('\n') ? lines.slice(0, -1) : lines;
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

function determineEvidenceTrustLevel(summary) {
  if (totalEvidenceCitations(summary) === 0) return 'missing';
  if (Number(summary.coarse || 0) > 0) return 'weak';
  if (Number(summary.wholeFile || 0) > 0) return 'moderate';
  return 'strong';
}

function evidenceTrustRank(level) {
  switch (level) {
    case 'strong':
      return 3;
    case 'moderate':
      return 2;
    case 'weak':
      return 1;
    case 'missing':
      return 0;
    default:
      return null;
  }
}

function plural(value) {
  return Number(value) === 1 ? '' : 's';
}

function verb(value, singular, pluralForm) {
  return Number(value) === 1 ? singular : pluralForm;
}
