import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';

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

describe('echo-ir/v2 format', () => {
  describe('top-level fields', () => {
    it('emits ir_version "echo-ir/v2"', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
      expect(ir.ir_version).toBe('echo-ir/v2');
    });

    it('emits both schema_sha256 (v1 compat) and schema_hash (v2)', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      expect(typeof ir.schema_sha256).toBe('string');
      expect(ir.schema_sha256).toHaveLength(64);
      expect(ir.schema_hash).toBe(ir.schema_sha256);
    });

    it('emits registry_hash as null (placeholder for EchoPlugin)', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
      expect(ir).toHaveProperty('registry_hash');
      expect(ir.registry_hash).toBeNull();
    });

    it('emits hash_chain as null (placeholder for EchoPlugin)', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
      expect(ir).toHaveProperty('hash_chain');
      expect(ir.hash_chain).toBeNull();
    });
  });

  describe('per-type fields', () => {
    it('adds type_id equal to type name for OBJECT types', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const appState = ir.types.find((t) => t.name === 'AppState');
      expect(appState.type_id).toBe('AppState');
    });

    it('adds type_id equal to type name for ENUM types', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const theme = ir.types.find((t) => t.name === 'Theme');
      expect(theme.type_id).toBe('Theme');
    });

    it('emits layout_hash as 64-char hex for all types', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      for (const type of ir.types) {
        expect(type).toHaveProperty('layout_hash');
        expect(type.layout_hash).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });

  describe('per-field join metadata', () => {
    it('emits join: null for fields without @wes_join', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const appState = ir.types.find((t) => t.name === 'AppState');
      for (const field of appState.fields) {
        expect(field).toHaveProperty('join');
        expect(field.join).toBeNull();
      }
    });

    it('emits join with strategy for @wes_join(strategy: "union")', async () => {
      const result = await generateEcho({ sdl: joinSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const gameState = ir.types.find((t) => t.name === 'GameState');
      const players = gameState.fields.find((f) => f.name === 'players');
      expect(players.join).toEqual({ strategy: 'union' });
    });

    it('emits join with strategy for @wes_join(strategy: "max")', async () => {
      const result = await generateEcho({ sdl: joinSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const gameState = ir.types.find((t) => t.name === 'GameState');
      const maxScore = gameState.fields.find((f) => f.name === 'maxScore');
      expect(maxScore.join).toEqual({ strategy: 'max' });
    });

    it('emits join with strategy for @wes_join(strategy: "lww")', async () => {
      const result = await generateEcho({ sdl: joinSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const gameState = ir.types.find((t) => t.name === 'GameState');
      const lastUpdate = gameState.fields.find((f) => f.name === 'lastUpdate');
      expect(lastUpdate.join).toEqual({ strategy: 'lww' });
    });

    it('emits join: null for field without directive in mixed type', async () => {
      const result = await generateEcho({ sdl: joinSDL });
      const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

      const gameState = ir.types.find((t) => t.name === 'GameState');
      const name = gameState.fields.find((f) => f.name === 'name');
      expect(name.join).toBeNull();
    });
  });

  describe('null fields are explicit (not absent)', () => {
    it('all v2 fields are present in serialized JSON', async () => {
      const result = await generateEcho({ sdl: basicSDL });
      const irJson = result.files.find((f) => f.path === 'ir.json').content;
      const ir = JSON.parse(irJson);

      // Top-level v2 fields present in JSON text
      expect(irJson).toContain('"schema_hash"');
      expect(irJson).toContain('"registry_hash"');
      expect(irJson).toContain('"hash_chain"');

      // Per-type fields present
      for (const type of ir.types) {
        expect(type).toHaveProperty('type_id');
        expect(type).toHaveProperty('layout_hash');
      }

      // Per-field join present for OBJECT types
      const objectTypes = ir.types.filter((t) => t.kind === 'OBJECT');
      for (const type of objectTypes) {
        for (const field of type.fields) {
          expect(field).toHaveProperty('join');
        }
      }
    });
  });
});
