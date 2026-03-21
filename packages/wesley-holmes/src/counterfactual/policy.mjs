import { readFile } from 'node:fs/promises';
import path from 'node:path';

export { HOLMES_POLICY_LOCAL_PATH, HOLMES_POLICY_PATH } from '../config-paths.mjs';
import { HOLMES_POLICY_LOCAL_PATH, HOLMES_POLICY_PATH } from '../config-paths.mjs';

export function defaultCounterfactualPolicy() {
  return {
    version: 2,
    counterfactual: {
      enabled: false,
      provider: 'git-warp',
      baseRef: 'main',
      headRef: 'HEAD',
      braidRefs: [],
      scope: null,
      gateMode: 'off',
      penalties: {
        divergence: 10,
        destructiveTransfer: 30,
        providerUnavailable: 50
      }
    }
  };
}

export async function loadHolmesCounterfactualPolicy({ repoRoot, env = process.env } = {}) {
  const defaults = defaultCounterfactualPolicy();
  if (!repoRoot) return defaults;

  const policyFile = env.MORIARTY_POLICY_FILE
    ? path.resolve(repoRoot, env.MORIARTY_POLICY_FILE)
    : path.join(repoRoot, HOLMES_POLICY_PATH);
  const localPolicyFile = path.join(repoRoot, HOLMES_POLICY_LOCAL_PATH);

  const base = mergePolicies(
    defaults,
    normalizePolicy(await readJson(policyFile))
  );

  return mergePolicies(
    base,
    normalizePolicy(await readJson(localPolicyFile))
  );
}

export function resolveCounterfactualLaneRequest({
  policy,
  baseRef,
  headRef = 'HEAD',
  braidRefs = [],
  composition
} = {}) {
  const cfg = policy?.counterfactual || {};
  const resolvedBraidRefs = braidRefs.length > 0
    ? braidRefs
    : asStringArray(cfg.braidRefs);

  return {
    baseRef: String(baseRef || cfg.baseRef || 'main'),
    headRef: String(headRef || cfg.headRef || 'HEAD'),
    braidRefs: resolvedBraidRefs,
    scope: cfg.scope || null,
    composition: composition || (resolvedBraidRefs.length > 0 ? 'braid' : 'merge')
  };
}

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object') return null;
  if (policy.version === 2) {
    return {
      version: 2,
      counterfactual: {
        enabled: Boolean(policy?.counterfactual?.enabled),
        provider: policy?.counterfactual?.provider || 'git-warp',
        baseRef: policy?.counterfactual?.baseRef || 'main',
        headRef: policy?.counterfactual?.headRef || 'HEAD',
        braidRefs: asStringArray(policy?.counterfactual?.braidRefs),
        scope: policy?.counterfactual?.scope || null,
        gateMode: normalizeGateMode(policy?.counterfactual?.gateMode),
        penalties: {
          divergence: normalizeNumber(policy?.counterfactual?.penalties?.divergence, 10),
          destructiveTransfer: normalizeNumber(policy?.counterfactual?.penalties?.destructiveTransfer, 30),
          providerUnavailable: normalizeNumber(policy?.counterfactual?.penalties?.providerUnavailable, 50)
        }
      }
    };
  }

  if (policy.version === 1) {
    const defaults = policy?.defaults || {};
    const legacyMode = String(defaults.mode || 'off');
    const readinessImpact = defaults.readinessImpact || {};
    return {
      version: 2,
      counterfactual: {
        enabled: legacyMode !== 'off',
        provider: 'git-warp',
        baseRef: defaults.assumeDefaultBranch || 'main',
        headRef: 'HEAD',
        braidRefs: [],
        scope: null,
        gateMode: readinessImpact.gateFail ? 'hard' : 'audit',
        penalties: {
          divergence: normalizeNumber(defaults?.penalties?.projectionConflicts, 30),
          destructiveTransfer: normalizeNumber(defaults?.penalties?.projectionConflicts, 30),
          providerUnavailable: normalizeNumber(defaults?.penalties?.projectionError, 50)
        }
      }
    };
  }

  return null;
}

function mergePolicies(base, override) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    counterfactual: {
      ...base.counterfactual,
      ...override.counterfactual,
      penalties: {
        ...base.counterfactual?.penalties,
        ...override.counterfactual?.penalties
      }
    }
  };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeGateMode(value) {
  if (value === 'hard' || value === 'audit' || value === 'off') return value;
  return 'off';
}

function normalizeNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}
