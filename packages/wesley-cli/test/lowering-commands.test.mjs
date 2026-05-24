import test from 'node:test';
import assert from 'node:assert/strict';

import { TypeScriptCommand } from '../src/commands/typescript.mjs';
import { ZodCommand } from '../src/commands/zod.mjs';

const noopLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return this;
  }
};

const sampleSdl = 'type User @table { id: ID! @pk email: String! createdAt: DateTime! }';
const sampleIr = {
  tables: [
    {
      name: 'User',
      directives: { table: true },
      fields: [
        {
          name: 'id',
          type: { base: 'ID', isList: false },
          nullable: false,
          directives: { pk: true }
        },
        {
          name: 'email',
          type: { base: 'String', isList: false },
          nullable: false,
          directives: {}
        },
        {
          name: 'createdAt',
          type: { base: 'DateTime', isList: false },
          nullable: false,
          directives: {}
        }
      ],
      indexes: []
    }
  ],
  relationships: []
};

const familySdl = `
scalar Hash

enum AdmissionOutcomeKind {
  DERIVED
  PLURAL
}

input ReplaceNeighborhoodInput {
  siteId: ID!
}

type NeighborhoodParticipant {
  laneId: ID!
  stateHash: Hash!
}

type NeighborhoodCore {
  siteId: ID!
  outcomeKind: AdmissionOutcomeKind!
  participants: [NeighborhoodParticipant!]!
}

type Query {
  neighborhoodCores: [NeighborhoodCore!]!
}

type Mutation {
  replaceNeighborhood(input: ReplaceNeighborhoodInput!): NeighborhoodCore!
}
`;

const familyIr = {
  tables: [],
  enums: [],
  scalars: [],
  relationships: []
};

function makeCtx({ sdl: expectedSdl = sampleSdl, ir = sampleIr } = {}) {
  const writes = [];
  let parseCalls = 0;
  return {
    writes,
    get parseCalls() {
      return parseCalls;
    },
    commandCtx: {
      logger: noopLogger,
      fs: {
        async write(path, content) {
          writes.push({ path, content });
        }
      },
      stdout: { write() {} },
      stderr: { write() {} },
      env: {},
      parsers: {
        graphql: {
          parse(sdl) {
            parseCalls += 1;
            assert.equal(sdl, expectedSdl);
            return ir;
          }
        }
      }
    }
  };
}

test('TypeScriptCommand lowers schema content through the core LoweringEngine', async () => {
  const state = makeCtx();
  const command = new TypeScriptCommand(state.commandCtx);

  const result = await command.executeCore({
    schemaContent: sampleSdl,
    options: {
      outFile: 'types.generated.ts',
      quiet: true,
      json: false
    },
    logger: noopLogger
  });

  assert.equal(state.parseCalls, 1);
  assert.equal(result.outFile, 'types.generated.ts');
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].path, 'types.generated.ts');
  assert.match(state.writes[0].content, /interface User/);
  assert.match(state.writes[0].content, /email\?: string \| null;/);
  assert.doesNotMatch(state.writes[0].content, /createdAt\?:/);
});

test('TypeScriptCommand falls back to family projection for zero-table Continuum schemas', async () => {
  const state = makeCtx({ sdl: familySdl, ir: familyIr });
  const command = new TypeScriptCommand(state.commandCtx);

  const result = await command.executeCore({
    schemaContent: familySdl,
    schemaPath: 'continuum-neighborhood-core-family.graphql',
    options: {
      outFile: 'family.types.generated.ts',
      quiet: true,
      json: false
    },
    logger: noopLogger
  });

  assert.equal(state.parseCalls, 1);
  assert.equal(result.outFile, 'family.types.generated.ts');
  assert.equal(state.writes.length, 1);
  assert.match(
    state.writes[0].content,
    /export type AdmissionOutcomeKind = "DERIVED" \| "PLURAL";/
  );
  assert.match(state.writes[0].content, /export interface NeighborhoodCore/);
  assert.match(state.writes[0].content, /participants: Array<NeighborhoodParticipant>;/);
  assert.match(state.writes[0].content, /export interface ReplaceNeighborhoodMutationArgs/);
  assert.match(state.writes[0].content, /export interface MutationOperationMap/);
  assert.match(
    state.writes[0].content,
    /replaceNeighborhood: ReplaceNeighborhoodMutationOperation;/
  );
  assert.match(state.writes[0].content, /input: ReplaceNeighborhoodInput;/);
});

test('ZodCommand lowers schema content through the core LoweringEngine', async () => {
  const state = makeCtx();
  const command = new ZodCommand(state.commandCtx);

  const result = await command.executeCore({
    schemaContent: sampleSdl,
    options: {
      outFile: 'zod.generated.ts',
      quiet: true,
      json: false
    },
    logger: noopLogger
  });

  assert.equal(state.parseCalls, 1);
  assert.equal(result.outFile, 'zod.generated.ts');
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].path, 'zod.generated.ts');
  assert.match(state.writes[0].content, /z\.object/);
  assert.doesNotMatch(
    state.writes[0].content,
    /createdAt: z\.string\(\)\.datetime\(\)\.optional\(\)/
  );
});

test('ZodCommand falls back to family projection for zero-table Continuum schemas', async () => {
  const state = makeCtx({ sdl: familySdl, ir: familyIr });
  const command = new ZodCommand(state.commandCtx);

  const result = await command.executeCore({
    schemaContent: familySdl,
    schemaPath: 'continuum-neighborhood-core-family.graphql',
    options: {
      outFile: 'family.zod.generated.ts',
      quiet: true,
      json: false
    },
    logger: noopLogger
  });

  assert.equal(state.parseCalls, 1);
  assert.equal(result.outFile, 'family.zod.generated.ts');
  assert.equal(state.writes.length, 1);
  assert.match(
    state.writes[0].content,
    /export const AdmissionOutcomeKindSchema = z\.enum\(\["DERIVED", "PLURAL"\]\);/
  );
  assert.match(state.writes[0].content, /export const NeighborhoodCoreSchema = z\.object\(/);
  assert.match(
    state.writes[0].content,
    /participants: z\.array\(z\.lazy\(\(\) => NeighborhoodParticipantSchema\)\)/
  );
  assert.match(
    state.writes[0].content,
    /export const ReplaceNeighborhoodMutationArgsSchema = z\.object\(/
  );
  assert.match(state.writes[0].content, /export const MutationOperationSchemas = \{/);
  assert.match(state.writes[0].content, /replaceNeighborhood: \{/);
  assert.match(state.writes[0].content, /input: z\.lazy\(\(\) => ReplaceNeighborhoodInputSchema\)/);
});
