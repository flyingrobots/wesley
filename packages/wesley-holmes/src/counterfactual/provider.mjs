import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
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
import {
  GENERATED_COUNTERFACTUAL_CURRENT_PATH,
  GENERATED_COUNTERFACTUAL_DIR
} from '@wesley/core';
import { ensureCounterfactualWorkspaceArtifacts } from '@wesley/runtime-node';

export const COUNTERFACTUAL_GRAPH_NAME = 'wesley-counterfactual-v1';
export const COUNTERFACTUAL_SURFACE_VERSION = 'wesley-counterfactual-v1';
export const COUNTERFACTUAL_DIR = GENERATED_COUNTERFACTUAL_DIR;
export const COUNTERFACTUAL_CURRENT_PATH = GENERATED_COUNTERFACTUAL_CURRENT_PATH;
export const GIT_WARP_PROVIDER_VERSION = '14.16.2';

export async function analyzeCounterfactual({
  repoRoot,
  lane,
  includeTransferPlan = true,
  policy,
  surface = {}
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
  const scope = normalizeScope(requestedLane.scope);
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
      repoRoot: workspaceRoot,
      workspaceDir: headWorkspace,
      sourceSha: resolved.headSha,
      sourceId: requestedLane.headRef === 'HEAD' ? `workspace:${resolved.headSha}` : `ref:${resolved.headSha}`,
      surface
    });
    const baseSurface = await ensureEncodedSurface({
      store,
      repoRoot: workspaceRoot,
      workspaceDir: baseWorkspace,
      sourceSha: resolved.baseSha,
      sourceId: `ref:${resolved.baseSha}`,
      surface
    });
    const braidSurfaces = [];
    for (const braid of braidWorkspaces) {
      braidSurfaces.push(await ensureEncodedSurface({
        store,
        repoRoot: workspaceRoot,
        workspaceDir: braid.workspace,
        sourceSha: braid.sha,
        sourceId: `braid:${braid.sha}`,
        surface
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

    const summaryPath = path.join(laneDir, 'summary.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    await writeFile(currentPath, JSON.stringify({ ...summary, summaryPath: path.relative(workspaceRoot, summaryPath) }, null, 2));
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

async function ensureEncodedSurface({ store, repoRoot, workspaceDir, sourceSha, sourceId, surface }) {
  const surfaceModel = await collectSurfaceModel({ repoRoot, workspaceDir, sourceSha, surface });
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
    return cached;
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
    surfaceDigest,
    summary: surfaceModel.summary
  };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

async function collectSurfaceModel({ repoRoot, workspaceDir, sourceSha, surface }) {
  const bundleDir = resolveWorkspacePath(workspaceDir, surface.bundleDir || '.wesley');
  const outDir = resolveWorkspacePath(workspaceDir, surface.outDir || 'out');
  const schemaPath = resolveSchemaPath(workspaceDir, surface.schemaPath);
  await ensureWorkspaceArtifacts({
    repoRoot,
    workspaceDir,
    bundleDir,
    outDir,
    schemaPath,
    sourceSha,
    transmutation: surface.transmutation || 'legacy-supabase'
  });

  const nodeSpecs = [];
  const summary = {
    artifactCount: 0,
    evidenceCount: 0,
    planCount: 0,
    realmCount: 0
  };
  const seen = new Set();

  const bundlePath = path.join(bundleDir, 'bundle.json');
  if (existsSync(bundlePath)) {
    const bundleBuffer = await readFile(bundlePath);
    nodeSpecs.push(fileNodeSpec(workspaceDir, 'evidence:bundle', 'evidence', bundlePath, bundleBuffer));
    summary.evidenceCount += 1;
    seen.add(path.resolve(bundlePath));
    const bundle = JSON.parse(bundleBuffer.toString('utf8'));
    for (const rel of extractBundleFileReferences(bundle)) {
      const abs = path.resolve(workspaceDir, rel);
      if (!existsSync(abs) || seen.has(abs)) continue;
      const content = await readFile(abs);
      nodeSpecs.push(fileNodeSpec(workspaceDir, `artifact:${normalizeRelativePath(path.relative(workspaceDir, abs))}`, 'artifact', abs, content));
      summary.artifactCount += 1;
      seen.add(abs);
    }
  }

  for (const abs of await listFilesRecursive(outDir)) {
    if (seen.has(abs)) continue;
    const content = await readFile(abs);
    nodeSpecs.push(fileNodeSpec(workspaceDir, `artifact:${normalizeRelativePath(path.relative(workspaceDir, abs))}`, 'artifact', abs, content));
    summary.artifactCount += 1;
    seen.add(abs);
  }

  const planPath = path.join(bundleDir, 'plan-report.json');
  if (existsSync(planPath)) {
    const content = await readFile(planPath);
    nodeSpecs.push(fileNodeSpec(workspaceDir, 'plan:report', 'plan', planPath, content));
    summary.planCount += 1;
  }

  const realmPath = path.join(bundleDir, 'realm.json');
  if (existsSync(realmPath)) {
    const content = await readFile(realmPath);
    nodeSpecs.push(fileNodeSpec(workspaceDir, 'realm:report', 'realm', realmPath, content));
    summary.realmCount += 1;
  }

  return { nodeSpecs, summary };
}

async function ensureWorkspaceArtifacts({ workspaceDir, bundleDir, outDir, schemaPath, sourceSha, transmutation }) {
  if (!schemaPath) return;
  await ensureCounterfactualWorkspaceArtifacts({
    workspaceDir,
    bundleDir,
    outDir,
    schemaPath,
    sourceSha,
    transmutation
  });
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

function resolveWorkspacePath(workspaceDir, target) {
  return path.isAbsolute(target) ? target : path.join(workspaceDir, target);
}

function resolveSchemaPath(workspaceDir, schemaPath) {
  if (schemaPath) {
    const resolved = resolveWorkspacePath(workspaceDir, schemaPath);
    return existsSync(resolved) ? resolved : null;
  }
  const defaults = [
    path.join(workspaceDir, 'schema.graphql'),
    path.join(workspaceDir, 'schema', 'schema.graphql')
  ];
  return defaults.find(candidate => existsSync(candidate)) || null;
}

function fileNodeSpec(workspaceDir, nodeId, family, absolutePath, content) {
  const rel = normalizeRelativePath(path.relative(workspaceDir, absolutePath));
  const sha256 = createHash('sha256').update(content).digest('hex');
  return {
    id: nodeId,
    mime: inferMimeType(absolutePath),
    content,
    properties: {
      family,
      path: rel,
      sha256,
      size: content.length
    }
  };
}

function inferMimeType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.sql')) return 'text/plain';
  if (filePath.endsWith('.graphql')) return 'text/plain';
  if (filePath.endsWith('.md')) return 'text/markdown';
  return 'application/octet-stream';
}

function normalizeRelativePath(value) {
  return String(value).split(path.sep).join('/');
}

function extractBundleFileReferences(bundle) {
  const files = new Set();
  visit(bundle);
  return Array.from(files).sort();

  function visit(value) {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value.file === 'string') files.add(value.file);
    for (const child of Object.values(value)) visit(child);
  }
}

async function listFilesRecursive(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(abs));
    } else if (entry.isFile()) {
      files.push(abs);
    }
  }
  files.sort();
  return files;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
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
