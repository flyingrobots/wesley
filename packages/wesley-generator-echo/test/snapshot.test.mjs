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
  }

  type Query {
    appState: AppState!
  }
`;

const run = async () => {
  const result = await generateEcho({ sdl: schemaSDL });
  return JSON.parse(result.files[0].content);
};

describe('generateEcho determinism', () => {
  it('emits stable IR with version and schema hash', async () => {
    const first = await run();
    const second = await run();

    expect(first).toEqual(second);
    expect(first.ir_version).toBe('echo-ir/v2');
    expect(typeof first.schema_sha256).toBe('string');
    expect(first.schema_sha256.length).toBe(64);
  });
});
