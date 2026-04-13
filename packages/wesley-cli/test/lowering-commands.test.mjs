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

const sampleSdl = 'type User @table { id: ID! @pk email: String! }';
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
        }
      ],
      indexes: []
    }
  ],
  relationships: []
};

function makeCtx() {
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
      parsers: {
        graphql: {
          parse(sdl) {
            parseCalls += 1;
            assert.equal(sdl, sampleSdl);
            return sampleIr;
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
});
