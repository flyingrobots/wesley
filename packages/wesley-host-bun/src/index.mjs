import { GenerationPipeline } from '../../wesley-core/src/index.mjs';

class MemoryFileSystem {
  constructor(){ this._m = new Map(); }
  async exists(p){ return this._m.has(p); }
  async read(p){
    if(!this._m.has(p)) { const e = new Error(`ENOENT: ${p}`); e.code = 'ENOENT'; throw e; }
    return this._m.get(p);
  }
  async write(p,c){ this._m.set(p, String(c??'')); }
}

async function sha256Hex(input){
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this runtime');
  const d = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function createBunRuntime(){
  const logger = console;
  const fs = new MemoryFileSystem();
  const clock = { now: () => new Date() };
  const parsers = { graphql: { async parse(sdl){
    const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^\{]*)\{/g; const tables=[]; let m;
    while((m=re.exec(sdl))!==null){ if(/@wes_table\b|@wesley_table\b|\b@table\b/.test(m[2]||'')) tables.push({ name:m[1] }); }
    return { tables, toJSON(){ return { tables } } };
  } } };
  return { logger, fs, clock, crypto:{ sha256Hex }, parsers };
}

export async function runInBun(schema){
  const rt = await createBunRuntime();
  const diffEngine = {
    async diff(){ return { steps:[] }; },
    async generateMigration(){ return null; }
  };
  const pipeline = new GenerationPipeline({
    parser: rt.parsers.graphql,
    diffEngine,
    fileSystem: undefined,
    logger: rt.logger
  });
  const bundle = await pipeline.execute(schema, { sha: 'bun-smoke' });
  const tables = Array.isArray(bundle?.schema?.tables)? bundle.schema.tables.length : 0;
  const token = `BUN_HOST_OK:${tables}:${(await rt.crypto.sha256Hex(bundle.schema)).slice(0,12)}`;
  return { ok:true, token, tables };
}
