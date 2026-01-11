import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
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

const hash32 = (ns, name) => createHash('sha256').update(`${ns}:${name}`).digest().readUInt32LE(0);

function evalOpsGeneratedTs(source) {
  const sanitized = source.replaceAll('export ', '');
  const wrapped = `${sanitized}\n\nglobalThis.__exports = { SCHEMA_SHA256, REGISTRY_VERSION, CODEC_ID, OPS, findOpId };`;
  const context = vm.createContext({});
  vm.runInContext(wrapped, context);
  return context.__exports;
}

describe('generated ops helpers (ops.generated.ts)', () => {
  it('exports OPS + findOpId wired to the ops catalog (golden path)', async () => {
    const out = await generateEcho({ sdl: schemaSDL });
    const ir = JSON.parse(out.files.find((f) => f.path === 'ir.json').content);
    const opsSource = out.files.find((f) => f.path === 'ops.generated.ts').content;

    const opsModule = evalOpsGeneratedTs(opsSource);

    expect(opsModule.SCHEMA_SHA256).toBe(ir.schema_sha256);
    expect(opsModule.CODEC_ID).toBe(ir.codec_id);
    expect(opsModule.REGISTRY_VERSION).toBe(ir.registry_version);

    // Generated helper data should match the IR ops catalog.
    expect(opsModule.OPS).toEqual(
      ir.ops.map(({ kind, name, op_id, result_type, args }) => ({
        kind,
        name,
        op_id,
        result_type,
        args,
      }))
    );

    // Helper behavior: lookups by name return the frozen op ID.
    expect(opsModule.findOpId('setTheme')).toBe(hash32('Mutation', 'setTheme'));
    expect(opsModule.findOpId('appState')).toBe(hash32('Query', 'appState'));
  });

  it('throws on unknown op name (known failure mode)', async () => {
    const out = await generateEcho({ sdl: schemaSDL });
    const opsSource = out.files.find((f) => f.path === 'ops.generated.ts').content;

    const opsModule = evalOpsGeneratedTs(opsSource);
    expect(() => opsModule.findOpId('doesNotExist')).toThrow(/unknown op name/i);
  });

  it('is deterministic across SDL field order (edge case)', async () => {
    const sdlA = /* GraphQL */ `
      type Mutation {
        routePush(path: String!): AppState!
        toggleNav: AppState!
        setTheme(mode: Theme!): AppState!
      }

      type Query {
        appState: AppState!
      }

      enum Theme { LIGHT DARK SYSTEM }
      type AppState { theme: Theme! navOpen: Boolean! routePath: String! }
    `;

    const sdlB = /* GraphQL */ `
      type Mutation {
        setTheme(mode: Theme!): AppState!
        toggleNav: AppState!
        routePush(path: String!): AppState!
      }

      type Query {
        appState: AppState!
      }

      enum Theme { LIGHT DARK SYSTEM }
      type AppState { theme: Theme! navOpen: Boolean! routePath: String! }
    `;

    const outA = await generateEcho({ sdl: sdlA });
    const outB = await generateEcho({ sdl: sdlB });

    const opsA = evalOpsGeneratedTs(outA.files.find((f) => f.path === 'ops.generated.ts').content);
    const opsB = evalOpsGeneratedTs(outB.files.find((f) => f.path === 'ops.generated.ts').content);

    // Schema hashes differ when SDL string changes, but the ops catalog (and derived helpers) must remain stable.
    expect(opsA.OPS).toEqual(opsB.OPS);
  });
});
