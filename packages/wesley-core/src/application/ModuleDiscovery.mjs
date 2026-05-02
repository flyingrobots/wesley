import { validateWesleyModule } from '../ports/WesleyModule.mjs';
import { createModuleCapabilityRegistry } from './ModuleCapabilityRegistry.mjs';

function fail(message, code, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause !== undefined) {
    error.cause = cause;
  }
  throw error;
}

function normalizeEntries(entries) {
  if (entries == null) {
    return [];
  }
  if (!Array.isArray(entries)) {
    fail('Module entries must be an array', 'WMOD002');
  }

  return entries.map((entry, index) => {
    if (typeof entry === 'string') {
      return {
        specifier: entry,
        enabled: true,
        config: undefined
      };
    }

    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`modules[${index}] must be a string or non-null object`, 'WMOD002');
    }

    const specifier = typeof entry.specifier === 'string' ? entry.specifier.trim() : '';
    if (specifier.length === 0) {
      fail(`modules[${index}] must have a non-empty "specifier" string`, 'WMOD002');
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
      fail(`modules[${index}].enabled must be a boolean if provided`, 'WMOD002');
    }
    if (entry.config !== undefined && (typeof entry.config !== 'object' || entry.config === null || Array.isArray(entry.config))) {
      fail(`modules[${index}].config must be a plain object if provided`, 'WMOD002');
    }

    return {
      specifier,
      enabled: entry.enabled !== false,
      config: entry.config
    };
  });
}

function extractModule(mod, specifier) {
  if (mod?.default != null) {
    return mod.default;
  }
  if (mod?.wesleyModule != null) {
    return mod.wesleyModule;
  }
  if (mod?.module != null) {
    return mod.module;
  }
  if (mod?.Module != null) {
    return mod.Module;
  }
  fail(
    `Module "${specifier}" has no default, "wesleyModule", "module", or "Module" export`,
    'WMOD003'
  );
}

export async function discoverModules(entries, { resolve, logger }) {
  if (typeof resolve !== 'function') {
    throw new TypeError('discoverModules: "resolve" dependency must be a function');
  }
  if (!logger) {
    throw new TypeError('discoverModules: "logger" dependency is required');
  }

  const normalized = normalizeEntries(entries);
  const modules = [];

  for (const entry of normalized) {
    if (!entry.enabled) {
      logger.debug?.({ specifier: entry.specifier }, `Skipping disabled module "${entry.specifier}"`);
      continue;
    }

    let mod;
    try {
      mod = await resolve(entry.specifier);
    } catch (cause) {
      fail(`Failed to resolve module "${entry.specifier}": ${cause.message}`, 'WMOD003', cause);
    }

    const moduleExport = extractModule(mod, entry.specifier);
    const instance = typeof moduleExport === 'function' ? new moduleExport() : moduleExport;

    try {
      validateWesleyModule(instance);
    } catch (cause) {
      fail(
        `Module "${entry.specifier}" does not satisfy the WesleyModule contract: ${cause.message}`,
        'WMOD004',
        cause
      );
    }

    if (entry.config !== undefined && typeof instance.init === 'function') {
      await instance.init(entry.config);
    }

    modules.push(instance);
  }

  const capabilityRegistry = createModuleCapabilityRegistry(modules);

  return { modules, capabilityRegistry };
}
