import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  collectCounterfactualSurfaceModel as collectCoreCounterfactualSurfaceModel,
  ensureCounterfactualWorkspaceArtifacts as ensureCoreCounterfactualWorkspaceArtifacts
} from '@wesley/core';
import { GraphQLAdapter } from './GraphQLAdapter.mjs';
import { emitDDL, emitPgTap, emitRLS } from './PostgresGeneratorAdapters.mjs';

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
    async writeText(targetPath, content) {
      await writeFile(targetPath, content);
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
    },
    emitDDL(ir, options) {
      return emitDDL(ir, options);
    },
    emitRLS(ir, options) {
      return emitRLS(ir, options);
    },
    emitPgTap(ir, options) {
      return emitPgTap(ir, options);
    }
  };
}

export async function ensureCounterfactualWorkspaceArtifacts(options = {}) {
  return ensureCoreCounterfactualWorkspaceArtifacts(options, createNodeCounterfactualSurfacePort());
}

export async function collectCounterfactualSurfaceModel(options = {}) {
  return collectCoreCounterfactualSurfaceModel(options, createNodeCounterfactualSurfacePort());
}

async function listFilesRecursive(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  files.sort();
  return files;
}
