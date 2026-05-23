import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { GENERATED_ARTIFACT_DIR } from '@wesley/core';
import { GraphQLAdapter } from './GraphQLAdapter.mjs';

export function createNodeCounterfactualSurfacePort() {
  const parser = new GraphQLAdapter();

  return {
    async exists(targetPath) {
      return existsSync(targetPath);
    },
    async mkdir(targetPath) {
      await mkdir(targetPath, { recursive: true });
    },
    async readText(targetPath) {
      return readFile(targetPath, 'utf8');
    },
    async readFile(targetPath) {
      return readFile(targetPath);
    },
    async listFilesRecursive(root) {
      return listFilesRecursive(root);
    },
    hashContent(content) {
      return createHash('sha256').update(content).digest('hex');
    },
    resolvePath(...segments) {
      return path.resolve(...segments);
    },
    joinPath(...segments) {
      return path.join(...segments);
    },
    relativePath(from, to) {
      return path.relative(from, to);
    },
    dirname(targetPath) {
      return path.dirname(targetPath);
    },
    isAbsolute(targetPath) {
      return path.isAbsolute(targetPath);
    },
    parseSDL(sdl) {
      return parser.parseSDL(sdl);
    }
  };
}

export async function ensureCounterfactualWorkspaceArtifacts(_options = {}) {
  return false;
}

export async function collectCounterfactualSurfaceModel({ workspaceDir, surface = {} } = {}) {
  const deps = createNodeCounterfactualSurfacePort();
  const resolvedWorkspaceDir = deps.resolvePath(workspaceDir || '.');
  const bundleDir = resolveWorkspacePath(
    resolvedWorkspaceDir,
    surface.bundleDir || GENERATED_ARTIFACT_DIR,
    deps
  );
  const outDir = resolveWorkspacePath(resolvedWorkspaceDir, surface.outDir || 'out', deps);
  const nodeSpecs = [];
  const summary = {
    artifactCount: 0,
    evidenceCount: 0,
    planCount: 0,
    realmCount: 0
  };
  const seen = new Set();

  const knownFiles = [
    {
      absolutePath: deps.joinPath(bundleDir, 'bundle.json'),
      family: 'evidence',
      nodeId: 'evidence:bundle'
    },
    {
      absolutePath: deps.joinPath(bundleDir, 'plan-report.json'),
      family: 'plan',
      nodeId: 'plan:report'
    },
    {
      absolutePath: deps.joinPath(bundleDir, 'realm.json'),
      family: 'realm',
      nodeId: 'realm:report'
    }
  ];

  for (const entry of knownFiles) {
    if (!(await deps.exists(entry.absolutePath))) continue;
    const content = await deps.readFile(entry.absolutePath);
    nodeSpecs.push(
      buildCounterfactualFileNodeSpec({
        workspaceDir: resolvedWorkspaceDir,
        nodeId: entry.nodeId,
        family: entry.family,
        absolutePath: entry.absolutePath,
        content,
        hashContent: deps.hashContent,
        relativePath: deps.relativePath
      })
    );
    seen.add(deps.resolvePath(entry.absolutePath));
    if (entry.family === 'evidence') summary.evidenceCount += 1;
    if (entry.family === 'plan') summary.planCount += 1;
    if (entry.family === 'realm') summary.realmCount += 1;
  }

  for (const abs of await deps.listFilesRecursive(outDir)) {
    const resolved = deps.resolvePath(abs);
    if (seen.has(resolved)) continue;
    const content = await deps.readFile(resolved);
    nodeSpecs.push(
      buildCounterfactualFileNodeSpec({
        workspaceDir: resolvedWorkspaceDir,
        nodeId: `artifact:${normalizeRelativePath(deps.relativePath(resolvedWorkspaceDir, resolved))}`,
        family: 'artifact',
        absolutePath: resolved,
        content,
        hashContent: deps.hashContent,
        relativePath: deps.relativePath
      })
    );
    seen.add(resolved);
    summary.artifactCount += 1;
  }

  return { nodeSpecs, summary };
}

async function listFilesRecursive(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  files.sort();
  return files;
}

function buildCounterfactualFileNodeSpec({
  workspaceDir,
  nodeId,
  family,
  absolutePath,
  content,
  hashContent,
  relativePath
}) {
  const rel = normalizeRelativePath(relativePath(workspaceDir, absolutePath));
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ''));
  return {
    id: nodeId,
    mime: 'application/octet-stream',
    content: buffer,
    properties: {
      family,
      path: rel,
      sha256: hashContent(buffer),
      bytes: buffer.byteLength
    }
  };
}

function resolveWorkspacePath(workspaceDir, targetPath, deps) {
  const value = String(targetPath || '');
  return deps.isAbsolute(value) ? deps.resolvePath(value) : deps.resolvePath(workspaceDir, value);
}

function normalizeRelativePath(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '');
}
