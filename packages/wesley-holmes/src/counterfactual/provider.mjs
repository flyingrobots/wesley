import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import GitPlumbing from '@git-stunts/plumbing';
import WarpGraph, {
  GitGraphAdapter,
  exportCoordinateComparisonFact,
  exportCoordinateTransferPlanFact,
  normalizeVisibleStateScopeV1
} from '@git-stunts/git-warp';
import { GENERATED_COUNTERFACTUAL_CURRENT_PATH, GENERATED_COUNTERFACTUAL_DIR } from '@wesley/core';
import { collectCounterfactualSurfaceModel } from '@wesley/runtime-node';

export const COUNTERFACTUAL_GRAPH_NAME = 'wesley-counterfactual-v1';
export const COUNTERFACTUAL_SURFACE_VERSION = 'wesley-counterfactual-v1';
export const COUNTERFACTUAL_DIR = GENERATED_COUNTERFACTUAL_DIR;
export const COUNTERFACTUAL_CURRENT_PATH = GENERATED_COUNTERFACTUAL_CURRENT_PATH;
export const GIT_WARP_PROVIDER_VERSION = '14.16.2';
export const COUNTERFACTUAL_STORE_LEASE_VERSION = 1;

const DEFAULT_COUNTERFACTUAL_CACHE_TTL_HOURS = 72;

export async function analyzeCounterfactual({
  repoRoot,
  lane,
  includeTransferPlan = true,
  policy,
  surface = {},
  env = process.env
} = {}) {
  const requestedLane = {
    baseRef: String(lane?.baseRef || 'main'),
    headRef: String(lane?.headRef || 'HEAD'),
    braidRefs: Array.isArray(lane?.braidRefs) ? lane.braidRefs.map(String).filter(Boolean) : [],
    scope: lane?.scope || null,
    composition: lane?.composition || ((lane?.braidRefs?.length || 0) > 0 ? 'braid' : 'merge')
  };

  const workspaceRoot = path.resolve(repoRoot || process.cwd());
  const artifactRoot = path.join(workspaceRoot, COUNTERFACTUAL_DIR);
  const currentPath = path.join(workspaceRoot, COUNTERFACTUAL_CURRENT_PATH);
  const storeRoot = path.join(artifactRoot, 'store');
  const cachePolicy = resolveCounterfactualCachePolicy(env);
  const now = new Date().toISOString();
  const scope = normalizeScope(requestedLane.scope);
  await pruneCounterfactualCache({
    artifactRoot,
    currentPath,
    storeRoot,
    now,
    cachePolicy
  });
  const store = await openProviderStore(storeRoot);
  const cleanupDirs = [];

  try {
    const resolved = resolveLaneRefs(workspaceRoot, requestedLane);
    const headWorkspace = requestedLane.headRef === 'HEAD'
      ? workspaceRoot
      : await materializeGitRef(workspaceRoot, resolved.headSha);
    if (headWorkspace !== workspaceRoot) cleanupDirs.push(headWorkspace);

    const braidWorkspaces = [];
    for (const braid of resolved.braids) {
      const materialized = await materializeGitRef(workspaceRoot, braid.sha);
      braidWorkspaces.push({ ...braid, workspace: materialized });
      cleanupDirs.push(materialized);
    }

    const baseWorkspace = resolved.baseSha === resolved.headSha && requestedLane.headRef !== 'HEAD'
      ? headWorkspace
      : await materializeGitRef(workspaceRoot, resolved.baseSha);
    if (baseWorkspace !== headWorkspace) cleanupDirs.push(baseWorkspace);

    const headSurface = await ensureEncodedSurface({
      store,
      workspaceDir: headWorkspace,
      sourceSha: resolved.headSha,
      sourceId: requestedLane.headRef === 'HEAD' ? `workspace:${resolved.headSha}` : `ref:${resolved.headSha}`,
      surface,
      now,
      cachePolicy
    });
    const baseSurface = await ensureEncodedSurface({
      store,
      workspaceDir: baseWorkspace,
      sourceSha: resolved.baseSha,
      sourceId: `ref:${resolved.baseSha}`,
      surface,
      now,
      cachePolicy
    });
    const braidSurfaces = [];
    for (const braid of braidWorkspaces) {
      braidSurfaces.push(await ensureEncodedSurface({
        store,
        workspaceDir: braid.workspace,
        sourceSha: braid.sha,
        sourceId: `braid:${braid.sha}`,
        surface,
        now,
        cachePolicy
      }));
    }

    const laneFingerprint = hashObject({
      surfaceVersion: COUNTERFACTUAL_SURFACE_VERSION,
      baseSha: resolved.baseSha,
      headSha: resolved.headSha,
      braidShas: resolved.braids.map(item => item.sha),
      normalizedScope: scope,
      composition: requestedLane.composition,
      headSurfaceDigest: headSurface.surfaceDigest,
      baseSurfaceDigest: baseSurface.surfaceDigest,
      braidSurfaceDigests: braidSurfaces.map(item => item.surfaceDigest)
    });
    const laneDir = path.join(artifactRoot, laneFingerprint);
    await mkdir(laneDir, { recursive: true });

    const comparison = await store.observer.compareCoordinates({
      left: buildCoordinateSelector(headSurface, braidSurfaces),
      right: buildCoordinateSelector(baseSurface),
      ...(scope ? { scope } : {})
    });
    const comparisonExport = exportCoordinateComparisonFact(comparison);
    const comparisonFile = path.join(laneDir, `comparison.${comparisonExport.factDigest}.json`);
    await writeFile(comparisonFile, comparisonExport.canonicalFactJson);

    let transfer = null;
    let transferExport = null;
    let transferFile = null;
    if (includeTransferPlan) {
      transfer = await store.observer.planCoordinateTransfer({
        source: buildCoordinateSelector(headSurface, braidSurfaces),
        target: buildCoordinateSelector(baseSurface),
        ...(scope ? { scope } : {})
      });
      transferExport = exportCoordinateTransferPlanFact(transfer);
      transferFile = path.join(laneDir, `transfer.${transferExport.factDigest}.json`);
      await writeFile(transferFile, transferExport.canonicalFactJson);
    }

    const judgment = classifyCounterfactual({
      comparison,
      transfer,
      policy
    }, {
      braidRefs: requestedLane.braidRefs,
      scope
    });

    const summary = {
      provider: 'git-warp',
      providerPackageVersion: GIT_WARP_PROVIDER_VERSION,
      surfaceVersion: COUNTERFACTUAL_SURFACE_VERSION,
      laneFingerprint,
      composition: requestedLane.composition,
      requested: {
        baseRef: requestedLane.baseRef,
        headRef: requestedLane.headRef,
        braidRefs: requestedLane.braidRefs
      },
      resolved: {
        baseRef: requestedLane.baseRef,
        baseSha: resolved.baseSha,
        headRef: requestedLane.headRef,
        headSha: resolved.headSha,
        braidRefs: resolved.braids,
        liveWorkspace: requestedLane.headRef === 'HEAD'
      },
      facts: {
        comparison: {
          exportVersion: comparisonExport.exportVersion,
          factKind: comparisonExport.factKind,
          factDigest: comparisonExport.factDigest,
          changed: Boolean(comparison?.visibleState?.changed),
          file: path.relative(workspaceRoot, comparisonFile)
        },
        transferPlan: transferExport ? {
          exportVersion: transferExport.exportVersion,
          factKind: transferExport.factKind,
          factDigest: transferExport.factDigest,
          changed: Boolean(transfer?.changed),
          file: path.relative(workspaceRoot, transferFile)
        } : null,
        normalizedScope: scope
      },
      judgment
    };
    summary.cache = {
      generatedAt: now,
      lastUsedAt: now,
      expiresAt: computeExpiry(now, cachePolicy.ttlMs),
      storeLeaseVersion: COUNTERFACTUAL_STORE_LEASE_VERSION,
      surfaceKeys: [headSurface.surfaceKey, baseSurface.surfaceKey, ...braidSurfaces.map(item => item.surfaceKey)]
    };

    const summaryPath = path.join(laneDir, 'summary.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    await writeFile(currentPath, JSON.stringify({ ...summary, summaryPath: path.relative(workspaceRoot, summaryPath) }, null, 2));
    await writeStoreLease(storeRoot, {
      now,
      cachePolicy,
      lastLaneFingerprint: laneFingerprint
    });
    return summary;
  } catch (error) {
    const fallback = buildProviderFailure({
      repoRoot: workspaceRoot,
      lane: requestedLane,
      error,
      policy
    });
    await mkdir(path.dirname(currentPath), { recursive: true });
    await writeFile(currentPath, JSON.stringify(fallback, null, 2));
    return fallback;
  } finally {
    for (const dir of cleanupDirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function buildProviderFailure({ repoRoot, lane, error, policy }) {
  const penalties = policy?.counterfactual?.penalties || {};
  const gateMode = policy?.counterfactual?.gateMode || 'off';
  const reasons = [error?.message || 'Counterfactual analysis failed'];
  return {
    provider: 'git-warp',
    providerPackageVersion: GIT_WARP_PROVIDER_VERSION,
    surfaceVersion: COUNTERFACTUAL_SURFACE_VERSION,
    laneFingerprint: hashObject({ repoRoot, lane, failure: reasons[0] }),
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
      signals: ['provider_unavailable', ...(lane.braidRefs.length > 0 ? ['braid_present'] : [])],
      riskClass: 'high',
      confidenceAdjustment: -Math.abs(Number(penalties.providerUnavailable || 50)),
      gate: gateMode === 'hard' ? 'fail' : (gateMode === 'audit' ? 'audit' : 'pass'),
      wouldFail: true,
      reasons
    }
  };
}

function classifyCounterfactual({ comparison, transfer, policy }, { braidRefs, scope }) {
  const penalties = policy?.counterfactual?.penalties || {};
  const gateMode = policy?.counterfactual?.gateMode || 'off';
  const patchDivergence = Number(comparison?.visiblePatchDivergence?.leftOnlyCount || 0) > 0
    || Number(comparison?.visiblePatchDivergence?.rightOnlyCount || 0) > 0;
  const visibleStateDelta = Boolean(comparison?.visibleState?.changed);
  const transferChanged = Boolean(transfer?.changed);
  const summary = transfer?.summary || {};
  const ops = Array.isArray(transfer?.ops) ? transfer.ops : [];
  const removeOpsPresent = ops.some(op => op?.op === 'remove_node' || op?.op === 'remove_edge');
  const contentClearOpsPresent = ops.some(op => op?.op === 'clear_node_content' || op?.op === 'clear_edge_content')
    || Number(summary.clearNodeContentCount || 0) > 0
    || Number(summary.clearEdgeContentCount || 0) > 0;
  const destructiveOpsPresent = removeOpsPresent
    || contentClearOpsPresent
    || Number(summary.clearNodePropertyCount || 0) > 0
    || Number(summary.clearEdgePropertyCount || 0) > 0;

  const signals = [];
  if (patchDivergence) signals.push('patch_divergence');
  if (visibleStateDelta) signals.push('visible_state_delta');
  if (transferChanged) signals.push('transfer_ops_present');
  if (destructiveOpsPresent) signals.push('destructive_transfer_ops_present');
  if (contentClearOpsPresent) signals.push('content_clear_ops_present');
  if (scope) signals.push('scope_applied');
  if (braidRefs.length > 0) signals.push('braid_present');

  const status = patchDivergence || visibleStateDelta || transferChanged ? 'divergent' : 'clean';
  const riskClass = !transferChanged ? 'none' : (destructiveOpsPresent ? 'high' : 'low');

  let confidenceAdjustment = 0;
  const reasons = [];
  if (status === 'divergent') {
    const penalty = Math.abs(Number(penalties.divergence || 10));
    confidenceAdjustment -= penalty;
    reasons.push(`Counterfactual divergence detected (${penalty} point confidence penalty).`);
  }
  if (riskClass === 'high') {
    const penalty = Math.abs(Number(penalties.destructiveTransfer || 30));
    confidenceAdjustment -= penalty;
    reasons.push(`Destructive transfer risk detected (${penalty} point confidence penalty).`);
  }
  if (reasons.length === 0) {
    reasons.push('Counterfactual lane is clean.');
  }

  const wouldFail = riskClass === 'high';
  let gate = 'pass';
  if (gateMode === 'audit' && wouldFail) gate = 'audit';
  if (gateMode === 'hard' && wouldFail) gate = 'fail';

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

function normalizeScope(scope) {
  if (!scope) return null;
  return normalizeVisibleStateScopeV1(scope);
}

function buildCoordinateSelector(primarySurface, braidSurfaces = []) {
  const frontier = {
    [primarySurface.writerId]: primarySurface.patchSha
  };
  for (const surface of braidSurfaces) {
    frontier[surface.writerId] = surface.patchSha;
  }
  return { kind: 'coordinate', frontier };
}

function resolveLaneRefs(repoRoot, lane) {
  const baseSha = resolveGitRef(repoRoot, lane.baseRef);
  const headSha = resolveGitRef(repoRoot, lane.headRef || 'HEAD');
  const braids = lane.braidRefs.map(ref => ({ ref, sha: resolveGitRef(repoRoot, ref) }));
  return { baseSha, headSha, braids };
}

async function ensureEncodedSurface({ store, workspaceDir, sourceSha, sourceId, surface, now, cachePolicy }) {
  const surfaceModel = await collectCounterfactualSurfaceModel({ workspaceDir, sourceSha, surface });
  const surfaceDigest = hashObject({
    sourceId,
    surfaceVersion: COUNTERFACTUAL_SURFACE_VERSION,
    nodes: surfaceModel.nodeSpecs.map(spec => ({
      id: spec.id,
      properties: spec.properties
    }))
  });
  const surfaceKey = `${COUNTERFACTUAL_SURFACE_VERSION}-${surfaceDigest}`;
  const metadataPath = path.join(store.root, 'surfaces', `${surfaceKey}.json`);
  const cached = await readJson(metadataPath);
  if (cached?.writerId && cached?.patchSha) {
    const refreshed = {
      ...cached,
      surfaceKey,
      sourceSha,
      sourceId,
      lastUsedAt: now,
      expiresAt: computeExpiry(now, cachePolicy.ttlMs)
    };
    await writeFile(metadataPath, JSON.stringify(refreshed, null, 2));
    return refreshed;
  }

  await mkdir(path.dirname(metadataPath), { recursive: true });
  const writerId = `surface-${surfaceDigest.slice(0, 16)}`;
  const graph = await WarpGraph.open({
    persistence: store.persistence,
    graphName: COUNTERFACTUAL_GRAPH_NAME,
    writerId
  });
  const patchSha = await graph.patch(async patch => {
    for (const spec of surfaceModel.nodeSpecs) {
      patch.addNode(spec.id);
      for (const [key, value] of Object.entries(spec.properties)) {
        patch.setProperty(spec.id, key, value);
      }
      if (spec.content) {
        await patch.attachContent(spec.id, spec.mime, spec.content);
      }
    }
  });

  const metadata = {
    writerId,
    patchSha,
    surfaceKey,
    surfaceDigest,
    sourceSha,
    sourceId,
    summary: surfaceModel.summary,
    lastUsedAt: now,
    expiresAt: computeExpiry(now, cachePolicy.ttlMs)
  };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

async function openProviderStore(storeRoot) {
  await mkdir(storeRoot, { recursive: true });
  ensureGitRepo(storeRoot);
  const plumbing = GitPlumbing.createDefault({ cwd: storeRoot });
  const persistence = new GitGraphAdapter({ plumbing });
  const observer = await WarpGraph.open({
    persistence,
    graphName: COUNTERFACTUAL_GRAPH_NAME,
    writerId: 'observer'
  });
  return { root: storeRoot, persistence, observer };
}

async function pruneCounterfactualCache({ artifactRoot, currentPath, storeRoot, now, cachePolicy }) {
  await mkdir(artifactRoot, { recursive: true });
  if (await shouldResetStoreLease(storeRoot, now)) {
    await rm(storeRoot, { recursive: true, force: true });
  }
  await pruneLaneArtifacts({ artifactRoot, now, cachePolicy });
  const current = await readJson(currentPath);
  if (!current?.summaryPath) {
    return;
  }
  const workspaceRoot = path.resolve(artifactRoot, '..', '..');
  const summaryPath = path.resolve(workspaceRoot, current.summaryPath);
  if (!existsSync(summaryPath)) {
    await rm(currentPath, { force: true });
  }
}

async function shouldResetStoreLease(storeRoot, now) {
  const lease = await readJson(path.join(storeRoot, 'lease.json'));
  if (!lease) {
    return false;
  }
  if (lease.leaseVersion !== COUNTERFACTUAL_STORE_LEASE_VERSION) {
    return true;
  }
  const expiresAt = Date.parse(lease.expiresAt || '');
  if (Number.isNaN(expiresAt)) {
    return false;
  }
  return expiresAt <= Date.parse(now);
}

async function pruneLaneArtifacts({ artifactRoot, now, cachePolicy }) {
  const entries = await readdir(artifactRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'store') {
      continue;
    }
    const laneDir = path.join(artifactRoot, entry.name);
    const summaryPath = path.join(laneDir, 'summary.json');
    const summary = await readJson(summaryPath);
    if (await isExpiredLaneSummary(summaryPath, summary, now, cachePolicy)) {
      await rm(laneDir, { recursive: true, force: true });
    }
  }
}

async function isExpiredLaneSummary(summaryPath, summary, now, cachePolicy) {
  const summaryExpiry = Date.parse(summary?.cache?.expiresAt || '');
  if (!Number.isNaN(summaryExpiry)) {
    return summaryExpiry <= Date.parse(now);
  }
  try {
    const summaryStat = await stat(summaryPath);
    return summaryStat.mtimeMs <= Date.parse(now) - cachePolicy.ttlMs;
  } catch {
    return true;
  }
}

async function writeStoreLease(storeRoot, { now, cachePolicy, lastLaneFingerprint }) {
  await mkdir(storeRoot, { recursive: true });
  const leasePath = path.join(storeRoot, 'lease.json');
  const existing = await readJson(leasePath);
  const lease = {
    leaseVersion: COUNTERFACTUAL_STORE_LEASE_VERSION,
    graphName: COUNTERFACTUAL_GRAPH_NAME,
    provider: 'git-warp',
    providerPackageVersion: GIT_WARP_PROVIDER_VERSION,
    surfaceVersion: COUNTERFACTUAL_SURFACE_VERSION,
    createdAt: existing?.createdAt || now,
    lastUsedAt: now,
    expiresAt: computeExpiry(now, cachePolicy.ttlMs),
    ttlHours: cachePolicy.ttlHours,
    lastLaneFingerprint: lastLaneFingerprint || existing?.lastLaneFingerprint || null
  };
  await writeFile(leasePath, JSON.stringify(lease, null, 2));
  return lease;
}

function ensureGitRepo(storeRoot) {
  if (existsSync(path.join(storeRoot, '.git'))) return;
  execGit(storeRoot, ['init', '--initial-branch=main']);
  execGit(storeRoot, ['config', 'user.email', 'wesley-counterfactual@localhost']);
  execGit(storeRoot, ['config', 'user.name', 'Wesley Counterfactual']);
}

async function materializeGitRef(repoRoot, sha) {
  const target = await mkdtemp(path.join(os.tmpdir(), 'wesley-counterfactual-'));
  const archive = spawnSync('git', ['-C', repoRoot, 'archive', sha], { encoding: null });
  if (archive.status !== 0) {
    throw new Error((archive.stderr || Buffer.from('Unable to materialize git ref')).toString('utf8'));
  }
  const untar = spawnSync('tar', ['-x', '-C', target], {
    input: archive.stdout,
    encoding: null
  });
  if (untar.status !== 0) {
    throw new Error((untar.stderr || Buffer.from('Unable to unpack git archive')).toString('utf8'));
  }
  return target;
}

function resolveGitRef(repoRoot, ref) {
  return execGit(repoRoot, ['rev-parse', ref]).trim();
}

function execGit(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).stdout
    || execGitChecked(cwd, args);
}

function execGitChecked(cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveCounterfactualCachePolicy(env = process.env) {
  const parsed = Number.parseInt(String(env?.WESLEY_COUNTERFACTUAL_CACHE_TTL_HOURS ?? ''), 10);
  const ttlHours = Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_COUNTERFACTUAL_CACHE_TTL_HOURS;
  return {
    ttlHours,
    ttlMs: ttlHours * 60 * 60 * 1000
  };
}

function computeExpiry(now, ttlMs) {
  return new Date(Date.parse(now) + ttlMs).toISOString();
}

function hashObject(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value))).digest('hex');
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sortValue(value[key])])
  );
}
