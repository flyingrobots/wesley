export function normalizeMoriartyHistoryPoints(historyPoints = []) {
  return historyPoints.slice(-7).map(point => {
    const normalizedTrust = normalizeMoriartyEvidenceTrustLevel(point.evidenceTrust);
    const normalizedReasons = normalizedTrust
      ? normalizeMoriartyEvidenceTrustReasons(point.evidenceTrustReasons, normalizedTrust)
      : [];
    return {
      timestamp: point.timestamp ?? formatMoriartyHistoryTimestamp(point.day),
      scs: point.scs ?? 0,
      tci: point.tci ?? 0,
      mri: point.mri ?? 0,
      ...(normalizedTrust ? { evidenceTrust: normalizedTrust } : {}),
      ...(normalizedReasons.length > 0 ? { evidenceTrustReasons: normalizedReasons } : {})
    };
  });
}

export function normalizeMoriartyEvidenceTrustLevel(level) {
  switch (level) {
  case 'strong':
  case 'moderate':
  case 'weak':
  case 'missing':
    return level;
  default:
    return null;
  }
}

export function normalizeMoriartyEvidenceTrustReasons(reasons, level) {
  if (Array.isArray(reasons) && reasons.length > 0) {
    return reasons.filter((reason) => typeof reason === 'string' && reason.length > 0);
  }

  switch (level) {
  case 'moderate':
    return ['Whole-file citations still rely on broad file-level proof.'];
  case 'weak':
    return ['Coarse citations remain unpinned to exact line spans.'];
  case 'missing':
    return ['No evidence citations were available for trust analysis.'];
  default:
    return ['All citations resolve to exact line spans.'];
  }
}

export function formatMoriartyHistoryTimestamp(day) {
  if (typeof day === 'number' && Number.isFinite(day)) {
    const millis = day * 24 * 60 * 60 * 1000;
    return new Date(millis).toISOString();
  }
  return new Date(0).toISOString();
}
