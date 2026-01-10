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
    tags: [String!]
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

const idFor = (name) => createHash('sha256').update(`Mutation:${name}`).digest().readUInt32LE(0);

describe('generateEcho', () => {
  it('emits Wesley IR JSON with types and mutation ids', async () => {
    const result = await generateEcho({ sdl: schemaSDL });
    const irFile = result.files.find((f) => f.path === 'ir.json');

    expect(irFile).toBeDefined();
    const ir = JSON.parse(irFile.content);

    const appState = ir.types.find((t) => t.name === 'AppState');
    const theme = ir.types.find((t) => t.name === 'Theme');

    expect(appState).toBeDefined();
    expect(appState.kind).toBe('OBJECT');
    expect(appState.fields.some((f) => f.name === 'navOpen' && f.type === 'Boolean' && f.required === true)).toBe(true);
    expect(appState.fields.some((f) => f.name === 'tags' && f.type === 'String' && f.list === true && f.required === false)).toBe(true);
    expect(theme).toBeDefined();
    expect(theme.values).toEqual(['LIGHT', 'DARK', 'SYSTEM']);

    expect(ir.mutation_ids).toMatchObject({
      setTheme: idFor('setTheme'),
      toggleNav: idFor('toggleNav'),
      routePush: idFor('routePush'),
    });

    // Include Intent enum of mutation names for downstream Rust.
    const intentEnum = ir.types.find((t) => t.name === 'Intent');
    expect(intentEnum).toBeDefined();
    expect(intentEnum.values).toEqual(['setTheme', 'toggleNav', 'routePush']);
  });
});
