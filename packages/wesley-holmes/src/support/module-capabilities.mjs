import { existsSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const WESLEY_ENV_MODULES = 'WESLEY_MODULES';
export const WESLEY_ENV_CONFIG = 'WESLEY_CONFIG';
export const WESLEY_ENV_DISABLE_MODULES = 'WESLEY_DISABLE_MODULES';
export const WESLEY_ENV_MODULE_ALLOWLIST = 'WESLEY_MODULE_ALLOWLIST';
export const WESLEY_CONFIG_FILE = 'wesley.config.mjs';

const CAPABILITY_COLLECTIONS = Object.freeze({
  holmes: Object.freeze(['scopes', 'checks', 'evidenceCollectors', 'counterfactualProviders']),
  watson: Object.freeze(['verifiers', 'auditProfiles']),
  moriarty: Object.freeze(['policyProfiles', 'judgmentProfiles', 'predictors']),
  cli: Object.freeze(['commands'])
});

const CAPABILITY_AREAS = Object.freeze(Object.keys(CAPABILITY_COLLECTIONS));

const nullLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

export function createModuleCapabilityRegistry(modules = []) {
  if (!Array.isArray(modules)) {
    throw new TypeError('createModuleCapabilityRegistry: "modules" must be an array');
  }

  const capabilities = emptyCapabilities();
  const moduleSummaries = [];

  for (const module of modules) {
    const moduleName = getModuleLabel(module);
    moduleSummaries.push(
      Object.freeze({
        name: moduleName,
        apiVersion: module.apiVersion
      })
    );

    const normalized = normalizeModuleCapabilities(module);
    for (const area of CAPABILITY_AREAS) {
      for (const collection of CAPABILITY_COLLECTIONS[area]) {
        capabilities[area][collection].push(...normalized[area][collection]);
      }
    }
  }

  return {
    modules: Object.freeze(moduleSummaries),
    capabilities: freezeRegistryCapabilities(capabilities)
  };
}

export function listModuleCapabilities(registry, area, collection) {
  return registry?.capabilities?.[area]?.[collection] ?? [];
}

export async function discoverConfiguredHolmesModules({
  cwd = process.cwd(),
  env = process.env,
  resolve = importModuleSpecifier,
  logger = nullLogger
} = {}) {
  const entries = await loadHolmesModuleEntries({ cwd, env });
  const modules = [];

  for (const entry of entries) {
    if (!entry.enabled) {
      logger.debug?.(
        { specifier: entry.specifier },
        `Skipping disabled module "${entry.specifier}"`
      );
      continue;
    }

    let loaded;
    try {
      loaded = await resolve(entry.specifier);
    } catch (cause) {
      throw moduleError(`Failed to resolve module "${entry.specifier}": ${cause.message}`, cause);
    }

    const moduleExport = extractModule(loaded, entry.specifier);
    const instance = typeof moduleExport === 'function' ? new moduleExport() : moduleExport;
    validateHolmesModule(instance);
    if (entry.config !== undefined && typeof instance.init === 'function') {
      await instance.init(entry.config);
    }
    modules.push(instance);
  }

  return {
    entries,
    modules,
    capabilityRegistry: createModuleCapabilityRegistry(modules)
  };
}

export async function loadHolmesModuleEntries({ cwd = process.cwd(), env = process.env } = {}) {
  const baseDir = resolvePath(cwd);
  if (moduleLoadingDisabled(env)) {
    return [];
  }

  const allowlist = parseModuleAllowlist(env?.[WESLEY_ENV_MODULE_ALLOWLIST], baseDir);
  const entries = [];
  const configPath = findNearestHolmesConfigPath(baseDir, env);
  if (configPath) {
    assertAllowlisted(configPath, allowlist, 'config');
    const configDir = dirname(configPath);
    const loaded = await import(pathToFileURL(configPath).href);
    const config = loaded?.default ?? {};
    if (Array.isArray(config.modules)) {
      entries.push(
        ...config.modules.map((entry) => normalizeModuleEntry(entry, configDir)).filter(Boolean)
      );
    }
  }

  entries.push(...parseEnvModuleEntries(env?.[WESLEY_ENV_MODULES], baseDir));
  const deduped = dedupeEntries(entries);
  for (const entry of deduped) {
    if (entry.enabled === false) continue;
    assertAllowlisted(entry.specifier, allowlist, 'module');
  }
  return deduped;
}

function normalizeModuleSpecifier(specifier, baseDir) {
  if (typeof specifier !== 'string' || specifier.trim().length === 0) {
    return null;
  }
  const trimmed = specifier.trim();
  if (trimmed.startsWith('file:')) {
    return fileURLToPath(trimmed);
  }
  if (trimmed.startsWith('.') || trimmed.startsWith('/') || trimmed.startsWith('file:')) {
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

function parseEnvModuleEntries(value, baseDir) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return splitModuleSpecifiers(value)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((specifier) => normalizeModuleEntry(specifier, baseDir))
    .filter(Boolean);
}

function splitModuleSpecifiers(value) {
  if (typeof value !== 'string') {
    return [];
  }
  if (delimiter !== ':') {
    return value.split(delimiter);
  }

  const parts = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ':') continue;
    const candidateScheme = value.slice(start, index);
    const hasUriScheme =
      /^[A-Za-z][A-Za-z0-9+.-]*$/.test(candidateScheme) && value.slice(index, index + 3) === '://';
    if (hasUriScheme) continue;
    parts.push(value.slice(start, index));
    start = index + 1;
  }
  parts.push(value.slice(start));
  return parts;
}

function moduleLoadingDisabled(env = process.env) {
  const raw =
    typeof env?.[WESLEY_ENV_DISABLE_MODULES] === 'string'
      ? env[WESLEY_ENV_DISABLE_MODULES].trim().toLowerCase()
      : '';
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseModuleAllowlist(value, baseDir) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return new Set();
  }

  return new Set(
    splitModuleSpecifiers(value)
      .map((item) => normalizeModuleSpecifier(item, baseDir))
      .filter(Boolean)
  );
}

function findNearestHolmesConfigPath(startDir, env = process.env) {
  const explicitConfig =
    typeof env?.[WESLEY_ENV_CONFIG] === 'string' ? env[WESLEY_ENV_CONFIG].trim() : '';

  if (explicitConfig.length > 0) {
    const resolved = normalizeModuleSpecifier(explicitConfig, startDir);
    if (resolved && existsSync(resolved)) {
      return resolved;
    }
    const error = new Error(
      `${WESLEY_ENV_CONFIG} points to "${resolved ?? explicitConfig}", but that file does not exist.`
    );
    error.code = 'WESLEY_CONFIG_NOT_FOUND';
    throw error;
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

function assertAllowlisted(specifier, allowlist, kind) {
  if (allowlist.size === 0 || allowlist.has(specifier)) {
    return;
  }
  const error = new Error(
    `Holmes ${kind} "${specifier}" is not in ${WESLEY_ENV_MODULE_ALLOWLIST}; refusing to load untrusted module code.`
  );
  error.code = 'WESLEY_MODULE_NOT_ALLOWLISTED';
  throw error;
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

async function importModuleSpecifier(specifier) {
  if (specifier.startsWith('/') || specifier.startsWith('file:')) {
    const url = specifier.startsWith('file:') ? specifier : pathToFileURL(specifier).href;
    return import(url);
  }
  return import(specifier);
}

function extractModule(mod, specifier) {
  if (mod?.default != null) return mod.default;
  if (mod?.wesleyModule != null) return mod.wesleyModule;
  if (mod?.module != null) return mod.module;
  if (mod?.Module != null) return mod.Module;
  throw moduleError(
    `Module "${specifier}" has no default, "wesleyModule", "module", or "Module" export`
  );
}

function validateHolmesModule(module) {
  if (module == null || typeof module !== 'object') {
    throw moduleError('Module must be a non-null object');
  }
  if (module.apiVersion !== '1') {
    throw moduleError(`Module apiVersion must be "1" (got ${String(module.apiVersion)})`);
  }
  if (typeof module.name !== 'string' || module.name.trim().length === 0) {
    throw moduleError('Module "name" must be a non-empty string');
  }
  if (module.init !== undefined && typeof module.init !== 'function') {
    throw moduleError(`Module "${module.name}" init must be a function if provided`);
  }
  if (
    module.capabilities !== undefined &&
    (module.capabilities === null ||
      typeof module.capabilities !== 'object' ||
      Array.isArray(module.capabilities))
  ) {
    throw moduleError(`Module "${module.name}" capabilities must be a plain object if provided`);
  }
}

function normalizeModuleCapabilities(module) {
  const moduleName = getModuleLabel(module);
  const rawCapabilities = module.capabilities;
  const normalized = emptyCapabilities();

  if (rawCapabilities === undefined) {
    return normalized;
  }
  if (!isPlainObject(rawCapabilities)) {
    throw moduleError(`Module "${moduleName}" capabilities must be a plain object if provided`);
  }

  for (const area of Object.keys(rawCapabilities)) {
    if (!CAPABILITY_AREAS.includes(area)) {
      throw moduleError(`Module "${moduleName}" capabilities contains unknown area "${area}".`);
    }

    const areaValue = rawCapabilities[area];
    if (areaValue === undefined) continue;
    if (!isPlainObject(areaValue)) {
      throw moduleError(`Module "${moduleName}" capabilities.${area} must be a plain object.`);
    }

    for (const collection of Object.keys(areaValue)) {
      if (!CAPABILITY_COLLECTIONS[area].includes(collection)) {
        throw moduleError(
          `Module "${moduleName}" capabilities.${area} contains unknown collection "${collection}".`
        );
      }
      const collectionValue = areaValue[collection];
      if (collectionValue === undefined) continue;
      if (!Array.isArray(collectionValue)) {
        throw moduleError(
          `Module "${moduleName}" capabilities.${area}.${collection} must be an array.`
        );
      }
      normalized[area][collection] = collectionValue.map((value) =>
        Object.freeze({
          moduleName,
          value: cloneAndFreeze(value)
        })
      );
    }
  }

  return normalized;
}

function emptyCapabilities() {
  return Object.fromEntries(
    CAPABILITY_AREAS.map((area) => [
      area,
      Object.fromEntries(CAPABILITY_COLLECTIONS[area].map((collection) => [collection, []]))
    ])
  );
}

function freezeRegistryCapabilities(capabilities) {
  for (const area of CAPABILITY_AREAS) {
    for (const collection of CAPABILITY_COLLECTIONS[area]) {
      capabilities[area][collection] = Object.freeze(capabilities[area][collection]);
    }
    capabilities[area] = Object.freeze(capabilities[area]);
  }
  return Object.freeze(capabilities);
}

function getModuleLabel(module) {
  return typeof module?.name === 'string' && module.name.trim() ? module.name.trim() : '<unknown>';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneAndFreeze(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    copy.push(...value.map((item) => cloneAndFreeze(item, seen)));
    return Object.freeze(copy);
  }

  const copy = Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const [key, nestedValue] of Object.entries(value)) {
    copy[key] = cloneAndFreeze(nestedValue, seen);
  }
  return Object.freeze(copy);
}

function moduleError(message, cause) {
  const error = new Error(message);
  error.code = 'WMOD003';
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}
