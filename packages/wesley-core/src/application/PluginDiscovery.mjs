// wesley-core/src/application/PluginDiscovery.mjs

import { validatePlugin } from '../ports/GeneratorPlugin.mjs';
import { validateConfig, KNOWN_EXPERIMENTAL_FLAGS } from './ConfigValidator.mjs';

/**
 * @typedef {Object} DiscoveryResult
 * @property {import('../ports/GeneratorPlugin.mjs').GeneratorPlugin[]} plugins
 * @property {string[]} warnings
 * @property {Record<string, boolean>} experimental
 */

/**
 * @typedef {Object} DiscoveryDeps
 * @property {(specifier: string) => Promise<object>} resolve
 *   Injected module loader — takes a package name or path, returns the module's
 *   namespace object. Keeps core dependency-free (no node:* imports).
 * @property {import('../ports/Logger.mjs').LoggerPort} logger
 */

/**
 * Discover, load, and validate generator plugins from a wesley config object.
 *
 * This is a separate concern from PluginRunner: PluginDiscovery turns config
 * into validated plugin instances; PluginRunner orchestrates their execution.
 *
 * @param {object} config - The parsed wesley.config.mjs default export (or subset).
 * @param {DiscoveryDeps} deps
 * @returns {Promise<DiscoveryResult>}
 */
export async function discoverPlugins(config, { resolve, logger }) {
  if (typeof resolve !== 'function') {
    throw new TypeError('discoverPlugins: "resolve" dependency must be a function');
  }
  if (!logger) {
    throw new TypeError('discoverPlugins: "logger" dependency is required');
  }

  // Validate config shape
  const validation = validateConfig(config);
  if (!validation.valid) {
    const msg = `Invalid config: ${validation.errors.join('; ')}`;
    const err = new Error(msg);
    err.code = 'WCFG001';
    throw err;
  }

  /** @type {string[]} */
  const warnings = [...validation.warnings];

  // --- Experimental flags ---
  /** @type {Record<string, boolean>} */
  const experimental = Object.create(null);
  for (const flag of KNOWN_EXPERIMENTAL_FLAGS) {
    experimental[flag] = false;
  }

  if (config.experimental) {
    for (const [key, value] of Object.entries(config.experimental)) {
      if (KNOWN_EXPERIMENTAL_FLAGS.includes(key)) {
        experimental[key] = value;
        if (value === true) {
          const warnMsg = `Experimental flag "${key}" is enabled`;
          warnings.push(warnMsg);
          logger.warn({ flag: key }, warnMsg);
        }
      }
      // Unknown flags already warned by validateConfig
    }
  }

  // --- Generators ---
  const generators = config.generators ?? [];
  /** @type {import('../ports/GeneratorPlugin.mjs').GeneratorPlugin[]} */
  const plugins = [];

  for (let i = 0; i < generators.length; i++) {
    const entry = generators[i];

    // Skip disabled generators
    if (entry.enabled === false) {
      logger.debug({ package: entry.package }, `Skipping disabled generator "${entry.package}"`);
      continue;
    }

    // Resolve and import the module
    let mod;
    try {
      mod = await resolve(entry.package);
    } catch (cause) {
      const err = new Error(
        `Failed to resolve generator package "${entry.package}": ${cause.message}`
      );
      err.code = 'WCFG002';
      err.cause = cause;
      throw err;
    }

    // Find the plugin export: default export or named .plugin export
    const pluginExport = _extractPlugin(mod, entry.package);

    // Instantiate if it's a class (has prototype with constructor)
    let pluginInstance;
    if (typeof pluginExport === 'function') {
      try {
        pluginInstance = new pluginExport();
      } catch (cause) {
        const err = new Error(
          `Failed to instantiate generator "${entry.package}": ${cause.message}`
        );
        err.code = 'WCFG003';
        err.cause = cause;
        throw err;
      }
    } else {
      pluginInstance = pluginExport;
    }

    // Validate the plugin contract
    try {
      validatePlugin(pluginInstance);
    } catch (cause) {
      const err = new Error(
        `Generator "${entry.package}" does not satisfy the GeneratorPlugin contract: ${cause.message}`
      );
      err.code = 'WCFG004';
      err.cause = cause;
      throw err;
    }

    // Forward config to init() if provided
    if (entry.config !== undefined && typeof pluginInstance.init === 'function') {
      await pluginInstance.init(entry.config);
    }

    plugins.push(pluginInstance);
  }

  return { plugins, warnings, experimental };
}

/**
 * Extract the plugin from a module namespace object.
 * Prefers `default` export, falls back to named `plugin` export.
 *
 * @param {object} mod - Module namespace
 * @param {string} packageName - For error messages
 * @returns {object|Function}
 * @internal
 */
function _extractPlugin(mod, packageName) {
  // default export
  if (mod.default != null) {
    return mod.default;
  }
  // Named plugin export
  if (mod.plugin != null) {
    return mod.plugin;
  }
  // Named Plugin export (capital P)
  if (mod.Plugin != null) {
    return mod.Plugin;
  }
  const err = new Error(
    `Generator package "${packageName}" has no default, "plugin", or "Plugin" export`
  );
  err.code = 'WCFG002';
  throw err;
}
