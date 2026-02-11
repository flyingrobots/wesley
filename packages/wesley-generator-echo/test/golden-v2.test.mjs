import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateEcho } from '../src/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const basicSDL = /* GraphQL */ `
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

const joinSDL = /* GraphQL */ `
  type GameState {
    players: [String!]! @wes_join(strategy: "union")
    maxScore: Int! @wes_join(strategy: "max")
    lastUpdate: String @wes_join(strategy: "lww")
    name: String!
  }

  type Query {
    game: GameState!
  }
`;

describe('golden v2 IR fixtures', () => {
  it('basic schema matches golden fixture (basic-v2.ir.json)', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const actual = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const expected = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', 'basic-v2.ir.json'), 'utf-8')
    );
    expect(actual).toEqual(expected);
  });

  it('join-annotated schema matches golden fixture (joins-v2.ir.json)', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const actual = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
    const expected = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', 'joins-v2.ir.json'), 'utf-8')
    );
    expect(actual).toEqual(expected);
  });
});
