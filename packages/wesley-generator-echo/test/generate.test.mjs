import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
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

describe('generateEcho', () => {
  it('emits Wesley IR JSON with types and ops catalog', async () => {
    const result = await generateEcho({ sdl: schemaSDL });
    const irFile = result.files.find((f) => f.path === 'ir.json');

    expect(irFile).toBeDefined();
    const ir = JSON.parse(irFile.content);

    expect(ir.ir_version).toBe('echo-ir/v1');
    expect(ir.ops).toBeDefined();

    const appState = ir.types.find((t) => t.name === 'AppState');
    const theme = ir.types.find((t) => t.name === 'Theme');
    expect(appState).toBeDefined();
    expect(appState.fields).toHaveLength(3);
    expect(theme.values).toEqual(['LIGHT', 'DARK', 'SYSTEM']);

    const setTheme = ir.ops.find((o) => o.name === 'setTheme' && o.kind === 'MUTATION');
    expect(setTheme.op_id).toBe(hash32('Mutation', 'setTheme'));
    expect(setTheme.args).toEqual([
      { name: 'mode', type: 'Theme', required: true, list: false }
    ]);
    expect(setTheme.result_type).toBe('AppState');

    const appStateQuery = ir.ops.find((o) => o.name === 'appState' && o.kind === 'QUERY');
    expect(appStateQuery.op_id).toBe(hash32('Query', 'appState'));
    expect(appStateQuery.args).toEqual([]);
    expect(appStateQuery.result_type).toBe('AppState');
  });
});
