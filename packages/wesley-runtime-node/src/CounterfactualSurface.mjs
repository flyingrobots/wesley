import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  GENERATED_ARTIFACT_DIR,
  EvidenceMap,
  ScoringEngine,
  buildAdditivePlan,
  createGeneratedArtifactResolver,
  enrichBundleWithEvidenceTruth,
  explainPlan,
  irToSchema,
  lineSpanForContent,
  mergePluginEvidenceIntoMap
} from '@wesley/core';
import { emitDDL, emitPgTap, emitRLS } from '@wesley/generator-supabase';

import { GraphQLAdapter } from './GraphQLAdapter.mjs';

const DEFAULT_BUNDLE_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export async function ensureCounterfactualWorkspaceArtifacts({
  workspaceDir,
  bundleDir = GENERATED_ARTIFACT_DIR,
  outDir = 'out',
  schemaPath,
  sourceSha = 'unknown',
  transmutation = 'legacy-supabase'
} = {}) {
  const resolvedWorkspaceDir = path.resolve(workspaceDir || process.cwd());
  const resolvedBundleDir = resolveWorkspacePath(resolvedWorkspaceDir, bundleDir);
  const resolvedOutDir = resolveWorkspacePath(resolvedWorkspaceDir, outDir);
  const resolvedSchemaPath = resolveWorkspacePath(resolvedWorkspaceDir, schemaPath);

  const bundlePath = path.join(resolvedBundleDir, 'bundle.json');
  const planPath = path.join(resolvedBundleDir, 'plan-report.json');
  const schemaSqlPath = path.join(resolvedOutDir, 'schema.sql');
  const needsTransform = !existsSync(bundlePath) || !existsSync(schemaSqlPath);
  const needsPlan = !existsSync(planPath);
  if ((!needsTransform && !needsPlan) || !existsSync(resolvedSchemaPath)) {
    return false;
  }

  const sdl = await readFile(resolvedSchemaPath, 'utf8');
  const parser = new GraphQLAdapter();
  const ir = parser.parseSDL(sdl);

  await mkdir(resolvedBundleDir, { recursive: true });
  await mkdir(resolvedOutDir, { recursive: true });

  if (needsTransform) {
    const schema = irToSchema(ir);
    const generatedOutDir = normalizeRelativePath(path.relative(resolvedWorkspaceDir, resolvedOutDir)) || 'out';
    const ddl = await emitDDL(ir, { outDir: generatedOutDir });
    const rls = await emitRLS(ir, { outDir: generatedOutDir });
    const tests = await emitPgTap(ir, { outDir: generatedOutDir });
    const emitted = [
      ...normalizeEmittedFiles(ddl, resolvedWorkspaceDir, resolvedOutDir),
      ...normalizeEmittedFiles(rls, resolvedWorkspaceDir, resolvedOutDir),
      ...normalizeEmittedFiles(tests, resolvedWorkspaceDir, resolvedOutDir)
    ];

    for (const artifact of emitted) {
      await mkdir(path.dirname(artifact.absolutePath), { recursive: true });
      await writeFile(artifact.absolutePath, artifact.content);
    }

    const bundle = buildCounterfactualBundle({
      workspaceDir: resolvedWorkspaceDir,
      artifacts: emitted,
      schema,
      pluginEvidence: [ddl?.evidence, rls?.evidence, tests?.evidence],
      outDir: generatedOutDir,
      sourceSha
    });
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2));
  }

  if (needsPlan) {
    const previous = await readJson(path.join(resolvedBundleDir, 'snapshot.json')) || { tables: [] };
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
    await writeFile(planPath, JSON.stringify(report, null, 2));
  }

  return true;
}

function normalizeEmittedFiles(emitted, workspaceDir, outDir) {
  return (emitted?.files || []).map((file) => ({
    name: file.name,
    content: file.content ?? '',
    absolutePath: path.join(outDir, file.name),
    relativePath: normalizeRelativePath(path.relative(workspaceDir, path.join(outDir, file.name)))
  }));
}

function buildCounterfactualBundle({ workspaceDir, artifacts, schema, pluginEvidence = [], outDir = 'out', sourceSha, transmutation = 'legacy-supabase' }) {
  const evidenceMap = new EvidenceMap();
  evidenceMap.setSha(sourceSha);
  evidenceMap.timestamp = DEFAULT_BUNDLE_TIMESTAMP;

  for (const entry of pluginEvidence) {
    mergePluginEvidenceIntoMap(evidenceMap, entry, {
      timestampOverride: DEFAULT_BUNDLE_TIMESTAMP
    });
  }

  for (const artifact of artifacts) {
    const rel = normalizeRelativePath(path.relative(workspaceDir, artifact.absolutePath));
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

function legacySupabaseScoringOptions() {
  return {
    artifactGroups: {
      sql: ['sql'],
      tests: ['test']
    },
    rollupGroups: ['sql']
  };
}

function resolveWorkspacePath(workspaceDir, target) {
  return path.isAbsolute(target) ? target : path.join(workspaceDir, target);
}

function normalizeRelativePath(value) {
  return String(value).split(path.sep).join('/');
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}
