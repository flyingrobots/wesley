import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { WesleyError } from '@wesley/core';

export const WARPSPACE_KIND = 'wesley.warpspace.v1';
export const WARPSPACE_FILENAME = 'warpspace.toml';
export const WARPSPACE_LEGACY_FILENAME = 'warpspace.mjs';
export const WARPSPACE_LOCAL_FILENAME = '.warpspace.local.toml';
export const WARPSPACE_LOCAL_LEGACY_FILENAME = '.warpspace.local.mjs';
export const WARPSPACE_ENV_VAR = 'WESLEY_WARPSPACE_FILE';

const WARPSPACE_CANDIDATE_FILENAMES = Object.freeze([
  WARPSPACE_FILENAME,
  WARPSPACE_LEGACY_FILENAME
]);

const WARPSPACE_LOCAL_CANDIDATE_FILENAMES = Object.freeze([
  WARPSPACE_LOCAL_FILENAME,
  WARPSPACE_LOCAL_LEGACY_FILENAME
]);

const FILE_OUTPUT_DEFAULTS = Object.freeze({
  typescript: 'types.generated.ts',
  zod: 'zod.generated.ts'
});

export async function resolveWarpspace({
  cwd = process.cwd(),
  env = process.env,
  warpspacePath = null
} = {}) {
  const resolvedPath = resolveWarpspacePath({
    cwd,
    env,
    warpspacePath
  });
  if (resolvedPath == null) {
    return null;
  }

  const rootDir = path.dirname(resolvedPath);
  const baseConfig = await loadWarpspaceConfig({
    filePath: resolvedPath,
    label: 'WARPspace file',
    requireKind: true
  });
  const localOverridePath = findFirstExistingPath(rootDir, WARPSPACE_LOCAL_CANDIDATE_FILENAMES);
  const localOverride = localOverridePath == null
    ? null
    : await loadWarpspaceConfig({
      filePath: localOverridePath,
      label: 'WARPspace local override',
      requireKind: false
    });

  return {
    path: resolvedPath,
    rootDir,
    localOverridePath: localOverride == null ? null : localOverridePath,
    config: mergeWarpspaceConfigs(baseConfig, localOverride)
  };
}

export async function resolveWarpspaceOutputFile({
  outputKey,
  explicitOutFile = null,
  defaultFileName = null,
  cwd = process.cwd(),
  env = process.env,
  warpspacePath = null
} = {}) {
  const requestedOutFile = normalizeOptionalString(explicitOutFile);
  if (requestedOutFile != null) {
    return requestedOutFile;
  }

  const key = normalizeOptionalString(outputKey);
  if (key == null) {
    return null;
  }

  const warpspace = await resolveWarpspace({ cwd, env, warpspacePath });
  if (warpspace == null) {
    return null;
  }

  const outputs = isPlainObject(warpspace.config.outputs)
    ? warpspace.config.outputs
    : {};
  const configured = outputs[key];
  if (configured == null) {
    return null;
  }

  const resolvedDefaultFileName = normalizeOptionalString(defaultFileName)
    ?? FILE_OUTPUT_DEFAULTS[key]
    ?? `${key}.generated.ts`;

  const resolved = resolveConfiguredOutput({
    configured,
    rootDir: warpspace.rootDir,
    defaultFileName: resolvedDefaultFileName,
    outputKey: key
  });
  return resolved;
}

export async function resolveWarpspaceOutputDir({
  outputKeys,
  explicitOutDir = null,
  defaultOutDir = null,
  cwd = process.cwd(),
  env = process.env,
  warpspacePath = null
} = {}) {
  const requestedOutDir = normalizeOptionalString(explicitOutDir);
  if (requestedOutDir != null) {
    return requestedOutDir;
  }

  const keys = normalizeOutputKeys(outputKeys);
  const warpspace = await resolveWarpspace({ cwd, env, warpspacePath });
  if (warpspace == null) {
    return defaultOutDir;
  }

  const outputs = isPlainObject(warpspace.config.outputs)
    ? warpspace.config.outputs
    : {};

  for (const key of keys) {
    const configured = outputs[key];
    if (configured == null) {
      continue;
    }
    return resolveConfiguredOutputDir({
      configured,
      rootDir: warpspace.rootDir,
      outputKey: key
    });
  }

  return defaultOutDir;
}

function resolveWarpspacePath({ cwd, env, warpspacePath }) {
  const explicitPath = normalizeOptionalString(warpspacePath);
  if (explicitPath != null) {
    const resolvedExplicit = resolveFromRoot(cwd, explicitPath);
    if (!existsSync(resolvedExplicit)) {
      throw new WesleyError(
        'WARPSPACE_NOT_FOUND',
        `WARPspace file not found: ${resolvedExplicit}.`
      );
    }
    return resolvedExplicit;
  }

  const envPath = normalizeOptionalString(env?.[WARPSPACE_ENV_VAR]);
  if (envPath != null) {
    const resolvedEnvPath = resolveFromRoot(cwd, envPath);
    if (!existsSync(resolvedEnvPath)) {
      throw new WesleyError(
        'WARPSPACE_NOT_FOUND',
        `WARPspace file not found: ${resolvedEnvPath}.`
      );
    }
    return resolvedEnvPath;
  }

  return findNearestWarpspace(cwd);
}

function findNearestWarpspace(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = findFirstExistingPath(current, WARPSPACE_CANDIDATE_FILENAMES);
    if (candidate != null) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function findFirstExistingPath(rootDir, candidateFilenames) {
  for (const candidateFilename of candidateFilenames) {
    const candidatePath = path.join(rootDir, candidateFilename);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

async function loadWarpspaceConfig({ filePath, label, requireKind }) {
  return filePath.endsWith('.toml')
    ? loadWarpspaceToml({ filePath, label })
    : loadWarpspaceModule({ filePath, label, requireKind });
}

async function loadWarpspaceToml({ filePath, label }) {
  let config;
  try {
    config = parseToml(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new WesleyError(
      'WARPSPACE_INVALID',
      `${label} at ${filePath} must be valid TOML. ${error.message}`
    );
  }

  if (!isPlainObject(config)) {
    throw new WesleyError(
      'WARPSPACE_INVALID',
      `${label} at ${filePath} must parse to a TOML table.`
    );
  }

  return normalizeWarpspaceConfig(config);
}

async function loadWarpspaceModule({ filePath, label, requireKind }) {
  const moduleUrl = pathToFileURL(filePath).href;
  const loaded = await import(`${moduleUrl}?ts=${Date.now()}`);
  const config = loaded?.default;
  if (!isPlainObject(config)) {
    throw new WesleyError(
      'WARPSPACE_INVALID',
      `${label} at ${filePath} must export a default object.`
    );
  }
  if (requireKind && config.kind !== WARPSPACE_KIND) {
    throw new WesleyError(
      'WARPSPACE_KIND_INVALID',
      `${label} at ${filePath} must declare kind "${WARPSPACE_KIND}".`
    );
  }
  return normalizeWarpspaceConfig(config);
}

function resolveConfiguredOutput({ configured, rootDir, defaultFileName, outputKey }) {
  if (typeof configured === 'string') {
    return resolveOutputValue({
      rootDir,
      outputKey,
      configured,
      defaultFileName
    });
  }

  if (!isPlainObject(configured)) {
    throw new WesleyError(
      'WARPSPACE_OUTPUT_INVALID',
      `WARPspace output "${outputKey}" must be a string or object.`
    );
  }

  const explicitFile = normalizeOptionalString(configured.file);
  if (explicitFile != null) {
    return resolveFromRoot(rootDir, explicitFile);
  }

  const explicitDir = normalizeOptionalString(configured.dir)
    ?? normalizeOptionalString(configured.root);
  if (explicitDir != null) {
    return path.join(resolveFromRoot(rootDir, explicitDir), defaultFileName);
  }

  throw new WesleyError(
    'WARPSPACE_OUTPUT_INVALID',
    `WARPspace output "${outputKey}" must declare "file", "dir", or "root".`
  );
}

function resolveConfiguredOutputDir({ configured, rootDir, outputKey }) {
  if (typeof configured === 'string') {
    const resolved = normalizeOptionalString(configured);
    if (resolved == null) {
      throw new WesleyError(
        'WARPSPACE_OUTPUT_INVALID',
        `WARPspace output "${outputKey}" must not be empty.`
      );
    }
    return resolveFromRoot(rootDir, resolved);
  }

  if (!isPlainObject(configured)) {
    throw new WesleyError(
      'WARPSPACE_OUTPUT_INVALID',
      `WARPspace output "${outputKey}" must be a string or object.`
    );
  }

  const explicitDir = normalizeOptionalString(configured.dir)
    ?? normalizeOptionalString(configured.root);
  if (explicitDir != null) {
    return resolveFromRoot(rootDir, explicitDir);
  }

  throw new WesleyError(
    'WARPSPACE_OUTPUT_INVALID',
    `WARPspace output "${outputKey}" must declare "dir" or "root" when used as an output directory.`
  );
}

function resolveOutputValue({ rootDir, outputKey, configured, defaultFileName }) {
  const resolved = normalizeOptionalString(configured);
  if (resolved == null) {
    throw new WesleyError(
      'WARPSPACE_OUTPUT_INVALID',
      `WARPspace output "${outputKey}" must not be empty.`
    );
  }

  if (path.extname(resolved)) {
    return resolveFromRoot(rootDir, resolved);
  }
  return path.join(resolveFromRoot(rootDir, resolved), defaultFileName);
}

function resolveFromRoot(rootDir, target) {
  return path.isAbsolute(target)
    ? path.normalize(target)
    : path.resolve(rootDir, target);
}

function mergeWarpspaceConfigs(baseConfig, localOverride) {
  if (localOverride == null) {
    return baseConfig;
  }
  return normalizeWarpspaceConfig(deepMerge(baseConfig, localOverride));
}

function deepMerge(baseValue, overrideValue) {
  if (!isPlainObject(baseValue) || !isPlainObject(overrideValue)) {
    return overrideValue;
  }

  const merged = { ...baseValue };
  for (const [key, value] of Object.entries(overrideValue)) {
    if (isPlainObject(value) && isPlainObject(baseValue[key])) {
      merged[key] = deepMerge(baseValue[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWarpspaceConfig(config) {
  if (!isPlainObject(config)) {
    return config;
  }

  const normalized = { ...config };
  if (isPlainObject(normalized.outputs)) {
    normalized.outputs = Object.fromEntries(
      Object.entries(normalized.outputs).map(([key, value]) => [
        normalizeWarpspaceOutputKey(key),
        value
      ])
    );
  }
  return normalized;
}

function normalizeWarpspaceOutputKey(value) {
  return typeof value === 'string'
    ? value.replaceAll('_', '-')
    : value;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeOutputKeys(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeOptionalString(entry))
      .filter(Boolean);
  }
  const single = normalizeOptionalString(value);
  return single == null ? [] : [single];
}
