import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WesleyError } from '@wesley/core';

export const WARPSPACE_KIND = 'wesley.warpspace.v1';
export const WARPSPACE_FILENAME = 'warpspace.mjs';
export const WARPSPACE_LOCAL_FILENAME = '.warpspace.local.mjs';
export const WARPSPACE_ENV_VAR = 'WESLEY_WARPSPACE_FILE';

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
  const baseConfig = await loadWarpspaceModule({
    filePath: resolvedPath,
    label: 'WARPspace file',
    requireKind: true
  });
  const localOverridePath = path.join(rootDir, WARPSPACE_LOCAL_FILENAME);
  const localOverride = existsSync(localOverridePath)
    ? await loadWarpspaceModule({
      filePath: localOverridePath,
      label: 'WARPspace local override',
      requireKind: false
    })
    : null;

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
    const candidate = path.join(current, WARPSPACE_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
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
  return config;
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
  return deepMerge(baseConfig, localOverride);
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

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}
