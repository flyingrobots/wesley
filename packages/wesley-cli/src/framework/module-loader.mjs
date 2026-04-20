import { existsSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { discoverModules } from '@wesley/core';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXTERNAL_CONTINUUM_MODULE_SPECIFIER = resolvePath(
  __dirname,
  '../../../../../continuum/wesley/continuum-cli-module.mjs'
);
const BOOTSTRAP_CONTINUUM_MODULE_SPECIFIER = resolvePath(__dirname, '../modules/continuum.mjs');

export function resolveDefaultWesleyModuleSpecifiers({ exists = existsSync } = {}) {
  if (exists(EXTERNAL_CONTINUUM_MODULE_SPECIFIER)) {
    return [EXTERNAL_CONTINUUM_MODULE_SPECIFIER];
  }
  return [BOOTSTRAP_CONTINUUM_MODULE_SPECIFIER];
}

export const DEFAULT_WESLEY_MODULE_SPECIFIERS = Object.freeze(
  resolveDefaultWesleyModuleSpecifiers()
);

export const MODULE_OWNED_COMMAND_FILES = Object.freeze(new Set([
  'contract.mjs',
  'witness.mjs',
  'witness-continuum.mjs',
  'drift-watch.mjs',
  'observer-plan.mjs'
]));

const WESLEY_CONFIG_FILE = 'wesley.config.mjs';
const WESLEY_ENV_MODULES = 'WESLEY_MODULES';
const WESLEY_ENV_CONFIG = 'WESLEY_CONFIG';

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

function normalizeModuleSpecifier(specifier, baseDir) {
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

function normalizeModuleEntry(entry, baseDir) {
  if (typeof entry === 'string') {
    return {
      specifier: normalizeModuleSpecifier(entry, baseDir),
      enabled: true
    };
  }

  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  return {
    specifier: normalizeModuleSpecifier(entry.specifier, baseDir),
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

function parseEnvModuleEntries(value, baseDir) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((specifier) => normalizeModuleEntry(specifier, baseDir))
    .filter(Boolean);
}

export function findNearestWesleyConfigPath(startDir, env = process.env) {
  const explicitConfig = typeof env?.[WESLEY_ENV_CONFIG] === 'string'
    ? env[WESLEY_ENV_CONFIG].trim()
    : '';

  if (explicitConfig.length > 0) {
    const resolved = normalizeModuleSpecifier(explicitConfig, startDir);
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

export async function loadWesleyCliModuleEntries({
  cwd = process.cwd(),
  env = process.env,
  defaultSpecifiers = DEFAULT_WESLEY_MODULE_SPECIFIERS
} = {}) {
  const baseDir = resolvePath(cwd);
  const entries = defaultSpecifiers
    .map((specifier) => normalizeModuleEntry(specifier, baseDir))
    .filter(Boolean);

  const configPath = findNearestWesleyConfigPath(baseDir, env);
  if (configPath) {
    const configDir = dirname(configPath);
    const loaded = await import(pathToFileURL(configPath).href);
    const config = loaded?.default ?? {};
    if (Array.isArray(config.modules)) {
      entries.push(
        ...config.modules
          .map((entry) => normalizeModuleEntry(entry, configDir))
          .filter(Boolean)
      );
    }
  }

  entries.push(...parseEnvModuleEntries(env?.[WESLEY_ENV_MODULES], baseDir));
  return dedupeEntries(entries);
}

async function resolveModuleSpecifier(specifier) {
  if (specifier.startsWith('/') || specifier.startsWith('file:')) {
    const url = specifier.startsWith('file:')
      ? specifier
      : pathToFileURL(specifier).href;
    return import(url);
  }
  return import(specifier);
}

export async function discoverAndRegisterWesleyCliModules({
  ctx,
  cwd = process.cwd(),
  env = process.env,
  logger = ctx?.logger ?? nullLogger
} = {}) {
  const entries = await loadWesleyCliModuleEntries({ cwd, env });
  const { modules } = await discoverModules(entries, {
    resolve: resolveModuleSpecifier,
    logger
  });

  for (const module of modules) {
    if (typeof module.registerCliCommands === 'function') {
      await module.registerCliCommands(ctx);
    }
  }

  return { modules, entries };
}
