import test from 'node:test';
import assert from 'node:assert/strict';

import { schemaHash } from '../../src/domain/schemaHash.mjs';

// ─── basic contract ──────────────────────────────────────────────────

test('schemaHash: returns a 64-char lowercase hex string', async () => {
  const hash = await schemaHash('type Query { hello: String }');
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('schemaHash: determinism — hashing same schema twice yields identical result', async () => {
  const sdl = 'type Query { hello: String }';
  const a = await schemaHash(sdl);
  const b = await schemaHash(sdl);
  assert.equal(a, b);
});

// ─── canonicalization invariance ─────────────────────────────────────

test('schemaHash: different formatting → same hash', async () => {
  const compact = 'type Query{hello:String world:Int}';
  const spaced = `
    type Query {
      hello: String
      world: Int
    }
  `;
  assert.equal(await schemaHash(compact), await schemaHash(spaced));
});

test('schemaHash: different field order → same hash', async () => {
  const abc = 'type Query { a: String b: Int c: Boolean }';
  const cba = 'type Query { c: Boolean b: Int a: String }';
  assert.equal(await schemaHash(abc), await schemaHash(cba));
});

test('schemaHash: adding whitespace/comments → same hash', async () => {
  const clean = 'type Query { hello: String }';
  const commented = `
    # This is a comment
    type Query {
      hello: String   # trailing comment
    }
  `;
  assert.equal(await schemaHash(clean), await schemaHash(commented));
});

test('schemaHash: extend type → same hash as equivalent flat schema', async () => {
  const extended = `
    type Query { a: String }
    extend type Query { b: Int }
  `;
  const flat = 'type Query { a: String b: Int }';
  assert.equal(await schemaHash(extended), await schemaHash(flat));
});

// ─── sensitivity — changes that MUST change the hash ─────────────────

test('schemaHash: different schemas → different hashes', async () => {
  const a = await schemaHash('type Query { hello: String }');
  const b = await schemaHash('type Query { goodbye: String }');
  assert.notEqual(a, b);
});

test('schemaHash: adding a field → changes hash', async () => {
  const before = await schemaHash('type Query { a: String }');
  const after = await schemaHash('type Query { a: String b: Int }');
  assert.notEqual(before, after);
});

test('schemaHash: removing a field → changes hash', async () => {
  const before = await schemaHash('type Query { a: String b: Int }');
  const after = await schemaHash('type Query { a: String }');
  assert.notEqual(before, after);
});

test('schemaHash: changing a type name → changes hash', async () => {
  const a = await schemaHash('type Alpha { x: Int }');
  const b = await schemaHash('type Beta { x: Int }');
  assert.notEqual(a, b);
});

test('schemaHash: changing a field type → changes hash', async () => {
  const a = await schemaHash('type Query { x: Int }');
  const b = await schemaHash('type Query { x: String }');
  assert.notEqual(a, b);
});

test('schemaHash: adding a directive → changes hash', async () => {
  const without = await schemaHash('directive @auth on FIELD_DEFINITION\ntype Query { x: Int }');
  const with_ = await schemaHash('directive @auth on FIELD_DEFINITION\ntype Query { x: Int @auth }');
  assert.notEqual(without, with_);
});

// ─── golden vectors (pinned expected hashes) ─────────────────────────

const GOLDEN_VECTORS = [
  {
    name: 'minimal',
    sdl: 'type Query { hello: String }',
    hash: 'a50aeaeccad12d82ccafa5d7f8b56a95de2a629ec04097aff87d3606f56f724e'
  },
  {
    name: 'two-types',
    sdl: 'type Query { id: ID! } type User { name: String email: String! }',
    hash: 'bdb6ec1f84809f15eb5cb3d0e4a76bda5316b8607f0422e514e245129df69579'
  },
  {
    name: 'enum',
    sdl: 'enum Status { ACTIVE INACTIVE PENDING }',
    hash: '442b13f4da05c8273ac6923d3cc6dbc5028cf834db04ea52c268bd41b2457967'
  },
  {
    name: 'input-and-mutation',
    sdl: 'input CreateUserInput { name: String! email: String! } type Mutation { createUser(input: CreateUserInput!): User } type User { id: ID! name: String }',
    hash: '9b3b779bf841b67129ef03c83c18ff1a5ae6e7b8c3268647e96bd05f1d239437'
  },
  {
    name: 'with-directive',
    sdl: 'directive @auth(requires: String!) on FIELD_DEFINITION\ntype Query { secret: String @auth(requires: "ADMIN") }',
    hash: '95bb01c19ee38de5cd4a604096d026613beec2a467ced46453bc210a1625e210'
  }
];

for (const { name, sdl, hash } of GOLDEN_VECTORS) {
  test(`schemaHash: golden vector — ${name}`, async () => {
    const result = await schemaHash(sdl);
    assert.equal(result, hash, `Golden vector "${name}" mismatch`);
  });
}

// ─── error handling ──────────────────────────────────────────────────

test('schemaHash: invalid SDL throws', async () => {
  await assert.rejects(() => schemaHash('not valid graphql !!!'), {
    name: 'GraphQLError'
  });
});
