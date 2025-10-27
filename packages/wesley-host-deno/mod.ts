/**
 * @wesley/host-deno — minimal Deno runtime adapter
 * Uses Web APIs and optional Deno.* where useful; keeps FS in-memory for demos.
 */
import { GenerationPipeline } from "../wesley-core/src/index.mjs";

class MemoryFileSystem {
  private files = new Map<string,string>();
  async exists(p:string){ return this.files.has(p); }
  async read(p:string){ if(!this.files.has(p)) throw new Error(`ENOENT: ${p}`); return this.files.get(p)!; }
  async write(p:string,c:string){ this.files.set(p, String(c ?? "")); }
}

async function sha256Hex(input:unknown){
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function createDenoRuntime(){
  const logger = console;
  const fs = new MemoryFileSystem();
  const clock = { now: () => new Date() };
  const parsers = {
    graphql: {
      async parse(sdl:string){
        // ultra-minimal detector for @wes_table types
        const re = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^\{]*)\{/g; const tables:string[]=[]; let m:RegExpExecArray|null;
        while((m=re.exec(sdl))!==null){ if(/@wes_table\b|@wesley_table\b|\b@table\b/.test(m[2]||'')) tables.push(m[1]); }
        return { tables: tables.map(name=>({name})), toJSON(){ return { tables }; } };
      }
    }
  };
  return { logger, fs, clock, crypto: { sha256Hex }, parsers };
}

export async function runInDeno(schemaSDL:string){
  const rt = await createDenoRuntime();
  const pipeline = new GenerationPipeline({ parser: rt.parsers.graphql, diffEngine: { async diff(){ return { steps: [] }; }, async generateMigration(){ return null; } }, fileSystem: undefined, logger: rt.logger });
  const bundle = await pipeline.execute(schemaSDL, { sha: 'deno-smoke' });
  const tables = Array.isArray(bundle?.schema?.tables)? bundle.schema.tables.length : 0;
  const token = `DENO_HOST_OK:${tables}:${(await rt.crypto.sha256Hex(bundle.schema)).slice(0,12)}`;
  return { ok:true, token, tables };
}

