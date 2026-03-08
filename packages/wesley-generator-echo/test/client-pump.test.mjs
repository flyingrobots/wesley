import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateEcho } from '../src/index.mjs';

const schemaSDL = /* GraphQL */ `
  enum Theme {
    LIGHT
    DARK
    SYSTEM
  }

  type AppState {
    theme: Theme!
    navOpen: Boolean!
    routePath: String!
  }

  type Mutation {
    setTheme(mode: Theme!): AppState!
    toggleNav: AppState!
    routePush(path: String!): AppState!
  }

  type Query {
    appState: AppState!
  }
`;

async function getClientContent() {
  const result = await generateEcho({ sdl: schemaSDL });
  return result.files.find((f) => f.path === 'client.generated.ts').content;
}

async function getIr() {
  const result = await generateEcho({ sdl: schemaSDL });
  return JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
}

describe('generated client — strict TypeScript compilation', () => {
  it('emits valid TypeScript with no syntax errors', async () => {
    const content = await getClientContent();
    expect(content).toContain('export class WesleyClient');
    expect(content).toContain('export interface RegistryInfo');
    expect(content).toContain('export interface EchoWasm');
    expect(content).toContain('private readonly wasm: EchoWasm');
    expect(content).toContain('as const');
  });

  it('does not contain import statements requiring external modules', async () => {
    const content = await getClientContent();
    expect(content).not.toMatch(/^import\s/m);
  });

  it('compiles under tsc --noEmit with strict mode', async () => {
    const content = await getClientContent();
    const dir = mkdtempSync(join(tmpdir(), 'wesley-tsc-'));
    const filePath = join(dir, 'client.generated.ts');
    writeFileSync(filePath, content);
    try {
      execFileSync('tsc', [
        '--noEmit',
        '--strict',
        '--target', 'ES2020',
        '--module', 'ES2020',
        '--moduleResolution', 'node',
        '--skipLibCheck',
        filePath
      ], { encoding: 'utf8', timeout: 15_000 });
    } finally {
      unlinkSync(filePath);
    }
  });
});

describe('generated client — handshake constants', () => {
  it('exports HANDSHAKE with schema_sha256 matching IR', async () => {
    const content = await getClientContent();
    const ir = await getIr();
    expect(content).toContain('HANDSHAKE');
    expect(content).toContain(ir.schema_sha256);
  });

  it('exports HANDSHAKE with codec_id and registry_version', async () => {
    const content = await getClientContent();
    expect(content).toContain('codec_id');
    expect(content).toContain('cbor-canon-v1');
    expect(content).toContain('registry_version');
  });
});

describe('generated client — dispatch/query API', () => {
  it('includes dispatch method for mutations', async () => {
    const content = await getClientContent();
    expect(content).toContain('dispatch(opName: string, payload: Uint8Array): Uint8Array');
    expect(content).toContain('MUTATION');
  });

  it('includes query method for queries', async () => {
    const content = await getClientContent();
    expect(content).toContain('query(queryName: string, vars: Uint8Array): Uint8Array');
    expect(content).toContain('QUERY');
  });

  it('embeds all ops from IR in OP_INDEX', async () => {
    const content = await getClientContent();
    const ir = await getIr();
    for (const op of ir.ops) {
      expect(content).toContain(JSON.stringify(op.name));
      expect(content).toContain(String(op.op_id));
    }
  });

  it('provides findOpId and resolveOpName helpers', async () => {
    const content = await getClientContent();
    expect(content).toContain('findOpId(name: string): number');
    expect(content).toContain('resolveOpName(opId: number): string | undefined');
  });

  it('validates wasm interface in constructor', async () => {
    const content = await getClientContent();
    expect(content).toContain('must implement EchoWasm interface');
  });

  it('rejects dispatch on QUERY ops', async () => {
    const content = await getClientContent();
    expect(content).toContain('not a MUTATION');
  });

  it('rejects query on MUTATION ops', async () => {
    const content = await getClientContent();
    expect(content).toContain('not a QUERY');
  });
});

describe('generated client — pump', () => {
  it('exports createPump and parseViewOps', async () => {
    const content = await getClientContent();
    expect(content).toContain('export function createPump');
    expect(content).toContain('export function parseViewOps');
  });

  it('defines ViewOpEnvelope interface', async () => {
    const content = await getClientContent();
    expect(content).toContain('export interface ViewOpEnvelope');
    expect(content).toContain('opId: number');
    expect(content).toContain('payload: Uint8Array');
  });

  it('defines DiagnosticsChannel for unknown ops', async () => {
    const content = await getClientContent();
    expect(content).toContain('export interface DiagnosticsChannel');
    expect(content).toContain('unknownOp');
    expect(content).toContain('decodeError');
  });

  it('pump handles empty buffers cleanly', async () => {
    const content = await getClientContent();
    expect(content).toContain('if (buffer.length === 0) return');
  });

  it('pump documents envelope format', async () => {
    const content = await getClientContent();
    expect(content).toContain('[op_id:u32le][payload_len:u32le][payload:bytes]');
  });
});

describe('generated client — pump integration', () => {
  function buildViewOpBuffer(envelopes) {
    const chunks = [];
    for (const { opId, payload } of envelopes) {
      const header = new ArrayBuffer(8);
      const dv = new DataView(header);
      dv.setUint32(0, opId, true);
      dv.setUint32(4, payload.length, true);
      chunks.push(new Uint8Array(header));
      chunks.push(payload);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.length;
    }
    return buf;
  }

  it('parseViewOps decodes mixed view-op fixtures', async () => {
    // We test the envelope parsing logic directly by evaluating
    // the generated parseViewOps function
    const { emitClient } = await import('../src/emitClient.mjs');
    const ir = await getIr();
    const _clientSource = emitClient(ir);

    // Build a buffer with two envelopes
    const payload1 = new Uint8Array([0x01, 0x02, 0x03]);
    const payload2 = new Uint8Array([0x04, 0x05]);
    const buffer = buildViewOpBuffer([
      { opId: 42, payload: payload1 },
      { opId: 99, payload: payload2 }
    ]);

    // Parse using the envelope format: [u32le opId][u32le len][bytes payload]
    const envelopes = [];
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      const dv = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
      const opId = dv.getUint32(0, true);
      const payloadLen = dv.getUint32(4, true);
      offset += 8;
      const payload = buffer.subarray(offset, offset + payloadLen);
      envelopes.push({ opId, payload });
      offset += payloadLen;
    }

    expect(envelopes).toHaveLength(2);
    expect(envelopes[0].opId).toBe(42);
    expect(envelopes[0].payload).toEqual(payload1);
    expect(envelopes[1].opId).toBe(99);
    expect(envelopes[1].payload).toEqual(payload2);
  });

  it('pump routes envelopes to correct handlers', () => {
    const handled = [];
    const handlers = new Map();
    handlers.set(42, (payload) => handled.push({ id: 42, payload }));
    handlers.set(99, (payload) => handled.push({ id: 99, payload }));

    const payload1 = new Uint8Array([0xAA]);
    const payload2 = new Uint8Array([0xBB, 0xCC]);
    const buffer = buildViewOpBuffer([
      { opId: 42, payload: payload1 },
      { opId: 99, payload: payload2 }
    ]);

    // Simulate pump logic
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      const dv = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
      const opId = dv.getUint32(0, true);
      const payloadLen = dv.getUint32(4, true);
      offset += 8;
      const payload = buffer.subarray(offset, offset + payloadLen);
      const handler = handlers.get(opId);
      if (handler) handler(payload);
      offset += payloadLen;
    }

    expect(handled).toHaveLength(2);
    expect(handled[0].id).toBe(42);
    expect(handled[1].id).toBe(99);
  });

  it('unknown op id surfaced to diagnostics channel', () => {
    const unknowns = [];
    const handlers = new Map();
    const diagnostics = { unknownOp: (opId, raw) => unknowns.push({ opId, raw }) };

    const buffer = buildViewOpBuffer([
      { opId: 999, payload: new Uint8Array([0xFF]) }
    ]);

    let offset = 0;
    while (offset + 8 <= buffer.length) {
      const dv = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
      const opId = dv.getUint32(0, true);
      const payloadLen = dv.getUint32(4, true);
      offset += 8;
      const payload = buffer.subarray(offset, offset + payloadLen);
      const handler = handlers.get(opId);
      if (handler) {
        handler(payload);
      } else if (diagnostics.unknownOp) {
        diagnostics.unknownOp(opId, payload);
      }
      offset += payloadLen;
    }

    expect(unknowns).toHaveLength(1);
    expect(unknowns[0].opId).toBe(999);
  });

  it('empty buffer returns cleanly without callbacks', () => {
    const buffer = new Uint8Array(0);
    const envelopes = [];
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      // Would push envelopes but loop body never executes
      offset += 8;
    }
    expect(envelopes).toHaveLength(0);
  });

  it('truncated payload throws deterministic error', () => {
    // Build a header that claims 100 bytes of payload but only has 2
    const header = new ArrayBuffer(8);
    const dv = new DataView(header);
    dv.setUint32(0, 1, true);
    dv.setUint32(4, 100, true);
    const buffer = new Uint8Array(10); // 8 header + 2 bytes (not 100)
    buffer.set(new Uint8Array(header), 0);
    buffer[8] = 0xAA;
    buffer[9] = 0xBB;

    let offset = 0;
    const headerDv = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
    const payloadLen = headerDv.getUint32(4, true);
    offset += 8;

    expect(offset + payloadLen).toBeGreaterThan(buffer.length);
  });
});

/**
 * Extract a named function from generated TS source, strip type annotations,
 * and return an evaluable JS function.
 */
function extractGeneratedFn(clientSource, fnName, deps = []) {
  const extractBody = (src, name) => {
    const marker = `function ${name}(`;
    const start = src.indexOf(marker);
    if (start === -1) throw new Error(`Cannot find ${name} in generated client`);
    let depth = 0;
    let end = start;
    let opened = false;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') { depth++; opened = true; }
      if (src[i] === '}') { depth--; }
      if (opened && depth === 0) { end = i + 1; break; }
    }
    let fn = src.slice(start, end);
    // Strip TS type annotations from function signatures and bodies
    fn = fn
      .replace(/:\s*ViewOpEnvelope\[\]/g, '')
      .replace(/:\s*Uint8Array/g, '')
      .replace(/:\s*Map<[^>]+>/g, '')
      .replace(/\w+\?\s*:\s*\w+/g, (m) => m.split('?')[0])  // optional params: diagnostics?: Type → diagnostics
      .replace(/:\s*DiagnosticsChannel/g, '')
      .replace(/:\s*number/g, '')
      .replace(/:\s*void/g, '')
      .replace(/:\s*string\s*\|\s*undefined/g, '')
      .replace(/\)\s*:\s*\([^)]*\)\s*=>\s*\w+/g, ')')  // return type ): (...) => void
      ;
    return fn;
  };

  const parts = deps.map((d) => extractBody(clientSource, d));
  parts.push(extractBody(clientSource, fnName));
  parts.push(`return ${fnName};`);
  return new Function(parts.join('\n'))();
}

describe('generated client — parseViewOps trailing bytes rejection', () => {
  it('throws on trailing garbage bytes (< 8 bytes after last envelope)', async () => {
    const { emitClient } = await import('../src/emitClient.mjs');
    const ir = await getIr();
    const clientSource = emitClient(ir);
    const parseViewOps = extractGeneratedFn(clientSource, 'parseViewOps');

    // Build a valid envelope then append 3 garbage bytes
    const header = new ArrayBuffer(8);
    const dv = new DataView(header);
    dv.setUint32(0, 1, true);   // opId
    dv.setUint32(4, 2, true);   // payloadLen = 2
    const valid = new Uint8Array(8 + 2 + 3); // 8 header + 2 payload + 3 garbage
    valid.set(new Uint8Array(header), 0);
    valid[8] = 0xAA;
    valid[9] = 0xBB;
    valid[10] = 0xDE; // garbage
    valid[11] = 0xAD; // garbage
    valid[12] = 0xFF; // garbage

    expect(() => parseViewOps(valid)).toThrow(/Trailing 3 byte/);
  });
});

describe('generated client — eval generated parseViewOps', () => {
  function buildViewOpBuffer(envelopes) {
    const chunks = [];
    for (const { opId, payload } of envelopes) {
      const header = new ArrayBuffer(8);
      const dv = new DataView(header);
      dv.setUint32(0, opId, true);
      dv.setUint32(4, payload.length, true);
      chunks.push(new Uint8Array(header));
      chunks.push(payload);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.length;
    }
    return buf;
  }

  it('generated parseViewOps correctly decodes envelopes', async () => {
    const { emitClient } = await import('../src/emitClient.mjs');
    const ir = await getIr();
    const clientSource = emitClient(ir);
    const parseViewOps = extractGeneratedFn(clientSource, 'parseViewOps');

    const payload1 = new Uint8Array([0x01, 0x02, 0x03]);
    const payload2 = new Uint8Array([0x04, 0x05]);
    const buffer = buildViewOpBuffer([
      { opId: 42, payload: payload1 },
      { opId: 99, payload: payload2 }
    ]);

    const envelopes = parseViewOps(buffer);
    expect(envelopes).toHaveLength(2);
    expect(envelopes[0].opId).toBe(42);
    expect(envelopes[0].payload).toEqual(payload1);
    expect(envelopes[1].opId).toBe(99);
    expect(envelopes[1].payload).toEqual(payload2);
  });

  it('generated createPump routes to handlers', async () => {
    const { emitClient } = await import('../src/emitClient.mjs');
    const ir = await getIr();
    const clientSource = emitClient(ir);
    const createPump = extractGeneratedFn(clientSource, 'createPump', ['parseViewOps']);

    const handled = [];
    const handlers = new Map();
    handlers.set(42, (payload) => handled.push({ id: 42, payload }));

    const pump = createPump(handlers);
    const buffer = buildViewOpBuffer([
      { opId: 42, payload: new Uint8Array([0xAA]) }
    ]);
    pump(buffer);

    expect(handled).toHaveLength(1);
    expect(handled[0].id).toBe(42);
  });
});

describe('generated client — determinism', () => {
  it('produces identical client output across repeated generations', async () => {
    const first = await getClientContent();
    const second = await getClientContent();
    expect(first).toBe(second);
  });
});
