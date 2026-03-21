export const GENERATED_ARTIFACT_DIR = '.wesley-cache';
export const LEGACY_GENERATED_ARTIFACT_DIR = '.wesley';

export const GENERATED_BUNDLE_PATH = `${GENERATED_ARTIFACT_DIR}/bundle.json`;
export const GENERATED_HISTORY_PATH = `${GENERATED_ARTIFACT_DIR}/history.json`;
export const GENERATED_SCORES_PATH = `${GENERATED_ARTIFACT_DIR}/scores.json`;
export const GENERATED_SNAPSHOT_PATH = `${GENERATED_ARTIFACT_DIR}/snapshot.json`;
export const GENERATED_REALM_PATH = `${GENERATED_ARTIFACT_DIR}/realm.json`;
export const GENERATED_SHIPME_PATH = `${GENERATED_ARTIFACT_DIR}/SHIPME.md`;
export const GENERATED_COUNTERFACTUAL_DIR = `${GENERATED_ARTIFACT_DIR}/counterfactual`;
export const GENERATED_COUNTERFACTUAL_CURRENT_PATH = `${GENERATED_COUNTERFACTUAL_DIR}/current.json`;
export const GENERATED_LEDGER_DIR = `${GENERATED_ARTIFACT_DIR}/ledger`;
export const GENERATED_CHECKPOINTS_DIR = `${GENERATED_ARTIFACT_DIR}/checkpoints`;

export function legacyGeneratedArtifactPath(currentPath) {
  if (typeof currentPath !== 'string') return currentPath;
  if (!currentPath.startsWith(`${GENERATED_ARTIFACT_DIR}/`)) return currentPath;
  return `${LEGACY_GENERATED_ARTIFACT_DIR}/${currentPath.slice(GENERATED_ARTIFACT_DIR.length + 1)}`;
}

export function generatedArtifactPathCandidates(currentPath) {
  const candidates = [currentPath];
  const legacyPath = legacyGeneratedArtifactPath(currentPath);
  if (legacyPath && legacyPath !== currentPath) {
    candidates.push(legacyPath);
  }
  return candidates;
}
