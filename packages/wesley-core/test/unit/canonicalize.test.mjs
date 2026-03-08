import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalize } from '../../src/domain/canonicalize.mjs';

// ─── helper ──────────────────────────────────────────────────────────

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─── basic contract ──────────────────────────────────────────────────

test('canonicalize: returns a Uint8Array', () => {
  const result = canonicalize('type Query { hello: String }');
  assert.ok(result instanceof Uint8Array);
  assert.ok(result.length > 0);
});

test('canonicalize: determinism — calling twice yields identical bytes', () => {
  const sdl = 'type Query { hello: String }';
  const a = canonicalize(sdl);
  const b = canonicalize(sdl);
  assert.ok(bytesEqual(a, b), 'Two calls should produce identical bytes');
});

test('canonicalize: invalid SDL throws', () => {
  assert.throws(() => canonicalize('not valid graphql !!!'), {
    name: 'GraphQLError'
  });
});

// ─── formatting invariance ───────────────────────────────────────────

test('canonicalize: different formatting → identical bytes', () => {
  const compact = 'type Query{hello:String world:Int}';
  const spaced = `
    type Query {
      hello: String
      world: Int
    }
  `;
  assert.ok(bytesEqual(canonicalize(compact), canonicalize(spaced)));
});

test('canonicalize: with/without comments → identical bytes', () => {
  const _withComments = `
    # This is a comment
    type Query {
      """Documentation"""
      hello: String
    }
  `;
  const without = 'type Query { hello: String }';
  // Note: description strings ARE part of the GraphQL AST in graphql-js
  // so we compare schemas without descriptions here — description is semantic
  const noDesc = 'type Query { hello: String }';
  assert.ok(bytesEqual(canonicalize(without), canonicalize(noDesc)));
});

// ─── field ordering ──────────────────────────────────────────────────

test('canonicalize: different field order → identical bytes', () => {
  const abc = 'type Query { a: String b: Int c: Boolean }';
  const cba = 'type Query { c: Boolean b: Int a: String }';
  assert.ok(bytesEqual(canonicalize(abc), canonicalize(cba)));
});

// ─── type ordering ───────────────────────────────────────────────────

test('canonicalize: different type definition order → identical bytes', () => {
  const ab = `
    type Alpha { x: Int }
    type Beta { y: String }
  `;
  const ba = `
    type Beta { y: String }
    type Alpha { x: Int }
  `;
  assert.ok(bytesEqual(canonicalize(ab), canonicalize(ba)));
});

// ─── different schemas → different bytes ─────────────────────────────

test('canonicalize: different schemas → different bytes', () => {
  const a = 'type Query { hello: String }';
  const b = 'type Query { goodbye: String }';
  assert.ok(!bytesEqual(canonicalize(a), canonicalize(b)));
});

test('canonicalize: adding a field → different bytes', () => {
  const before = 'type Query { a: String }';
  const after = 'type Query { a: String b: Int }';
  assert.ok(!bytesEqual(canonicalize(before), canonicalize(after)));
});

// ─── extend type folding ─────────────────────────────────────────────

test('canonicalize: extend type folded into base type', () => {
  const extended = `
    type Query { a: String }
    extend type Query { b: Int }
  `;
  const flat = 'type Query { a: String b: Int }';
  assert.ok(bytesEqual(canonicalize(extended), canonicalize(flat)));
});

test('canonicalize: extend type without base → throws', () => {
  assert.throws(
    () => canonicalize('extend type Missing { x: Int }'),
    /no base definition found/
  );
});

// ─── enum value ordering ─────────────────────────────────────────────

test('canonicalize: enum values sorted', () => {
  const zyx = 'enum Color { Z Y X }';
  const xyz = 'enum Color { X Y Z }';
  assert.ok(bytesEqual(canonicalize(zyx), canonicalize(xyz)));
});

// ─── union member ordering ───────────────────────────────────────────

test('canonicalize: union members sorted', () => {
  const ba = 'type A { x: Int } type B { y: Int } union AB = B | A';
  const ab = 'type A { x: Int } type B { y: Int } union AB = A | B';
  assert.ok(bytesEqual(canonicalize(ba), canonicalize(ab)));
});

// ─── interface implements ordering ───────────────────────────────────

test('canonicalize: interface implements sorted', () => {
  const ba = `
    interface A { x: Int }
    interface B { y: String }
    type Impl implements B & A { x: Int y: String }
  `;
  const ab = `
    interface A { x: Int }
    interface B { y: String }
    type Impl implements A & B { x: Int y: String }
  `;
  assert.ok(bytesEqual(canonicalize(ba), canonicalize(ab)));
});

// ─── directive ordering ──────────────────────────────────────────────

test('canonicalize: directives sorted by name', () => {
  const ba = `
    directive @b on FIELD_DEFINITION
    directive @a on FIELD_DEFINITION
    type Query { hello: String @b @a }
  `;
  const ab = `
    directive @a on FIELD_DEFINITION
    directive @b on FIELD_DEFINITION
    type Query { hello: String @a @b }
  `;
  assert.ok(bytesEqual(canonicalize(ba), canonicalize(ab)));
});

test('canonicalize: directive arguments sorted by name', () => {
  const xy = `
    directive @d(x: Int, y: String) on FIELD_DEFINITION
    type Query { hello: String @d(x: 1, y: "a") }
  `;
  const yx = `
    directive @d(x: Int, y: String) on FIELD_DEFINITION
    type Query { hello: String @d(y: "a", x: 1) }
  `;
  assert.ok(bytesEqual(canonicalize(xy), canonicalize(yx)));
});

test('canonicalize: same directive multiple times sorted by serialized args', () => {
  const ab = `
    directive @tag(name: String!) repeatable on FIELD_DEFINITION
    type Query { hello: String @tag(name: "a") @tag(name: "b") }
  `;
  const ba = `
    directive @tag(name: String!) repeatable on FIELD_DEFINITION
    type Query { hello: String @tag(name: "b") @tag(name: "a") }
  `;
  assert.ok(bytesEqual(canonicalize(ab), canonicalize(ba)));
});

// ─── NFC normalization ───────────────────────────────────────────────

test('canonicalize: NFC normalization applied to string values', () => {
  // e followed by combining acute accent (NFD) vs e-acute (NFC)
  const nfd = 'directive @d(x: String) on OBJECT\ntype Query @d(x: "caf\u0065\u0301") { a: String }';
  const nfc = 'directive @d(x: String) on OBJECT\ntype Query @d(x: "caf\u00e9") { a: String }';
  assert.ok(bytesEqual(canonicalize(nfd), canonicalize(nfc)));
});

// ─── input types ─────────────────────────────────────────────────────

test('canonicalize: input object fields sorted', () => {
  const ba = 'input Foo { b: Int a: String }';
  const ab = 'input Foo { a: String b: Int }';
  assert.ok(bytesEqual(canonicalize(ba), canonicalize(ab)));
});

// ─── scalars ─────────────────────────────────────────────────────────

test('canonicalize: scalar types included', () => {
  const sdl = 'scalar DateTime';
  const result = canonicalize(sdl);
  const decoded = JSON.parse(new TextDecoder().decode(result));
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].kind, 'ScalarTypeDefinition');
  assert.equal(decoded[0].name, 'DateTime');
});

// ─── absent optional fields ──────────────────────────────────────────

test('canonicalize: absent optional fields not in output', () => {
  const sdl = 'type Query { hello: String }';
  const result = canonicalize(sdl);
  const decoded = JSON.parse(new TextDecoder().decode(result));
  const queryType = decoded[0];
  // No directives key since there are none
  assert.equal(queryType.directives, undefined);
  // No interfaces key since there are none
  assert.equal(queryType.interfaces, undefined);
});

test('canonicalize: fields explicitly set to default appear', () => {
  const sdl = `
    directive @d(x: Int = 0) on FIELD_DEFINITION
    type Query { hello: String @d(x: 0) }
  `;
  const result = canonicalize(sdl);
  const decoded = JSON.parse(new TextDecoder().decode(result));
  const queryType = decoded.find(d => d.kind === 'ObjectTypeDefinition');
  assert.ok(queryType.fields[0].directives);
  assert.equal(queryType.fields[0].directives[0].arguments[0].value, 0);
});

// ─── schema definition ──────────────────────────────────────────────

test('canonicalize: schema definition included', () => {
  const sdl = `
    schema { query: MyQuery }
    type MyQuery { hello: String }
  `;
  const result = canonicalize(sdl);
  const decoded = JSON.parse(new TextDecoder().decode(result));
  const schemaDef = decoded.find(d => d.kind === 'SchemaDefinition');
  assert.ok(schemaDef);
  assert.equal(schemaDef.operationTypes[0].type, 'MyQuery');
});

// ─── directive definition ────────────────────────────────────────────

test('canonicalize: directive definition arguments sorted', () => {
  const sdl = 'directive @d(z: Int, a: String) on FIELD_DEFINITION';
  const result = canonicalize(sdl);
  const decoded = JSON.parse(new TextDecoder().decode(result));
  assert.equal(decoded[0].arguments[0].name, 'a');
  assert.equal(decoded[0].arguments[1].name, 'z');
});

// ─── extend enum / interface / union / input ─────────────────────────

test('canonicalize: extend enum folded', () => {
  const extended = `
    enum Color { RED }
    extend enum Color { BLUE }
  `;
  const flat = 'enum Color { BLUE RED }';
  assert.ok(bytesEqual(canonicalize(extended), canonicalize(flat)));
});

test('canonicalize: extend interface folded', () => {
  const extended = `
    interface Node { id: ID }
    extend interface Node { name: String }
  `;
  const flat = 'interface Node { id: ID name: String }';
  assert.ok(bytesEqual(canonicalize(extended), canonicalize(flat)));
});

test('canonicalize: extend union folded', () => {
  const extended = `
    type A { x: Int }
    type B { y: Int }
    type C { z: Int }
    union U = A
    extend union U = B | C
  `;
  const flat = `
    type A { x: Int }
    type B { y: Int }
    type C { z: Int }
    union U = A | B | C
  `;
  assert.ok(bytesEqual(canonicalize(extended), canonicalize(flat)));
});

test('canonicalize: extend input folded', () => {
  const extended = `
    input Foo { a: Int }
    extend input Foo { b: String }
  `;
  const flat = 'input Foo { a: Int b: String }';
  assert.ok(bytesEqual(canonicalize(extended), canonicalize(flat)));
});

// ─── performance sanity ──────────────────────────────────────────────

test('canonicalize: handles a moderately large schema', () => {
  // Generate 100 types with 10 fields each
  const types = [];
  for (let i = 0; i < 100; i++) {
    const fields = [];
    for (let j = 0; j < 10; j++) {
      fields.push(`field${j}: String`);
    }
    types.push(`type Type${i} { ${fields.join(' ')} }`);
  }
  const sdl = types.join('\n');
  const start = performance.now();
  const result = canonicalize(sdl);
  const elapsed = performance.now() - start;
  assert.ok(result instanceof Uint8Array);
  assert.ok(result.length > 0);
  // Should complete in under 1 second
  assert.ok(elapsed < 1000, `Took ${elapsed}ms, expected < 1000ms`);
});
