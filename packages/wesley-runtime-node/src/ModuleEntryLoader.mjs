import { existsSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { discoverModules } from '@wesley/core';

export const DEFAULT_WESLEY_MODULE_SPECIFIERS = Object.freeze([]);
export const WESLEY_CONFIG_FILE = 'wesley.config.mjs';
export const WESLEY_ENV_MODULES = 'WESLEY_MODULES';
export const WESLEY_ENV_CONFIG = 'WESLEY_CONFIG';

const nullLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  }
};

function isPathLike(specifier) {
  return (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('file:')
  );
}

export function normalizeWesleyModuleSpecifier(specifier, baseDir) {
  if (typeof specifier !== 'string' || specifier.trim().length === 0) {
    return null;
  }
  const trimmed = specifier.trim();
  if (trimmed.startsWith('file:')) {
    return fileURLToPath(trimmed);
  }
  if (isPathLike(trimmed)) {
    return isAbsolute(trimmed) ? trimmed : resolvePath(baseDir, trimmed);
  }
  return trimmed;
}

export function normalizeWesleyModuleEntry(entry, baseDir) {
  if (typeof entry === 'string') {
    return {
      specifier: normalizeWesleyModuleSpecifier(entry, baseDir),
      enabled: true
    };
  }

  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  return {
    specifier: normalizeWesleyModuleSpecifier(entry.specifier, baseDir),
    enabled: entry.enabled !== false,
    ...(entry.config === undefined ? {} : { config: entry.config })
  };
}

function dedupeEntries(entries) {
  const bySpecifier = new Map();
  for (const entry of entries) {
    if (entry == null || typeof entry.specifier !== 'string' || entry.specifier.length === 0) {
      continue;
    }
    bySpecifier.set(entry.specifier, entry);
  }
  return [...bySpecifier.values()];
}

export function parseWesleyEnvModuleEntries(value, baseDir) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((specifier) => normalizeWesleyModuleEntry(specifier, baseDir))
    .filter(Boolean);
}

export function findNearestWesleyConfigPath(startDir, env = process.env) {
  const explicitConfig = typeof env?.[WESLEY_ENV_CONFIG] === 'string'
    ? env[WESLEY_ENV_CONFIG].trim()
    : '';

  if (explicitConfig.length > 0) {
    const resolved = normalizeWesleyModuleSpecifier(explicitConfig, startDir);
    return resolved && existsSync(resolved) ? resolved : null;
  }

  let current = resolvePath(startDir);
  while (true) {
    const candidate = resolvePath(current, WESLEY_CONFIG_FILE);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolvePath(current, '..');
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function loadWesleyModuleEntries({
  cwd = process.cwd(),
  env = process.env,
  defaultSpecifiers = DEFAULT_WESLEY_MODULE_SPECIFIERS
} = {}) {
  const baseDir = resolvePath(cwd);
  const entries = defaultSpecifiers
    .map((specifier) => normalizeWesleyModuleEntry(specifier, baseDir))
    .filter(Boolean);

  const configPath = findNearestWesleyConfigPath(baseDir, env);
  if (configPath) {
    const configDir = dirname(configPath);
    const loaded = await import(pathToFileURL(configPath).href);
    const config = loaded?.default ?? {};
    if (Array.isArray(config.modules)) {
      entries.push(
        ...config.modules
          .map((entry) => normalizeWesleyModuleEntry(entry, configDir))
          .filter(Boolean)
      );
    }
  }

  entries.push(...parseWesleyEnvModuleEntries(env?.[WESLEY_ENV_MODULES], baseDir));
  return dedupeEntries(entries);
}

export async function importWesleyModuleSpecifier(specifier) {
  if (specifier.startsWith('/') || specifier.startsWith('file:')) {
    const url = specifier.startsWith('file:')
      ? specifier
      : pathToFileURL(specifier).href;
    return import(url);
  }
  return import(specifier);
}

export async function discoverConfiguredWesleyModules({
  cwd = process.cwd(),
  env = process.env,
  defaultSpecifiers = DEFAULT_WESLEY_MODULE_SPECIFIERS,
  resolve = importWesleyModuleSpecifier,
  logger = nullLogger
} = {}) {
  const entries = await loadWesleyModuleEntries({ cwd, env, defaultSpecifiers });
  const discovered = await discoverModules(entries, {
    resolve,
    logger
  });
  return {
    entries,
    ...discovered
  };
}
