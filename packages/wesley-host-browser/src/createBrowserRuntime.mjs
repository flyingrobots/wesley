/**
 * Browser Runtime Composition
 * Pure ESM, no Node built-ins. Uses Web APIs only.
 */

// Minimal console-backed logger compatible with LoggerPort shape
function createConsoleLogger() {
  const base = {
    debug: (...a) => console.debug('[wesley]', ...a),
    info: (...a) => console.info('[wesley]', ...a),
    warn: (...a) => console.warn('[wesley]', ...a),
    error: (...a) => console.error('[wesley]', ...a),
    setLevel: () => {},
    async flush() {}
  };
  base.child = () => base;
  return base;
}

// In-memory file store for smoke tests (NOT persistent)
class MemoryFileSystem {
  constructor() { this._files = new Map(); }
  async exists(path) { return this._files.has(path); }
  async read(path) {
    if (!this._files.has(path)) throw new Error(`ENOENT: ${path}`);
    return this._files.get(path);
  }
  async write(path, content) { this._files.set(path, String(content ?? '')); }
}

// Web Crypto helpers
async function sha256Hex(input) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this runtime');
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  // Prefer globalThis.crypto.subtle (available in browsers and some runtimes)
  const digest = await subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function byteLengthUtf8(str) {
  return new TextEncoder().encode(str).length;
}

function sanitizeGraphQL(sdl, { maxBytes = 5 * 1024 * 1024 } = {}) {
  if (typeof sdl !== 'string') throw new Error('Schema must be a string');
  if (byteLengthUtf8(sdl) > maxBytes) {
    const e = new Error(`Schema exceeds max size (${maxBytes} bytes)`);
    e.code = 'EINPUTSIZE';
    throw e;
  }
  // Strip BOM without control chars in regex; defensively drop null bytes
  let out = sdl;
  if (out.length && out.charCodeAt(0) === 0xFEFF) out = out.slice(1);
  if (out.indexOf('\0') !== -1) out = out.split('\0').join('');
  return out;
}

import { BrowserParserPort } from './BrowserParserPort.mjs';

export async function createBrowserRuntime() {
  const logger = createConsoleLogger();
  const fs = new MemoryFileSystem();

  // High-resolution clock when available
  const clock = {
    now: () => new Date(),
    hrtime: () => (globalThis.performance?.now?.() ?? Date.now())
  };

  const parsers = { graphql: new BrowserParserPort() };

  return {
    logger,
    fs,
    clock,
    crypto: { sha256Hex },
    parsers,
    validators: { sanitizeGraphQL }
  };
}
