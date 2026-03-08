import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';
import { emitJoinImpls } from '../src/emitJoinImpls.mjs';

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

const noJoinSDL = /* GraphQL */ `
  type AppState {
    theme: String!
    navOpen: Boolean!
  }

  type Query {
    appState: AppState!
  }
`;

const multiTypeSDL = /* GraphQL */ `
  type GameState {
    players: [String!]! @wes_join(strategy: "union")
    name: String!
  }

  type ScoreBoard {
    topScore: Int! @wes_join(strategy: "max")
  }

  type PlainData {
    label: String!
  }

  type Query {
    game: GameState!
    scores: ScoreBoard!
    data: PlainData!
  }
`;

describe('has_join IR metadata', () => {
  it('sets has_join: true on type with @wes_join fields', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

    const gameState = ir.types.find((t) => t.name === 'GameState');
    expect(gameState.has_join).toBe(true);
  });

  it('sets has_join: false on type without @wes_join fields', async () => {
    const result = await generateEcho({ sdl: noJoinSDL });
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

    const appState = ir.types.find((t) => t.name === 'AppState');
    expect(appState.has_join).toBe(false);
  });

  it('sets has_join correctly across multiple types', async () => {
    const result = await generateEcho({ sdl: multiTypeSDL });
    const ir = JSON.parse(result.files.find((f) => f.path === 'ir.json').content);

    expect(ir.types.find((t) => t.name === 'GameState').has_join).toBe(true);
    expect(ir.types.find((t) => t.name === 'ScoreBoard').has_join).toBe(true);
    expect(ir.types.find((t) => t.name === 'PlainData').has_join).toBe(false);
  });

  it('has_join is present in serialized JSON', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const irJson = result.files.find((f) => f.path === 'ir.json').content;
    expect(irJson).toContain('"has_join"');
  });
});

describe('Rust JoinFn codegen', () => {
  it('generates join.generated.rs for schemas with @wes_join', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const joinFile = result.files.find((f) => f.path === 'join.generated.rs');
    expect(joinFile).toBeDefined();
  });

  it('does not generate join.generated.rs when no @wes_join fields', async () => {
    const result = await generateEcho({ sdl: noJoinSDL });
    const joinFile = result.files.find((f) => f.path === 'join.generated.rs');
    expect(joinFile).toBeUndefined();
  });

  it('emits use statement for echo_lattice', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const joinFile = result.files.find((f) => f.path === 'join.generated.rs');
    expect(joinFile.content).toContain('use echo_lattice::{JoinFn, lattice};');
  });

  it('emits impl JoinFn block for type with join fields', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain('impl JoinFn for GameState {');
    expect(rs).toContain('fn join(&self, other: &Self) -> Self {');
  });

  it('generates lattice::union for "union" strategy', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain('players: lattice::union(&self.players, &other.players),');
  });

  it('generates lattice::max for "max" strategy', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain('max_score: lattice::max(self.max_score, other.max_score),');
  });

  it('generates lattice::lww for "lww" strategy', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain(
      'last_update: lattice::lww(self.last_update.clone(), other.last_update.clone()),'
    );
  });

  it('copies field from self when no join strategy', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain('name: self.name.clone(),');
  });

  it('generates impl blocks only for types with has_join=true', async () => {
    const result = await generateEcho({ sdl: multiTypeSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain('impl JoinFn for GameState {');
    expect(rs).toContain('impl JoinFn for ScoreBoard {');
    expect(rs).not.toContain('impl JoinFn for PlainData');
  });

  it('converts camelCase field names to snake_case in Rust', async () => {
    const result = await generateEcho({ sdl: joinSDL });
    const rs = result.files.find((f) => f.path === 'join.generated.rs').content;

    expect(rs).toContain('max_score');
    expect(rs).toContain('last_update');
    expect(rs).not.toContain('maxScore');
    expect(rs).not.toContain('lastUpdate');
  });
});

describe('emitJoinImpls edge cases', () => {
  it('returns null for IR with no types', () => {
    expect(emitJoinImpls({ types: [] })).toBeNull();
  });

  it('returns null for IR with only ENUM types', () => {
    expect(emitJoinImpls({
      types: [{ name: 'Status', kind: 'ENUM', has_join: false, values: ['A', 'B'] }]
    })).toBeNull();
  });

  it('returns null when all OBJECT types have has_join=false', () => {
    expect(emitJoinImpls({
      types: [{
        name: 'Foo',
        kind: 'OBJECT',
        has_join: false,
        fields: [{ name: 'x', join: null }]
      }]
    })).toBeNull();
  });

  it('throws on unknown join strategy', () => {
    expect(() =>
      emitJoinImpls({
        types: [{
          name: 'Bad',
          kind: 'OBJECT',
          has_join: true,
          fields: [{ name: 'x', join: { strategy: 'unknown_strat' } }]
        }]
      })
    ).toThrow(/Unknown join strategy/);
  });

  it('includes DO NOT EDIT comment', () => {
    const result = emitJoinImpls({
      types: [{
        name: 'T',
        kind: 'OBJECT',
        has_join: true,
        fields: [{ name: 'x', join: { strategy: 'max' } }]
      }]
    });
    expect(result).toContain('DO NOT EDIT');
  });
});
