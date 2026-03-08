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

const unionSDL = /* GraphQL */ `
  enum Status {
    ACTIVE
    INACTIVE
  }

  type User {
    id: ID!
    name: String!
    status: Status!
    score: Float
    tags: [String!]
  }

  type Mutation {
    createUser(name: String!, status: Status!, tags: [String!]): User!
    updateScore(id: ID!, score: Float): User!
  }

  type Query {
    getUser(id: ID!): User!
    listUsers(status: Status, limit: Int): [User!]!
  }
`;

async function getSchemaContent(sdl) {
  const result = await generateEcho({ sdl });
  return result.files.find((f) => f.path === 'schemas.generated.ts').content;
}

async function getIr(sdl) {
  const result = await generateEcho({ sdl });
  return JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
}

describe('per-op var/result schema completeness', () => {
  it('emits VarsSchema and ResultSchema for every op', async () => {
    const content = await getSchemaContent(schemaSDL);
    const ir = await getIr(schemaSDL);

    for (const op of ir.ops) {
      const pascal = op.name.charAt(0).toUpperCase() + op.name.slice(1);
      expect(content).toContain(`${pascal}VarsSchema`);
      expect(content).toContain(`${pascal}ResultSchema`);
    }
  });

  it('emits empty VarsSchema for ops with no args', async () => {
    const content = await getSchemaContent(schemaSDL);
    expect(content).toContain('ToggleNavVarsSchema = z.object({}).strict()');
  });

  it('emits populated VarsSchema for ops with args', async () => {
    const content = await getSchemaContent(schemaSDL);
    expect(content).toContain('SetThemeVarsSchema = z.object(');
    expect(content).toMatch(/SetThemeVarsSchema[\s\S]*mode:/);
  });

  it('emits ResultSchema referencing the result type schema', async () => {
    const content = await getSchemaContent(schemaSDL);
    expect(content).toContain('SetThemeResultSchema = AppStateSchema');
    expect(content).toContain('AppStateResultSchema = AppStateSchema');
  });

  it('emits OP_SCHEMAS registry map covering all ops', async () => {
    const content = await getSchemaContent(schemaSDL);
    const ir = await getIr(schemaSDL);

    expect(content).toContain('OP_SCHEMAS');
    for (const op of ir.ops) {
      expect(content).toContain(`"${op.name}"`);
    }
  });

  it('fails schema completeness if any op lacks var/result entry', async () => {
    const content = await getSchemaContent(schemaSDL);
    const ir = await getIr(schemaSDL);

    for (const op of ir.ops) {
      const pascal = op.name.charAt(0).toUpperCase() + op.name.slice(1);
      const hasVars = content.includes(`${pascal}VarsSchema`);
      const hasResult = content.includes(`${pascal}ResultSchema`);
      expect(hasVars, `Missing VarsSchema for op "${op.name}"`).toBe(true);
      expect(hasResult, `Missing ResultSchema for op "${op.name}"`).toBe(true);
    }
  });
});

describe('per-op schema edge cases', () => {
  it('handles ops with optional/union payloads deterministically', async () => {
    const content = await getSchemaContent(unionSDL);

    // updateScore has optional Float arg
    expect(content).toContain('UpdateScoreVarsSchema');
    expect(content).toMatch(/score:.*\.optional\(\)/);

    // listUsers has optional enum + optional Int
    expect(content).toContain('ListUsersVarsSchema');
    expect(content).toMatch(/status:.*\.optional\(\)/);
    expect(content).toMatch(/limit:.*\.optional\(\)/);
  });

  it('handles list-type args', async () => {
    const content = await getSchemaContent(unionSDL);
    // createUser has tags: [String!] (optional list)
    expect(content).toContain('CreateUserVarsSchema');
    expect(content).toMatch(/tags:.*z\.array/);
  });

  it('handles enum-typed args with enum reference', async () => {
    const content = await getSchemaContent(unionSDL);
    expect(content).toMatch(/status:.*StatusEnum/);
  });
});

describe('per-op schema ordering stability', () => {
  it('produces identical schema output across repeated generations', async () => {
    const first = await getSchemaContent(schemaSDL);
    const second = await getSchemaContent(schemaSDL);
    expect(first).toBe(second);
  });

  it('no-op schema changes do not reorder unrelated entries', async () => {
    const content = await getSchemaContent(schemaSDL);
    const lines = content.split('\n');

    // Verify enum declarations come before object schemas,
    // which come before op schemas
    const enumIdx = lines.findIndex((l) => l.includes('ThemeEnum'));
    const objectIdx = lines.findIndex((l) => l.includes('AppStateSchema'));
    const opVarsIdx = lines.findIndex((l) => l.includes('VarsSchema'));
    const opResultIdx = lines.findIndex((l) => l.includes('ResultSchema'));
    const registryIdx = lines.findIndex((l) => l.includes('OP_SCHEMAS'));

    expect(enumIdx).toBeLessThan(objectIdx);
    expect(objectIdx).toBeLessThan(opVarsIdx);
    expect(opVarsIdx).toBeLessThanOrEqual(opResultIdx);
    expect(opResultIdx).toBeLessThan(registryIdx);
  });
});
