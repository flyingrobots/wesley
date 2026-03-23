import { EvidenceMap, mergePluginEvidenceIntoMap } from './EvidenceMap.mjs';
import { ScoringEngine } from './Scoring.mjs';
import { buildAdditivePlan, explainPlan } from './MigrationPlan.mjs';
import { createGeneratedArtifactResolver, enrichBundleWithEvidenceTruth } from './GeneratedBundle.mjs';
import { GENERATED_ARTIFACT_DIR } from './GeneratedArtifactPaths.mjs';
import { irToSchema } from './irToSchema.mjs';
import { lineSpanForContent } from './EvidenceSpans.mjs';
import { assertCounterfactualSurfacePort } from '../ports/CounterfactualSurface.mjs';

const DEFAULT_BUNDLE_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export async function ensureCounterfactualWorkspaceArtifacts({
  workspaceDir,
  bundleDir = GENERATED_ARTIFACT_DIR,
  outDir = 'out',
  schemaPath,
  sourceSha = 'unknown',
  transmutation = 'legacy-supabase'
} = {}, port) {
  const deps = assertCounterfactualSurfacePort(port);
  const resolvedWorkspaceDir = deps.resolvePath(workspaceDir || '.');
  const resolvedBundleDir = resolveWorkspacePath(resolvedWorkspaceDir, bundleDir, deps);
  const resolvedOutDir = resolveWorkspacePath(resolvedWorkspaceDir, outDir, deps);
  const resolvedSchemaPath = await resolveCounterfactualSchemaPath({
    workspaceDir: resolvedWorkspaceDir,
    schemaPath
  }, deps);

  const bundlePath = deps.joinPath(resolvedBundleDir, 'bundle.json');
  const planPath = deps.joinPath(resolvedBundleDir, 'plan-report.json');
  const schemaSqlPath = deps.joinPath(resolvedOutDir, 'schema.sql');
  const needsTransform = !await deps.exists(bundlePath) || !await deps.exists(schemaSqlPath);
  const needsPlan = !await deps.exists(planPath);

  if ((!needsTransform && !needsPlan) || !resolvedSchemaPath || !await deps.exists(resolvedSchemaPath)) {
    return false;
  }

  const sdl = await deps.readText(resolvedSchemaPath);
  const ir = deps.parseSDL(sdl);

  await deps.mkdir(resolvedBundleDir);
  await deps.mkdir(resolvedOutDir);

  if (needsTransform) {
    const schema = irToSchema(ir);
    const generatedOutDir = normalizeRelativePath(deps.relativePath(resolvedWorkspaceDir, resolvedOutDir)) || 'out';
    const ddl = await deps.emitDDL(ir, { outDir: generatedOutDir });
    const rls = await deps.emitRLS(ir, { outDir: generatedOutDir });
    const tests = await deps.emitPgTap(ir, { outDir: generatedOutDir });
    const emitted = [
      ...normalizeEmittedFiles(ddl, resolvedWorkspaceDir, resolvedOutDir, deps),
      ...normalizeEmittedFiles(rls, resolvedWorkspaceDir, resolvedOutDir, deps),
      ...normalizeEmittedFiles(tests, resolvedWorkspaceDir, resolvedOutDir, deps)
    ];

    for (const artifact of emitted) {
      await deps.mkdir(deps.dirname(artifact.absolutePath));
      await deps.writeText(artifact.absolutePath, artifact.content);
    }

    const bundle = buildCounterfactualBundle({
      workspaceDir: resolvedWorkspaceDir,
      artifacts: emitted,
      schema,
      pluginEvidence: [ddl?.evidence, rls?.evidence, tests?.evidence],
      outDir: generatedOutDir,
      sourceSha,
      transmutation,
      relativePath: deps.relativePath
    });
    await deps.writeText(bundlePath, JSON.stringify(bundle, null, 2));
  }

  if (needsPlan) {
    const previous = await readJson(deps.joinPath(resolvedBundleDir, 'snapshot.json'), deps) || { tables: [] };
    const plan = buildAdditivePlan(previous, ir);
    const explain = explainPlan(plan);
    const report = {
      transmutation,
      plan,
      explain,
      mapping: [],
      radar: {
        lines: [],
        counts: {}
      }
    };
    await deps.writeText(planPath, JSON.stringify(report, null, 2));
  }

  return true;
}

export async function collectCounterfactualSurfaceModel({
  workspaceDir,
  sourceSha,
  surface = {}
} = {}, port) {
  const deps = assertCounterfactualSurfacePort(port);
  const resolvedWorkspaceDir = deps.resolvePath(workspaceDir || '.');
  const bundleDir = resolveWorkspacePath(resolvedWorkspaceDir, surface.bundleDir || GENERATED_ARTIFACT_DIR, deps);
  const outDir = resolveWorkspacePath(resolvedWorkspaceDir, surface.outDir || 'out', deps);
  const schemaPath = await resolveCounterfactualSchemaPath({
    workspaceDir: resolvedWorkspaceDir,
    schemaPath: surface.schemaPath
  }, deps);

  await ensureCounterfactualWorkspaceArtifacts({
    workspaceDir: resolvedWorkspaceDir,
    bundleDir,
    outDir,
    schemaPath,
    sourceSha,
    transmutation: surface.transmutation || 'legacy-supabase'
  }, deps);

  const nodeSpecs = [];
  const summary = {
    artifactCount: 0,
    evidenceCount: 0,
    planCount: 0,
    realmCount: 0
  };
  const seen = new Set();

  const bundlePath = deps.joinPath(bundleDir, 'bundle.json');
  if (await deps.exists(bundlePath)) {
    const bundleContent = await deps.readFile(bundlePath);
    nodeSpecs.push(buildCounterfactualFileNodeSpec({
      workspaceDir: resolvedWorkspaceDir,
      nodeId: 'evidence:bundle',
      family: 'evidence',
      absolutePath: bundlePath,
      content: bundleContent,
      hashContent: deps.hashContent,
      relativePath: deps.relativePath
    }));
    summary.evidenceCount += 1;
    seen.add(deps.resolvePath(bundlePath));

    const bundle = JSON.parse(contentAsText(bundleContent));
    for (const rel of extractBundleFileReferences(bundle)) {
      const abs = deps.resolvePath(resolvedWorkspaceDir, rel);
      if (!await deps.exists(abs) || seen.has(abs)) continue;
      const content = await deps.readFile(abs);
      nodeSpecs.push(buildCounterfactualFileNodeSpec({
        workspaceDir: resolvedWorkspaceDir,
        nodeId: `artifact:${normalizeRelativePath(deps.relativePath(resolvedWorkspaceDir, abs))}`,
        family: 'artifact',
        absolutePath: abs,
        content,
        hashContent: deps.hashContent,
        relativePath: deps.relativePath
      }));
      summary.artifactCount += 1;
      seen.add(abs);
    }
  }

  for (const abs of await deps.listFilesRecursive(outDir)) {
    if (seen.has(abs)) continue;
    const content = await deps.readFile(abs);
    nodeSpecs.push(buildCounterfactualFileNodeSpec({
      workspaceDir: resolvedWorkspaceDir,
      nodeId: `artifact:${normalizeRelativePath(deps.relativePath(resolvedWorkspaceDir, abs))}`,
      family: 'artifact',
      absolutePath: abs,
      content,
      hashContent: deps.hashContent,
      relativePath: deps.relativePath
    }));
    summary.artifactCount += 1;
    seen.add(abs);
  }

  const planPath = deps.joinPath(bundleDir, 'plan-report.json');
  if (await deps.exists(planPath)) {
    const content = await deps.readFile(planPath);
    nodeSpecs.push(buildCounterfactualFileNodeSpec({
      workspaceDir: resolvedWorkspaceDir,
      nodeId: 'plan:report',
      family: 'plan',
      absolutePath: planPath,
      content,
      hashContent: deps.hashContent,
      relativePath: deps.relativePath
    }));
    summary.planCount += 1;
  }

  const realmPath = deps.joinPath(bundleDir, 'realm.json');
  if (await deps.exists(realmPath)) {
    const content = await deps.readFile(realmPath);
    nodeSpecs.push(buildCounterfactualFileNodeSpec({
      workspaceDir: resolvedWorkspaceDir,
      nodeId: 'realm:report',
      family: 'realm',
      absolutePath: realmPath,
      content,
      hashContent: deps.hashContent,
      relativePath: deps.relativePath
    }));
    summary.realmCount += 1;
  }

  return { nodeSpecs, summary };
}

export async function resolveCounterfactualSchemaPath({ workspaceDir, schemaPath } = {}, port) {
  const deps = assertCounterfactualSurfacePort(port);
  if (schemaPath) {
    const resolved = resolveWorkspacePath(workspaceDir, schemaPath, deps);
    return await deps.exists(resolved) ? resolved : null;
  }

  const defaults = [
    deps.joinPath(workspaceDir, 'schema.graphql'),
    deps.joinPath(workspaceDir, 'schema', 'schema.graphql')
  ];

  for (const candidate of defaults) {
    if (await deps.exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizeEmittedFiles(emitted, workspaceDir, outDir, deps) {
  return (emitted?.files || []).map((file) => ({
    name: file.name,
    content: file.content ?? '',
    absolutePath: deps.joinPath(outDir, file.name),
    relativePath: normalizeRelativePath(deps.relativePath(workspaceDir, deps.joinPath(outDir, file.name)))
  }));
}

function buildCounterfactualBundle({ workspaceDir, artifacts, schema, pluginEvidence = [], outDir = 'out', sourceSha, transmutation = 'legacy-supabase', relativePath }) {
  const evidenceMap = new EvidenceMap();
  evidenceMap.setSha(sourceSha);
  evidenceMap.timestamp = DEFAULT_BUNDLE_TIMESTAMP;

  for (const entry of pluginEvidence) {
    mergePluginEvidenceIntoMap(evidenceMap, entry, {
      timestampOverride: DEFAULT_BUNDLE_TIMESTAMP
    });
  }

  for (const artifact of artifacts) {
    const rel = normalizeRelativePath(relativePath(workspaceDir, artifact.absolutePath));
    const uid = `artifact:${rel}`;
    if (evidenceMap.hasArtifact(uid, 'generated')) continue;
    evidenceMap.record(uid, 'generated', {
      file: rel,
      lines: lineSpanForContent(artifact.content),
      sha: sourceSha,
      timestamp: DEFAULT_BUNDLE_TIMESTAMP
    });
  }

  const scoring = new ScoringEngine(evidenceMap).exportScores(
    schema,
    [],
    {},
    { scs: legacySupabaseScoringOptions() }
  );
  scoring.timestamp = DEFAULT_BUNDLE_TIMESTAMP;

  const baseBundle = {
    bundleVersion: scoring.version,
    transmutation,
    sha: sourceSha,
    timestamp: DEFAULT_BUNDLE_TIMESTAMP,
    evidence: evidenceMap.toJSON(),
    scores: scoring
  };

  return enrichBundleWithEvidenceTruth({
    bundle: baseBundle,
    scores: scoring,
    artifacts: artifacts.map((artifact) => ({
      name: artifact.name,
      content: artifact.content
    })),
    outDir,
    resolver: createGeneratedArtifactResolver(
      artifacts.map((artifact) => ({ name: artifact.name, content: artifact.content })),
      outDir
    )
  }).bundle;
}

function buildCounterfactualFileNodeSpec({ workspaceDir, nodeId, family, absolutePath, content, hashContent, relativePath }) {
  const rel = normalizeRelativePath(relativePath(workspaceDir, absolutePath));
  return {
    id: nodeId,
    mime: inferMimeType(absolutePath),
    content,
    properties: {
      family,
      path: rel,
      sha256: hashContent(content),
      size: contentByteLength(content)
    }
  };
}

function legacySupabaseScoringOptions() {
  return {
    artifactGroups: {
      sql: ['sql'],
      tests: ['test']
    },
    rollupGroups: ['sql']
  };
}

function resolveWorkspacePath(workspaceDir, target, deps) {
  if (target == null) return target;
  return deps.isAbsolute(target) ? target : deps.joinPath(workspaceDir, target);
}

function inferMimeType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.sql')) return 'text/plain';
  if (filePath.endsWith('.graphql')) return 'text/plain';
  if (filePath.endsWith('.md')) return 'text/markdown';
  return 'application/octet-stream';
}

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, '/');
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

async function readJson(filePath, deps) {
  try {
    return JSON.parse(await deps.readText(filePath));
  } catch {
    return null;
  }
}

function contentAsText(content) {
  return typeof content === 'string' ? content : Buffer.from(content).toString('utf8');
}

function contentByteLength(content) {
  return typeof content === 'string' ? Buffer.byteLength(content) : content.length;
}
