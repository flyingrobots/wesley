import { isAbsolute, join } from 'node:path';

export const DEFAULT_ARTIFACT_SUBDIRS = {
  ddl: '',
  rls: '',
  migrations: 'migrations',
  pgtap: 'tests',
  tests: 'tests',
  models: 'models',
  zod: 'zod',
  ops: 'ops'
};

function resolveSubdir(baseDir, subdir) {
  if (!subdir || subdir === '.' || subdir === './') return baseDir;
  if (isAbsolute(subdir)) return subdir;
  return join(baseDir, subdir);
}

export function buildOutputPathMap(configPaths = {}, baseDirOverride) {
  const baseDir = baseDirOverride || configPaths.output || 'out';
  const artifactsConfig = configPaths.artifacts || {};
  const map = {
    baseDir
  };

  for (const [category, fallback] of Object.entries(DEFAULT_ARTIFACT_SUBDIRS)) {
    const configured = artifactsConfig[category] ?? fallback;
    map[category] = resolveSubdir(baseDir, configured);
  }

  map.bundleDir = configPaths.bundle || '.wesley';
  const migrationsSubdir = configPaths.migrations ?? DEFAULT_ARTIFACT_SUBDIRS.migrations;
  map.migrationsDir = resolveSubdir(baseDir, migrationsSubdir);

  return map;
}

export function resolveFilePath(baseDir, relativePath) {
  if (!relativePath) return baseDir;
  if (isAbsolute(relativePath)) return relativePath;
  return join(baseDir, relativePath);
}

export function materializeArtifacts(files, category, pathMap) {
  if (!files || files.length === 0) return [];
  const categoryDir = pathMap[category] ?? pathMap.baseDir;

  return files.map((file) => {
    const finalPath = resolveFilePath(categoryDir, file.name);
    return {
      ...file,
      category,
      path: finalPath
    };
  });
}
