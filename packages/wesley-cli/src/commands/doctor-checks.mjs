/**
 * Doctor check functions - Pure/testable diagnostic checks
 *
 * Each check returns { name, status: 'pass'|'fail'|'info', message }
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePlugin } from '@wesley/core/ports';

// ── Check 1: Node.js version ───────────────────────────────────────

/**
 * Verify Node.js version meets >=22.0.0.
 * @param {string} versionString - e.g. "v22.1.0"
 * @returns {{ name: string, status: string, message: string }}
 */
export function checkNodeVersion(versionString) {
  const match = versionString.match(/^v?(\d+)\.(\d+)/);
  if (!match) {
    return { name: 'Node.js', status: 'fail', message: `Unable to parse version: ${versionString}` };
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const ok = major > 22 || (major === 22 && minor >= 0);
  return {
    name: 'Node.js',
    status: ok ? 'pass' : 'fail',
    message: ok
      ? `Node.js ${versionString} (>=22.0.0)`
      : `Node.js ${versionString} does not meet >=22.0.0`
  };
}

// ── Check 2: Config file ───────────────────────────────────────────

/**
 * Verify wesley.config.mjs is present and parseable.
 * @param {{ config: unknown }} ctx
 * @returns {Promise<{ name: string, status: string, message: string }>}
 */
export async function checkConfig(_ctx) {
  const configPath = resolve(process.cwd(), 'wesley.config.mjs');
  const found = existsSync(configPath);
  if (!found) {
    return { name: 'Config', status: 'fail', message: 'wesley.config.mjs not found' };
  }
  try {
    // Attempt dynamic import to verify it parses
    await import(configPath);
    return { name: 'Config', status: 'pass', message: 'Config: wesley.config.mjs' };
  } catch (err) {
    return { name: 'Config', status: 'fail', message: `Config parse error: ${err.message}` };
  }
}

// ── Check 3 & 4: Generator plugins ────────────────────────────────

/**
 * Well-known generator package names (workspace packages).
 * In a future iteration these could be read from config.generators.
 */
const _WELL_KNOWN_GENERATORS = [
  '@wesley/generator-supabase',
  '@wesley/generator-js',
  '@wesley/generator-echo',
  '@wesley/generator-ttd',
  '@wesley/generator-vue'
];

/**
 * Discover generator packages in the workspace.
 * Looks for packages/wesley-generator-* directories with a package.json.
 * Returns an array of { name, entryPoint } where entryPoint is the absolute
 * path to the package's main entry file.
 */
function discoverGeneratorPackages() {
  const packagesDir = resolve(process.cwd(), 'packages');
  if (!existsSync(packagesDir)) return [];

  const entries = [];
  let dirs;
  try {
    dirs = readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const d of dirs) {
    if (!d.isDirectory() || !d.name.startsWith('wesley-generator-')) continue;
    const pkgJsonPath = join(packagesDir, d.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      const main = pkgJson.main || pkgJson.exports?.['.'] || 'src/index.mjs';
      entries.push({
        name: pkgJson.name || `@wesley/${d.name.replace('wesley-', '')}`,
        entryPoint: resolve(packagesDir, d.name, main)
      });
    } catch {
      entries.push({
        name: `@wesley/${d.name.replace('wesley-', '')}`,
        entryPoint: resolve(packagesDir, d.name, 'src/index.mjs')
      });
    }
  }
  return entries;
}

/**
 * Resolve generator packages and validate their GeneratorPlugin exports.
 * @param {{ config: unknown }} ctx
 * @returns {Promise<Array<{ name: string, status: string, message: string }>>}
 */
export async function checkPlugins(ctx) {
  const results = [];

  // If config declares generators as an array (new plugin format), use those.
  // Otherwise discover from workspace directories.
  let packages;
  if (ctx.config && Array.isArray(ctx.config.generators)) {
    packages = ctx.config.generators
      .filter((g) => g.enabled !== false && typeof g.package === 'string')
      .map((g) => ({ name: g.package, entryPoint: null }));
  } else {
    packages = discoverGeneratorPackages();
  }

  if (packages.length === 0) {
    results.push({
      name: 'Plugins',
      status: 'info',
      message: 'Plugins: no generator packages found'
    });
    return results;
  }

  for (const { name: pkg, entryPoint } of packages) {
    // Determine import specifier — use file path when available
    if (entryPoint && !existsSync(entryPoint)) {
      results.push({
        name: `Plugin: ${pkg}`,
        status: 'fail',
        message: `Plugin: ${pkg} — entry point missing (${entryPoint})`
      });
      continue;
    }
    const specifier = entryPoint
      ? pathToFileURL(entryPoint).href
      : pkg;

    try {
      const mod = await import(specifier);
      const PluginClass = findPluginExport(mod);
      if (PluginClass) {
        const instance = new PluginClass();
        validatePlugin(instance);
        results.push({
          name: `Plugin: ${pkg}`,
          status: 'pass',
          message: `Plugin: ${pkg} (apiVersion: ${instance.apiVersion})`
        });
      } else {
        // Package exists but has no GeneratorPlugin — OK for legacy generators
        results.push({
          name: `Plugin: ${pkg}`,
          status: 'pass',
          message: `Plugin: ${pkg} (legacy — no GeneratorPlugin export)`
        });
      }
    } catch (err) {
      results.push({
        name: `Plugin: ${pkg}`,
        status: 'fail',
        message: `Plugin: ${pkg} — ${err.message}`
      });
    }
  }
  return results;
}

/**
 * Find a GeneratorPlugin subclass/duck-typed export in a module.
 * Returns the class constructor or null.
 */
function findPluginExport(mod) {
  for (const key of Object.keys(mod)) {
    const val = mod[key];
    if (typeof val === 'function' && val.prototype) {
      // Duck-type: has apiVersion and plan on prototype or as getter
      const desc = Object.getOwnPropertyDescriptor(val.prototype, 'apiVersion');
      if (desc && (typeof desc.get === 'function' || typeof desc.value === 'string')) {
        return val;
      }
    }
  }
  return null;
}

// ── Check 5: SHA-256 hashing ───────────────────────────────────────

/**
 * Verify SHA-256 hashing is available via the injected crypto adapter.
 * @param {{ crypto: { sha256?: Function } }} ctx
 * @returns {{ name: string, status: string, message: string }}
 */
export function checkHash(ctx) {
  try {
    if (ctx.crypto && typeof ctx.crypto.sha256 === 'function') {
      const digest = ctx.crypto.sha256('test');
      if (typeof digest === 'string' && digest.length === 64) {
        return { name: 'Hash', status: 'pass', message: 'Hash: SHA-256 available' };
      }
    }
    return { name: 'Hash', status: 'fail', message: 'Hash: SHA-256 not available' };
  } catch (err) {
    return { name: 'Hash', status: 'fail', message: `Hash: SHA-256 error — ${err.message}` };
  }
}

// ── Check 6: Experimental flags ────────────────────────────────────

/**
 * Read experimental flags from env vars prefixed with WESLEY_EXPERIMENTAL_.
 * @param {{ env: Record<string, string> }} ctx
 * @returns {{ name: string, status: string, message: string }}
 */
export function checkExperimental(ctx) {
  const env = ctx.env || process.env;
  const flags = {};
  for (const key of Object.keys(env)) {
    if (key.startsWith('WESLEY_EXPERIMENTAL_')) {
      const name = key.replace('WESLEY_EXPERIMENTAL_', '').toLowerCase();
      flags[name] = env[key] === '1' || env[key] === 'true';
    }
  }
  const entries = Object.entries(flags);
  if (entries.length === 0) {
    return { name: 'Experimental', status: 'info', message: 'Experimental: none' };
  }
  const list = entries.map(([k, v]) => `${k}=${v}`).join(', ');
  return { name: 'Experimental', status: 'info', message: `Experimental: ${list}` };
}

// ── Formatters ─────────────────────────────────────────────────────

const STATUS_PREFIX = { pass: '[pass]', fail: '[fail]', info: '[info]' };

/**
 * Format results as human-readable text.
 * @param {Array<{ name: string, status: string, message: string }>} results
 * @returns {string}
 */
export function formatText(results) {
  return results.map((r) => `${STATUS_PREFIX[r.status] || '[????]'} ${r.message}`).join('\n');
}

/**
 * Format results as JSON.
 * @param {Array<{ name: string, status: string, message: string }>} results
 * @returns {string}
 */
export function formatJson(results) {
  const ok = results.every((r) => r.status !== 'fail');
  return JSON.stringify({ ok, checks: results }, null, 2);
}
