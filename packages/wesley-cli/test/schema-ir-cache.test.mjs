import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSdlHash } from '@wesley/core';
import {
  resolveSchemaIr,
  SCHEMA_IR_CACHE_DIR,
  SCHEMA_IR_CACHE_KIND
} from '../src/utils/schema-ir-cache.mjs';

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

function createFs(store = new Map()) {
  return {
    store,
    async join(...parts) {
      return parts.join('/');
    },
    async exists(path) {
      return store.has(path);
    },
    async read(path) {
      if (!store.has(path)) {
        const error = new Error(`ENOENT: ${path}`);
        error.code = 'ENOENT';
        throw error;
      }
      return store.get(path);
    },
    async write(path, content) {
      store.set(path, content);
    }
  };
}

function createCtx({ fs, parse, parseComposed }) {
  let parseCalls = 0;
  let parseComposedCalls = 0;

  return {
    fs,
    get parseCalls() {
      return parseCalls;
    },
    get parseComposedCalls() {
      return parseComposedCalls;
    },
    parsers: {
      graphql: {
        parse(...args) {
          parseCalls += 1;
          return parse(...args);
        },
        parseComposed(...args) {
          parseComposedCalls += 1;
          return parseComposed(...args);
        }
      }
    }
  };
}

test('resolveSchemaIr reuses fresh, memory, and disk-cached raw IR', async () => {
  const fs = createFs();
  const ctx = createCtx({
    fs,
    parse(sdl, options) {
      assert.equal(sdl, sampleSdl);
      assert.deepEqual(options, { filename: 'schema.graphql' });
      return sampleIr;
    },
    parseComposed() {
      throw new Error('parseComposed should not run for raw schemas');
    }
  });

  const first = await resolveSchemaIr({
    ctx,
    schemaContent: sampleSdl,
    schemaPath: 'schema.graphql'
  });
  assert.equal(first.cacheStatus, 'fresh');
  assert.equal(ctx.parseCalls, 1);
  assert.equal(ctx.parseComposedCalls, 0);
  assert.ok(first.cachePath?.startsWith(`${SCHEMA_IR_CACHE_DIR}/`));

  const cachePayload = JSON.parse(fs.store.get(first.cachePath));
  assert.equal(cachePayload.kind, SCHEMA_IR_CACHE_KIND);
  assert.equal(cachePayload.cacheKey, first.cacheKey);
  assert.equal(cachePayload.schemaPath, 'schema.graphql');
  assert.equal(cachePayload.composed, false);
  assert.deepEqual(cachePayload.ir, sampleIr);

  const second = await resolveSchemaIr({
    ctx,
    schemaContent: sampleSdl,
    schemaPath: 'schema.graphql'
  });
  assert.equal(second.cacheStatus, 'memory');
  assert.equal(ctx.parseCalls, 1);
  assert.deepEqual(second.ir, sampleIr);

  const diskCtx = createCtx({
    fs,
    parse() {
      throw new Error('disk cache should satisfy the second context');
    },
    parseComposed() {
      throw new Error('parseComposed should not run for raw schemas');
    }
  });

  const third = await resolveSchemaIr({
    ctx: diskCtx,
    schemaContent: sampleSdl,
    schemaPath: 'schema.graphql'
  });
  assert.equal(third.cacheStatus, 'disk');
  assert.equal(diskCtx.parseCalls, 0);
  assert.deepEqual(third.ir, sampleIr);
});

test('resolveSchemaIr uses parseComposed and records composed cache metadata', async () => {
  const fs = createFs();
  const units = [
    { id: 'base', sdl: 'type Org @table { id: ID! @pk }' },
    { id: 'feature', sdl: 'type User @table { id: ID! @pk orgId: ID! }' }
  ];
  const composedSdl = units.map((unit) => unit.sdl).join('\n\n');
  const ctx = createCtx({
    fs,
    parse() {
      throw new Error('raw parse should not run for composed schemas');
    },
    parseComposed(receivedUnits) {
      assert.deepEqual(receivedUnits, units);
      return sampleIr;
    }
  });

  const result = await resolveSchemaIr({
    ctx,
    schemaContent: composedSdl,
    schemaPath: 'schema.graphql',
    units
  });

  assert.equal(result.cacheStatus, 'fresh');
  assert.equal(ctx.parseCalls, 0);
  assert.equal(ctx.parseComposedCalls, 1);

  const cachePayload = JSON.parse(fs.store.get(result.cachePath));
  assert.equal(cachePayload.kind, SCHEMA_IR_CACHE_KIND);
  assert.equal(cachePayload.composed, true);
  assert.equal(cachePayload.unitCount, 2);
  assert.deepEqual(cachePayload.ir, sampleIr);
});

test('resolveSchemaIr ignores malformed cache entries and regenerates IR', async () => {
  const cacheKey = await computeSdlHash(sampleSdl);
  const fs = createFs(new Map([[`${SCHEMA_IR_CACHE_DIR}/${cacheKey}.json`, '{"nope":true}']]));
  const ctx = createCtx({
    fs,
    parse() {
      return sampleIr;
    },
    parseComposed() {
      throw new Error('parseComposed should not run for raw schemas');
    }
  });

  const result = await resolveSchemaIr({
    ctx,
    schemaContent: sampleSdl,
    schemaPath: 'schema.graphql'
  });

  assert.equal(result.cacheStatus, 'fresh');
  assert.equal(ctx.parseCalls, 1);
});
