import test from 'node:test';
import assert from 'node:assert/strict';

import { Schema, Table, Field } from '../../src/domain/Schema.mjs';
import { LoweringEngine } from '../../src/application/LoweringEngine.mjs';

const sampleSdl = 'type User @table { id: ID! @pk }';
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
        }
      ],
      indexes: []
    }
  ],
  relationships: []
};

test('LoweringEngine lowers IR into a domain schema and plugin envelope', async () => {
  const engine = new LoweringEngine();
  const lowered = await engine.lower({
    sdl: sampleSdl,
    ir: sampleIr
  });

  assert.equal(lowered.ir, sampleIr);
  assert.equal(lowered.sdl, sampleSdl);
  assert.equal(typeof lowered.domain.getTables, 'function');
  assert.equal(lowered.domain.getTables()[0].name, 'User');
  assert.notEqual(lowered.pluginSchema, lowered.domain);
  assert.equal(typeof lowered.pluginSchema.getTables, 'function');
  assert.equal(lowered.pluginSchema.ir, sampleIr);
  assert.equal(lowered.pluginSchema.sdl, sampleSdl);
  assert.equal(lowered.pluginSchema.outputDir, undefined);
});

test('LoweringEngine can parse SDL when a parser is provided', async () => {
  let receivedSdl = null;
  const engine = new LoweringEngine({
    parseIr: async (sdl) => {
      receivedSdl = sdl;
      return sampleIr;
    }
  });

  const lowered = await engine.lower({ sdl: sampleSdl });

  assert.equal(receivedSdl, sampleSdl);
  assert.equal(lowered.ir, sampleIr);
  assert.equal(lowered.domain.getTables().length, 1);
  assert.equal(lowered.pluginSchema.sdl, sampleSdl);
});

test('LoweringEngine preserves a provided domain schema', async () => {
  const domain = new Schema({
    User: new Table({
      name: 'User',
      directives: { '@table': {} },
      fields: {
        id: new Field({
          name: 'id',
          type: 'ID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        })
      }
    })
  });

  const engine = new LoweringEngine();
  const lowered = await engine.lower(domain);

  assert.equal(lowered.domain, domain);
  assert.equal(lowered.pluginSchema.getTables()[0].name, 'User');
});
