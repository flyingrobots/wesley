import { WesleyError } from '@wesley/core';
import {
  analyzeCounterfactual,
  COUNTERFACTUAL_CURRENT_PATH,
  loadHolmesCounterfactualPolicy,
  resolveCounterfactualLaneRequest
} from '@wesley/holmes';

export { COUNTERFACTUAL_CURRENT_PATH };

export async function maybeAnalyzeCounterfactual({
  options = {},
  schemaPath,
  outDir,
  transmutation
} = {}) {
  const repoRoot = process.cwd();
  const policy = await loadHolmesCounterfactualPolicy({ repoRoot, env: process.env });
  const enabled = typeof options.counterfactual !== 'undefined' || Boolean(policy?.counterfactual?.enabled);
  if (!enabled) return null;

  const baseRef = typeof options.counterfactual === 'string' && options.counterfactual.length > 0
    ? options.counterfactual
    : (policy?.counterfactual?.baseRef || process.env.MORIARTY_BASE_REF || process.env.GITHUB_BASE_REF || 'main');
  const lane = resolveCounterfactualLaneRequest({
    policy,
    baseRef,
    braidRefs: Array.isArray(options.counterfactualBraid) ? options.counterfactualBraid : []
  });

  return analyzeCounterfactual({
    repoRoot,
    lane,
    includeTransferPlan: true,
    policy,
    surface: {
      bundleDir: '.wesley',
      outDir,
      schemaPath,
      transmutation
    }
  });
}

export async function readCurrentCounterfactualSummary(fs, path = COUNTERFACTUAL_CURRENT_PATH) {
  try {
    return JSON.parse(await fs.read(path));
  } catch {
    return null;
  }
}

export function buildShipmeCounterfactualSummary(summary) {
  if (!summary) return null;
  return {
    laneFingerprint: summary.laneFingerprint,
    composition: summary.composition,
    comparisonFactDigest: summary?.facts?.comparison?.factDigest || null,
    transferFactDigest: summary?.facts?.transferPlan?.factDigest || null,
    riskClass: summary?.judgment?.riskClass || 'none',
    gate: summary?.judgment?.gate || 'pass',
    wouldFail: Boolean(summary?.judgment?.wouldFail),
    reasons: Array.isArray(summary?.judgment?.reasons) ? summary.judgment.reasons : [],
    providerPackageVersion: summary.providerPackageVersion,
    surfaceVersion: summary.surfaceVersion,
    comparisonExportVersion: summary?.facts?.comparison?.exportVersion || null,
    transferExportVersion: summary?.facts?.transferPlan?.exportVersion || null
  };
}

export function assertCounterfactualGate(summary) {
  if (summary?.judgment?.gate !== 'fail') return;
  const reasons = Array.isArray(summary?.judgment?.reasons) ? summary.judgment.reasons.join(' ') : 'Counterfactual gate failed.';
  throw new WesleyError('COUNTERFACTUAL_GATE_FAILED', reasons);
}

