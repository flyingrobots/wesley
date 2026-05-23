import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  GENERATED_COUNTERFACTUAL_CURRENT_PATH,
  GENERATED_COUNTERFACTUAL_DIR,
  listModuleCapabilities
} from '@wesley/core';
import { discoverConfiguredWesleyModules } from '@wesley/runtime-node';

export const COUNTERFACTUAL_SURFACE_VERSION = 'wesley-counterfactual-v1';
export const COUNTERFACTUAL_DIR = GENERATED_COUNTERFACTUAL_DIR;
export const COUNTERFACTUAL_CURRENT_PATH = GENERATED_COUNTERFACTUAL_CURRENT_PATH;
export const COUNTERFACTUAL_PROVIDER_CAPABILITY_AREA = 'holmes';
export const COUNTERFACTUAL_PROVIDER_CAPABILITY_COLLECTION = 'counterfactualProviders';
export const COUNTERFACTUAL_PROVIDER_UNAVAILABLE_VERSION = 'module-capability-unavailable';

export async function analyzeCounterfactual({
  repoRoot,
  lane,
  includeTransferPlan = true,
  policy,
  surface = {},
  env = process.env,
  moduleCapabilityRegistry = null,
  logger
} = {}) {
  const workspaceRoot = path.resolve(repoRoot || process.cwd());
  const requestedLane = normalizeLaneRequest(lane);

  try {
    const registry =
      moduleCapabilityRegistry ??
      (await loadCounterfactualCapabilityRegistry({
        repoRoot: workspaceRoot,
        env,
        logger
      }));
    const providerEntry = selectCounterfactualProvider({
      registry,
      policy
    });
    const report = await providerEntry.value.analyze({
      repoRoot: workspaceRoot,
      lane: requestedLane,
      includeTransferPlan,
      policy,
      surface,
      env,
      provider: providerEntry.value,
      moduleName: providerEntry.moduleName
    });

    const normalized = normalizeProviderReport(report, {
      providerEntry,
      lane: requestedLane,
      policy,
      repoRoot: workspaceRoot
    });
    await writeCurrentCounterfactualReport(workspaceRoot, normalized);
    return normalized;
  } catch (error) {
    const fallback = buildCounterfactualProviderFailure({
      repoRoot: workspaceRoot,
      lane: requestedLane,
      error,
      policy
    });
    await writeCurrentCounterfactualReport(workspaceRoot, fallback);
    return fallback;
  }
}

function normalizeLaneRequest(lane) {
  const braidRefs = Array.isArray(lane?.braidRefs)
    ? lane.braidRefs.map(String).filter(Boolean)
    : [];
  return {
    baseRef: String(lane?.baseRef || 'main'),
    headRef: String(lane?.headRef || 'HEAD'),
    braidRefs,
    scope: lane?.scope || null,
    composition: lane?.composition || (braidRefs.length > 0 ? 'braid' : 'merge')
  };
}

async function loadCounterfactualCapabilityRegistry({ repoRoot, env, logger }) {
  const result = await discoverConfiguredWesleyModules({
    cwd: repoRoot,
    env,
    logger
  });
  return result.capabilityRegistry;
}

function selectCounterfactualProvider({ registry, policy }) {
  const providers = listModuleCapabilities(
    registry,
    COUNTERFACTUAL_PROVIDER_CAPABILITY_AREA,
    COUNTERFACTUAL_PROVIDER_CAPABILITY_COLLECTION
  ).map(validateCounterfactualProviderEntry);

  const requestedName = normalizeProviderName(policy?.counterfactual?.provider);
  if (requestedName) {
    const matched = providers.find(
      (entry) => normalizeProviderName(entry.value.name) === requestedName
    );
    if (!matched) {
      throw new Error(
        `Counterfactual provider "${policy.counterfactual.provider}" is not available. ` +
          'Load a Wesley module that registers holmes.counterfactualProviders.'
      );
    }
    return matched;
  }

  if (providers.length === 1) {
    return providers[0];
  }

  if (providers.length === 0) {
    throw new Error(
      'No counterfactual provider capabilities are available. ' +
        'Load a Wesley module that registers holmes.counterfactualProviders.'
    );
  }

  throw new Error(
    'Multiple counterfactual providers are available. ' +
      'Set counterfactual.provider in the Holmes policy.'
  );
}

function validateCounterfactualProviderEntry(entry) {
  const provider = entry?.value;
  if (provider == null || typeof provider !== 'object' || Array.isArray(provider)) {
    throw new Error(
      `Module "${entry?.moduleName || '<unknown>'}" registered an invalid counterfactual provider.`
    );
  }
  if (typeof provider.name !== 'string' || provider.name.trim().length === 0) {
    throw new Error(
      `Module "${entry.moduleName}" registered a counterfactual provider without a non-empty name.`
    );
  }
  if (typeof provider.analyze !== 'function') {
    throw new Error(
      `Counterfactual provider "${provider.name}" from module "${entry.moduleName}" must expose analyze().`
    );
  }
  return entry;
}

function normalizeProviderReport(report, { providerEntry, lane, policy, repoRoot }) {
  if (report == null || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error(
      `Counterfactual provider "${providerEntry.value.name}" returned a non-object report.`
    );
  }

  const providerName = providerEntry.value.name.trim();
  return {
    ...report,
    provider: providerName,
    providerModuleName: providerEntry.moduleName,
    providerPackageVersion: normalizeNonEmptyString(
      report.providerPackageVersion,
      providerEntry.value.providerPackageVersion || providerEntry.value.version || 'module'
    ),
    surfaceVersion: normalizeNonEmptyString(report.surfaceVersion, COUNTERFACTUAL_SURFACE_VERSION),
    laneFingerprint: normalizeNonEmptyString(
      report.laneFingerprint,
      hashObject({
        provider: providerName,
        moduleName: providerEntry.moduleName,
        repoRoot,
        lane,
        report
      })
    ),
    composition: normalizeNonEmptyString(report.composition, lane.composition),
    requested: normalizeRequested(report.requested, lane),
    resolved: normalizeResolved(report.resolved, lane),
    facts: normalizeFacts(report.facts, lane),
    judgment: normalizeJudgment(report.judgment, policy)
  };
}

function normalizeRequested(requested, lane) {
  return {
    baseRef: String(requested?.baseRef || lane.baseRef),
    headRef: String(requested?.headRef || lane.headRef),
    braidRefs: Array.isArray(requested?.braidRefs)
      ? requested.braidRefs.map(String).filter(Boolean)
      : lane.braidRefs
  };
}

function normalizeResolved(resolved, lane) {
  return {
    baseRef: String(resolved?.baseRef || lane.baseRef),
    baseSha: typeof resolved?.baseSha === 'string' ? resolved.baseSha : null,
    headRef: String(resolved?.headRef || lane.headRef),
    headSha: typeof resolved?.headSha === 'string' ? resolved.headSha : null,
    braidRefs: Array.isArray(resolved?.braidRefs)
      ? resolved.braidRefs
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            ref: String(item.ref || ''),
            sha: String(item.sha || '')
          }))
          .filter((item) => item.ref && item.sha)
      : [],
    liveWorkspace:
      typeof resolved?.liveWorkspace === 'boolean'
        ? resolved.liveWorkspace
        : lane.headRef === 'HEAD'
  };
}

function normalizeFacts(facts, lane) {
  return {
    comparison: facts?.comparison || null,
    transferPlan: facts?.transferPlan || null,
    normalizedScope: facts?.normalizedScope || lane.scope || null
  };
}

function normalizeJudgment(judgment, policy) {
  const gateMode = policy?.counterfactual?.gateMode || 'off';
  const status = normalizeNonEmptyString(judgment?.status, 'unsupported');
  const signals = Array.isArray(judgment?.signals)
    ? judgment.signals.map(String).filter(Boolean)
    : ['provider_unavailable'];
  const riskClass = normalizeNonEmptyString(
    judgment?.riskClass,
    status === 'clean' ? 'none' : 'high'
  );
  const confidenceAdjustment = Number.isFinite(judgment?.confidenceAdjustment)
    ? judgment.confidenceAdjustment
    : 0;
  const wouldFail =
    typeof judgment?.wouldFail === 'boolean' ? judgment.wouldFail : riskClass === 'high';
  const gate = normalizeNonEmptyString(
    judgment?.gate,
    gateMode === 'hard' && wouldFail ? 'fail' : gateMode === 'audit' && wouldFail ? 'audit' : 'pass'
  );
  const reasons = Array.isArray(judgment?.reasons)
    ? judgment.reasons.map(String).filter(Boolean)
    : ['Counterfactual provider did not return judgment reasons.'];

  return {
    status,
    signals,
    riskClass,
    confidenceAdjustment,
    gate,
    wouldFail,
    reasons
  };
}

export function buildCounterfactualProviderFailure({ repoRoot, lane, error, policy }) {
  const providerName =
    typeof policy?.counterfactual?.provider === 'string' && policy.counterfactual.provider.trim()
      ? policy.counterfactual.provider.trim()
      : 'none';
  const penalties = policy?.counterfactual?.penalties || {};
  const gateMode = policy?.counterfactual?.gateMode || 'off';
  const reasons = [error?.message || 'Counterfactual provider is unavailable.'];
  const confidenceAdjustment = -Math.abs(Number(penalties.providerUnavailable || 50));
  const signals = ['provider_unavailable', ...(lane.braidRefs.length > 0 ? ['braid_present'] : [])];

  return {
    provider: providerName,
    providerPackageVersion: COUNTERFACTUAL_PROVIDER_UNAVAILABLE_VERSION,
    surfaceVersion: COUNTERFACTUAL_SURFACE_VERSION,
    laneFingerprint: hashObject({ repoRoot, lane, provider: providerName, failure: reasons[0] }),
    composition: lane.composition,
    requested: {
      baseRef: lane.baseRef,
      headRef: lane.headRef,
      braidRefs: lane.braidRefs
    },
    resolved: {
      baseRef: lane.baseRef,
      baseSha: null,
      headRef: lane.headRef,
      headSha: null,
      braidRefs: [],
      liveWorkspace: lane.headRef === 'HEAD'
    },
    facts: {
      comparison: null,
      transferPlan: null,
      normalizedScope: lane.scope || null
    },
    judgment: {
      status: 'unsupported',
      signals,
      riskClass: 'high',
      confidenceAdjustment,
      gate: gateMode === 'hard' ? 'fail' : gateMode === 'audit' ? 'audit' : 'pass',
      wouldFail: true,
      reasons
    }
  };
}

async function writeCurrentCounterfactualReport(repoRoot, report) {
  const currentPath = path.join(repoRoot, COUNTERFACTUAL_CURRENT_PATH);
  await mkdir(path.dirname(currentPath), { recursive: true });
  await writeFile(currentPath, JSON.stringify(report, null, 2));
}

function normalizeProviderName(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : '';
}

function normalizeNonEmptyString(value, fallback) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function hashObject(value) {
  return createHash('sha256')
    .update(JSON.stringify(sortValue(value)))
    .digest('hex');
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  );
}
