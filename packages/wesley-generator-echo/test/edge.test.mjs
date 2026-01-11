import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';

describe('generateEcho edge cases', () => {
  it('throws on missing SDL (known failure mode)', async () => {
    await expect(generateEcho()).rejects.toThrow(/SDL string is required/i);
    await expect(generateEcho({})).rejects.toThrow(/SDL string is required/i);
    await expect(generateEcho({ sdl: '' })).rejects.toThrow(/SDL string is required/i);
  });

  it('throws on invalid SDL (known failure mode)', async () => {
    const invalidSDL = /* GraphQL */ `
      type Query {
        appState: AppState!
    `;

    await expect(generateEcho({ sdl: invalidSDL })).rejects.toThrow();
  });

  it('emits stable ops ordering regardless of field order', async () => {
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

    const irA = JSON.parse(outA.files.find((f) => f.path === 'ir.json').content);
    const irB = JSON.parse(outB.files.find((f) => f.path === 'ir.json').content);

    // ops should be identical despite field order differences.
    expect(irA.ops).toEqual(irB.ops);
  });

  it('handles missing Mutation type gracefully (query ops still emitted)', async () => {
    const sdl = /* GraphQL */ `
      type Query {
        appState: String!
      }
    `;

    const out = await generateEcho({ sdl });
    const ir = JSON.parse(out.files.find((f) => f.path === 'ir.json').content);
    expect(ir.ops).toHaveLength(1);
    expect(ir.ops[0].kind).toBe('QUERY');
    expect(ir.ops[0].name).toBe('appState');
  });
});
