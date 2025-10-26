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
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  // Prefer globalThis.crypto.subtle (available in browsers and some runtimes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
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
  // Strip BOM and null bytes (defensive)
  return sdl.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
}

export async function createBrowserRuntime() {
  const logger = createConsoleLogger();
  const fs = new MemoryFileSystem();

  // High-resolution clock when available
  const clock = {
    now: () => new Date(),
    hrtime: () => (globalThis.performance?.now?.() ?? Date.now())
  };

  // Tiny SDL detector (no graphql-js): finds `type Name @wes_table { ... }`
  const parsers = {
    graphql: {
      parse: (sdl) => {
        const cleaned = sanitizeGraphQL(sdl);
        const tables = [];
        const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^\{]*)\{/g;
        let m;
        while ((m = re.exec(cleaned)) !== null) {
          const name = m[1];
          const head = m[2] || '';
          const has = /@wes_table\b|@wesley_table\b|\b@table\b/.test(head);
          if (has) tables.push({ name });
        }
        return { tables, toJSON() { return { tables }; } };
      }
    }
  };

  return {
    logger,
    fs,
    clock,
    crypto: { sha256Hex },
    parsers,
    validators: { sanitizeGraphQL }
  };
}
