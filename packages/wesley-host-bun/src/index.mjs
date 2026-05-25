class MemoryFileSystem {
  constructor() {
    this._m = new Map();
  }
  async exists(p) {
    return this._m.has(p);
  }
  async read(p) {
    if (!this._m.has(p)) {
      const e = new Error(`ENOENT: ${p}`);
      e.code = 'ENOENT';
      throw e;
    }
    return this._m.get(p);
  }
  async write(p, c) {
    this._m.set(p, String(c ?? ''));
  }
}

const SMOKE_GENERATED_AT = '1970-01-01T00:00:00.000Z';

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this runtime');
  const d = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createBunRuntime() {
  const logger = console;
  const fs = new MemoryFileSystem();
  const clock = { now: () => new Date(SMOKE_GENERATED_AT) };
  // NOTE: Minimal regex-based SDL detector; not production-quality.
  // - Does not support multi-line directives or complex GraphQL syntax
  // - Used only for smoke-level tests to keep the bundle small
  const parsers = {
    graphql: {
      async parse(sdl) {
        const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^{]*)\{/g;
        const tables = [];
        let m;
        while ((m = re.exec(sdl)) !== null) {
          if (/@wes_table\b|@wesley_table\b|\b@table\b/.test(m[2] || ''))
            tables.push({
              name: m[1],
              directives: { table: true },
              fields: [],
              indexes: [],
              constraints: []
            });
        }
        return {
          version: '1.0.0',
          metadata: { generatedAt: clock.now().toISOString() },
          tables,
          enums: [],
          scalars: [],
          relationships: [],
          toJSON() {
            return { version: '1.0.0', tables };
          }
        };
      }
    }
  };
  return { logger, fs, clock, crypto: { sha256Hex }, parsers };
}

export async function runInBun(schema) {
  const rt = await createBunRuntime();
  const ir = await rt.parsers.graphql.parse(schema);
  const tables = Array.isArray(ir?.tables) ? ir.tables.length : 0;
  const token = `BUN_HOST_OK:${tables}:${(await rt.crypto.sha256Hex(ir)).slice(0, 12)}`;
  return { ok: true, token, tables };
}
