import { describe, it, expect } from 'vitest';
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

async function generate() {
  return generateEcho({ sdl: schemaSDL });
}

// -----------------------------------------------------------------------
// One-pass atomic output
// -----------------------------------------------------------------------

describe('one-pass profile — atomic generation', () => {
  it('produces all expected artifact sets in a single call', async () => {
    const result = await generate();
    const paths = result.files.map((f) => f.path);

    // IR
    expect(paths).toContain('ir.json');
    // TypeScript
    expect(paths).toContain('ops.generated.ts');
    expect(paths).toContain('schemas.generated.ts');
    expect(paths).toContain('client.generated.ts');
    expect(paths).toContain('raw_le_codec.generated.ts');
    // Rust
    expect(paths).toContain('raw_le_codec.generated.rs');
  });

  it('returns profile metadata describing the artifact sets', async () => {
    const result = await generate();
    expect(result.profile).toBeDefined();
    expect(result.profile.name).toBe('app');
    expect(result.profile.targets.ir).toContain('ir.json');
    expect(result.profile.targets.typescript.length).toBeGreaterThan(0);
    expect(result.profile.targets.rust.length).toBeGreaterThan(0);
    expect(result.profile.artifact_count).toBe(result.files.length);
  });

  it('all TS files are in the typescript target list', async () => {
    const result = await generate();
    const tsFiles = result.files.filter((f) => f.path.endsWith('.ts'));
    for (const f of tsFiles) {
      expect(result.profile.targets.typescript).toContain(f.path);
    }
  });

  it('all RS files are in the rust target list', async () => {
    const result = await generate();
    const rsFiles = result.files.filter((f) => f.path.endsWith('.rs'));
    for (const f of rsFiles) {
      expect(result.profile.targets.rust).toContain(f.path);
    }
  });
});

// -----------------------------------------------------------------------
// Cross-artifact parity
// -----------------------------------------------------------------------

describe('one-pass profile — cross-artifact parity', () => {
  it('op IDs in IR match those in ops.generated.ts', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const opsTs = result.files.find((f) => f.path === 'ops.generated.ts').content;

    for (const op of ir.ops) {
      expect(opsTs).toContain(`name: "${op.name}"`);
      expect(opsTs).toContain(`op_id: ${op.op_id}`);
    }
  });

  it('op IDs in IR match those in client.generated.ts', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const clientTs = result.files.find((f) => f.path === 'client.generated.ts').content;

    for (const op of ir.ops) {
      expect(clientTs).toContain(String(op.op_id));
    }
  });

  it('schema hash in IR matches ops.generated.ts SCHEMA_SHA256', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const opsTs = result.files.find((f) => f.path === 'ops.generated.ts').content;

    expect(opsTs).toContain(`SCHEMA_SHA256 = "${ir.schema_sha256}"`);
  });

  it('schema hash in IR matches client.generated.ts HANDSHAKE', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const clientTs = result.files.find((f) => f.path === 'client.generated.ts').content;

    expect(clientTs).toContain(ir.schema_sha256);
  });

  it('contract version in IR matches ops.generated.ts', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const opsTs = result.files.find((f) => f.path === 'ops.generated.ts').content;

    expect(opsTs).toContain(`CONTRACT_VERSION = "${ir.contract_version}"`);
  });

  it('type names in IR match type names in schemas.generated.ts', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const schemasTs = result.files.find((f) => f.path === 'schemas.generated.ts').content;

    for (const t of ir.types) {
      if (t.kind === 'ENUM') {
        expect(schemasTs).toContain(`${t.name}Enum`);
      } else if (t.kind === 'OBJECT') {
        expect(schemasTs).toContain(`${t.name}Schema`);
      }
    }
  });

  it('type names in IR match encode/decode in raw_le_codec.generated.ts', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const codecTs = result.files.find((f) => f.path === 'raw_le_codec.generated.ts').content;

    for (const t of ir.types) {
      expect(codecTs).toContain(`encode${t.name}`);
      expect(codecTs).toContain(`decode${t.name}`);
    }
  });

  it('type names in IR match encode/decode in raw_le_codec.generated.rs', async () => {
    const result = await generate();
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const codecRs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    for (const t of ir.types) {
      expect(codecRs).toContain(`impl ${t.name}`);
      expect(codecRs).toContain('encode_raw_le');
      expect(codecRs).toContain('decode_raw_le');
    }
  });
});

// -----------------------------------------------------------------------
// No duplicate intermediate transforms
// -----------------------------------------------------------------------

describe('one-pass profile — no duplicate transforms', () => {
  it('single invocation produces both TS and Rust codecs from same IR', async () => {
    const result = await generate();
    const tsCodec = result.files.find((f) => f.path === 'raw_le_codec.generated.ts');
    const rsCodec = result.files.find((f) => f.path === 'raw_le_codec.generated.rs');

    // Both exist from a single generateEcho() call
    expect(tsCodec).toBeDefined();
    expect(rsCodec).toBeDefined();

    // Both reference the same type set
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    for (const t of ir.types) {
      expect(tsCodec.content).toContain(t.name);
      expect(rsCodec.content).toContain(t.name);
    }
  });
});

// -----------------------------------------------------------------------
// Performance baseline
// -----------------------------------------------------------------------

describe('one-pass profile — performance', () => {
  it('generates all artifacts within reasonable time', async () => {
    const start = performance.now();
    await generate();
    const elapsed = performance.now() - start;

    // One-pass should be fast — well under 1 second for this schema
    expect(elapsed).toBeLessThan(1000);
  });

  it('repeated generation has stable performance', async () => {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await generate();
      times.push(performance.now() - start);
    }

    // Exclude first run (JIT warmup), then verify remaining runs are stable
    const warmed = times.slice(1);
    const sorted = [...warmed].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const t of warmed) {
      expect(t).toBeLessThan(median * 5);
    }
  });
});
