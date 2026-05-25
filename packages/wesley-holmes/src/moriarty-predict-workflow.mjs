import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GENERATED_ARTIFACT_DIR, generatedArtifactPathCandidates } from './support/artifacts.mjs';
import { Moriarty } from './Moriarty.mjs';
import { attachRuntimeRun, loadRuntimeRunRecord } from './runtime-run.mjs';
import {
  analyzeCounterfactual,
  loadHolmesCounterfactualPolicy,
  resolveCounterfactualLaneRequest
} from './index.mjs';
import { moriartyReportSchema, validateReport } from './report-schemas.mjs';

export function resolveMoriartyExecutionPaths({ bundleDir, historyFile } = {}) {
  const resolvedBundleDir = resolvePath(bundleDir, GENERATED_ARTIFACT_DIR);
  const repoRoot = path.resolve(resolvedBundleDir, '..');
  return {
    bundleDir: resolvedBundleDir,
    historyFile: resolvePath(historyFile, path.join(resolvedBundleDir, 'history.json')),
    contextFile: resolvePath(null, path.join(resolvedBundleDir, 'moriarty-context.json')),
    outDir: path.resolve(path.dirname(resolvedBundleDir), 'out'),
    schemaPath: path.resolve(path.dirname(resolvedBundleDir), 'schema.graphql'),
    repoRoot
  };
}

export function defaultMoriartyBaseRef(env = process.env) {
  return env.MORIARTY_BASE_REF || env.GITHUB_BASE_REF || 'main';
}

export async function buildMoriartyPrediction({
  bundleDir,
  historyFile,
  runId = null,
  transmutation = null,
  counterfactual,
  braidRefs = [],
  explain = false,
  env = process.env,
  moriartyOptions = {}
} = {}) {
  const paths = resolveMoriartyExecutionPaths({ bundleDir, historyFile });
  const history = loadMoriartyHistory(paths.historyFile);
  const context = loadMoriartyContext(paths.contextFile);
  const moriarty = new Moriarty(history, context, {
    env,
    ...moriartyOptions
  });
  const data = moriarty.predictionData();
  const runtime = await attachMoriartyRuntime(data, {
    repoRoot: paths.repoRoot,
    runId,
    transmutation
  });

  if (typeof counterfactual !== 'undefined') {
    const baseRef =
      typeof counterfactual === 'string' && counterfactual.length > 0
        ? counterfactual
        : defaultMoriartyBaseRef(env);
    await attachMoriartyCounterfactual(data, {
      ...paths,
      transmutation: runtime?.run?.transmutation || transmutation,
      baseRef,
      braidRefs,
      explain,
      env
    });
  }

  ensureValidReport('MORIARTY', moriartyReportSchema, data);
  return {
    data,
    output: moriarty.renderPrediction(data),
    runtime,
    paths
  };
}

export function loadMoriartyHistory(historyPath) {
  for (const candidate of generatedArtifactPathCandidates(historyPath)) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
  }
  return { points: [] };
}

export function loadMoriartyContext(contextPath) {
  for (const candidate of generatedArtifactPathCandidates(contextPath)) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
  }
  return {};
}

function resolvePath(target, fallback) {
  const chosen = target || fallback;
  return path.isAbsolute(chosen) ? chosen : path.resolve(chosen);
}

function ensureValidReport(label, schema, data) {
  const { valid, errors } = validateReport(schema, data);
  if (!valid) {
    const detail = errors.map((err) => ` - ${err}`).join('\n');
    throw new Error(`[${label}] report validation failed:\n${detail}`);
  }
}

async function attachMoriartyRuntime(data, { repoRoot, runId, transmutation }) {
  if (typeof runId !== 'string' || !runId.trim()) {
    return null;
  }

  const runtimeRecord = await loadRuntimeRunRecord({
    repoRoot,
    runId,
    transmutation
  });
  attachRuntimeRun(data, runtimeRecord);
  return runtimeRecord;
}

async function attachMoriartyCounterfactual(
  data,
  {
    repoRoot,
    bundleDir,
    outDir,
    schemaPath,
    transmutation,
    baseRef,
    braidRefs = [],
    explain = false,
    env = process.env
  }
) {
  const policy = await loadHolmesCounterfactualPolicy({ repoRoot, env });
  const lane = resolveCounterfactualLaneRequest({
    policy,
    baseRef,
    braidRefs
  });
  const counterfactual = await analyzeCounterfactual({
    repoRoot,
    lane,
    includeTransferPlan: true,
    policy,
    env,
    surface: {
      bundleDir,
      outDir,
      schemaPath,
      transmutation
    }
  });
  applyCounterfactualJudgmentToPrediction(data, explain ? counterfactual : { ...counterfactual });
}

export function applyCounterfactualJudgmentToPrediction(data, counterfactual) {
  data.counterfactual = counterfactual;
  data.warnings = Array.isArray(data.warnings) ? data.warnings : [];
  data.patterns = Array.isArray(data.patterns) ? data.patterns : [];
  data.explain = data.explain || {};
  data.explain.readiness = data.explain?.readiness || {};

  const judgment = counterfactual?.judgment || {};
  const gate =
    typeof judgment.gate === 'string' && judgment.gate.length > 0 ? judgment.gate : 'pass';
  const status =
    typeof judgment.status === 'string' && judgment.status.length > 0 ? judgment.status : 'unknown';
  const riskClass =
    typeof judgment.riskClass === 'string' && judgment.riskClass.length > 0
      ? judgment.riskClass
      : 'none';
  const reasons = Array.isArray(judgment.reasons)
    ? judgment.reasons.filter((reason) => typeof reason === 'string' && reason.length > 0)
    : [];

  if (typeof data.confidence === 'number' && Number.isFinite(judgment.confidenceAdjustment)) {
    data.confidence = Math.max(0, Math.min(100, data.confidence + judgment.confidenceAdjustment));
  }

  data.explain.readiness.counterfactual = {
    value: gate,
    pass: gate === 'pass',
    threshold: 'pass',
    status,
    riskClass,
    wouldFail: Boolean(judgment.wouldFail),
    reasons
  };

  if (gate !== 'pass') {
    pushUniqueString(
      data.warnings,
      `Counterfactual gate is ${gate}; the forecast is not ship-ready until the lane judgment is resolved.`
    );
  }

  if (status !== 'clean') {
    pushPattern(
      data.patterns,
      gate !== 'pass' || riskClass === 'high' ? 'COUNTERFACTUAL_RISK' : 'COUNTERFACTUAL_DIVERGENCE',
      reasons[0] || `Counterfactual status is ${status}.`
    );
  }
}

function pushPattern(patterns, type, description) {
  if (patterns.some((pattern) => pattern?.type === type)) {
    return;
  }
  patterns.push({ type, description });
}

function pushUniqueString(items, value) {
  if (!items.includes(value)) {
    items.push(value);
  }
}
