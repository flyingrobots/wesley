/**
 * @wesley/host-deno — minimal Deno runtime adapter
 * Uses Web APIs and optional Deno.* where useful; keeps FS in-memory for demos.
 */

class MemoryFileSystem {
  private files = new Map<string, string>();
  async exists(p: string) {
    return this.files.has(p);
  }
  async read(p: string) {
    if (!this.files.has(p)) {
      const e = new Error(`ENOENT: ${p}`) as Error & { code?: string };
      e.code = 'ENOENT';
      throw e;
    }
    return this.files.get(p)!;
  }
  async write(p: string, c: string) {
    this.files.set(p, String(c ?? ''));
  }
}

const SMOKE_GENERATED_AT = '1970-01-01T00:00:00.000Z';

async function sha256Hex(input: unknown) {
  const subtle = (globalThis as any).crypto && (globalThis as any).crypto.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this runtime');
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const digest = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createDenoRuntime() {
  const logger = console;
  const fs = new MemoryFileSystem();
  const clock = { now: () => new Date(SMOKE_GENERATED_AT) };
  const parsers = {
    graphql: {
      async parse(sdl: string) {
        // ultra-minimal detector for @wes_table types
        const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^{]*)\{/g;
        const tables: Array<{
          name: string;
          directives: { table: boolean };
          fields: never[];
          indexes: never[];
          constraints: never[];
        }> = [];
        let m: RegExpExecArray | null;
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
          version: '1.0.0' as const,
          metadata: { generatedAt: clock.now().toISOString() },
          tables,
          enums: [] as never[],
          scalars: [] as never[],
          relationships: [] as never[],
          toJSON() {
            return { version: '1.0.0', tables };
          }
        };
      }
    }
  };
  return { logger, fs, clock, crypto: { sha256Hex }, parsers };
}

export async function runInDeno(schemaSDL: string) {
  const rt = await createDenoRuntime();
  const ir = await rt.parsers.graphql.parse(schemaSDL);
  const tables = Array.isArray(ir?.tables) ? ir.tables.length : 0;
  const token = `DENO_HOST_OK:${tables}:${(await rt.crypto.sha256Hex(ir)).slice(0, 12)}`;
  return { ok: true, token, tables };
}
