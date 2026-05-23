import {
  adjustReadinessVerdictForEvidenceTrust,
  assessEvidenceTrust,
  summarizeEvidenceQuality
} from './EvidenceQuality.mjs';

export function createGeneratedArtifactResolver(artifacts = [], outDir = 'out') {
  const normalizedOutDir = normalizePath(outDir || 'out').replace(/\/+$/, '');
  const contentByFile = new Map();

  for (const artifact of artifacts || []) {
    if (typeof artifact?.name !== 'string' || artifact.name.length === 0) continue;
    if (typeof artifact?.content !== 'string') continue;
    contentByFile.set(artifact.name, artifact.content);
    if (normalizedOutDir) {
      contentByFile.set(`${normalizedOutDir}/${artifact.name}`, artifact.content);
    }
    contentByFile.set(`out/${artifact.name}`, artifact.content);
  }

  return (file) => contentByFile.get(file) ?? null;
}

export function enrichBundleWithEvidenceTruth({
  bundle,
  scores,
  artifacts = [],
  outDir = 'out',
  resolver = null
} = {}) {
  const nextBundle = structuredClone(bundle || {});
  const nextScores = structuredClone(scores || nextBundle.scores || {});
  const resolveArtifact =
    typeof resolver === 'function' ? resolver : createGeneratedArtifactResolver(artifacts, outDir);

  const citationQuality = summarizeEvidenceQuality(nextBundle.evidence, resolveArtifact);
  const evidenceTrust = assessEvidenceTrust(citationQuality);
  const baseVerdict =
    nextScores.readiness?.baseVerdict || nextScores.readiness?.verdict || 'UNKNOWN';
  const verdict = adjustReadinessVerdictForEvidenceTrust(baseVerdict, evidenceTrust.level);

  nextScores.readiness = {
    ...(nextScores.readiness || {}),
    verdict,
    baseVerdict,
    ready: verdict === 'ELEMENTARY',
    evidenceTrust: evidenceTrust.level,
    evidenceTrustReasons: evidenceTrust.reasons
  };
  nextScores.metadata = {
    ...(nextScores.metadata || {}),
    citationQuality,
    evidenceTrust: evidenceTrust.level,
    evidenceTrustReasons: evidenceTrust.reasons
  };

  nextBundle.scores = nextScores;

  return {
    bundle: nextBundle,
    scores: nextScores,
    citationQuality,
    evidenceTrust
  };
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/');
}
