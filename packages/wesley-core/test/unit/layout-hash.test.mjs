import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLayoutDescriptor,
  computeLayoutHash,
  encodingForType
} from '../../src/domain/layoutHash.mjs';

// ─── encodingForType mapping ────────────────────────────────────────

test('encodingForType: Boolean → bool_u8', () => {
  assert.equal(encodingForType('Boolean', { required: true }), 'bool_u8');
});

test('encodingForType: Int → i32_le', () => {
  assert.equal(encodingForType('Int', { required: true }), 'i32_le');
});

test('encodingForType: Float → f32_le', () => {
  assert.equal(encodingForType('Float', { required: true }), 'f32_le');
});

test('encodingForType: String → len_prefix_utf8', () => {
  assert.equal(encodingForType('String', { required: true }), 'len_prefix_utf8');
});

test('encodingForType: ID → len_prefix_utf8', () => {
  assert.equal(encodingForType('ID', { required: true }), 'len_prefix_utf8');
});

test('encodingForType: optional wraps with option_ prefix', () => {
  assert.equal(encodingForType('Int', { required: false }), 'option_i32_le');
});

test('encodingForType: list wraps with list_ prefix', () => {
  assert.equal(encodingForType('String', { required: true, list: true }), 'list_len_prefix_utf8');
});

test('encodingForType: optional list combines both prefixes', () => {
  assert.equal(encodingForType('Float', { required: false, list: true }), 'option_list_f32_le');
});

test('encodingForType: enum kind → enum_u32_le', () => {
  assert.equal(encodingForType('Status', { required: true, kind: 'ENUM' }), 'enum_u32_le');
});

test('encodingForType: unknown object type → nested_TypeName', () => {
  assert.equal(encodingForType('Product', { required: true }), 'nested_Product');
});

// ─── buildLayoutDescriptor ──────────────────────────────────────────

test('buildLayoutDescriptor: OBJECT fields sorted alphabetically', () => {
  const desc = buildLayoutDescriptor({
    name: 'Foo',
    kind: 'OBJECT',
    fields: [
      { name: 'z_field', type: 'Int', required: true, list: false },
      { name: 'a_field', type: 'String', required: true, list: false }
    ]
  });
  assert.equal(desc.fields[0].name, 'a_field');
  assert.equal(desc.fields[1].name, 'z_field');
});

test('buildLayoutDescriptor: ENUM has sorted variants', () => {
  const desc = buildLayoutDescriptor({
    name: 'Direction',
    kind: 'ENUM',
    values: ['SOUTH', 'NORTH', 'EAST', 'WEST']
  });
  assert.deepEqual(desc.variants, ['EAST', 'NORTH', 'SOUTH', 'WEST']);
  assert.equal(desc.variant_encoding, 'enum_u32_le');
});

test('buildLayoutDescriptor: includes format and endian', () => {
  const desc = buildLayoutDescriptor({
    name: 'X',
    kind: 'OBJECT',
    fields: []
  });
  assert.equal(desc.format, 'raw_le/v1');
  assert.equal(desc.endian, 'little');
  assert.equal(desc.type_name, 'X');
});

test('buildLayoutDescriptor: resolves enum field kind via typeIndex', () => {
  const typeIndex = new Map([
    ['Status', { name: 'Status', kind: 'ENUM', values: ['A', 'B'] }]
  ]);
  const desc = buildLayoutDescriptor(
    {
      name: 'User',
      kind: 'OBJECT',
      fields: [{ name: 'status', type: 'Status', required: true, list: false }]
    },
    typeIndex
  );
  assert.equal(desc.fields[0].encoding, 'enum_u32_le');
});

// ─── computeLayoutHash basic contract ───────────────────────────────

test('computeLayoutHash: returns 64-char lowercase hex', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Foo',
    kind: 'OBJECT',
    fields: [{ name: 'x', type: 'Int', required: true, list: false }]
  });
  const hash = await computeLayoutHash(desc);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('computeLayoutHash: deterministic — same descriptor → same hash', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Foo',
    kind: 'OBJECT',
    fields: [{ name: 'x', type: 'Int', required: true, list: false }]
  });
  const a = await computeLayoutHash(desc);
  const b = await computeLayoutHash(desc);
  assert.equal(a, b);
});

// ─── sensitivity tests ──────────────────────────────────────────────

test('adding a field → different hash', async () => {
  const base = { name: 'T', kind: 'OBJECT', fields: [{ name: 'a', type: 'Int', required: true, list: false }] };
  const extended = { name: 'T', kind: 'OBJECT', fields: [
    { name: 'a', type: 'Int', required: true, list: false },
    { name: 'b', type: 'String', required: true, list: false }
  ]};
  const a = await computeLayoutHash(buildLayoutDescriptor(base));
  const b = await computeLayoutHash(buildLayoutDescriptor(extended));
  assert.notEqual(a, b);
});

test('removing a field → different hash', async () => {
  const full = { name: 'T', kind: 'OBJECT', fields: [
    { name: 'a', type: 'Int', required: true, list: false },
    { name: 'b', type: 'String', required: true, list: false }
  ]};
  const partial = { name: 'T', kind: 'OBJECT', fields: [{ name: 'a', type: 'Int', required: true, list: false }] };
  const a = await computeLayoutHash(buildLayoutDescriptor(full));
  const b = await computeLayoutHash(buildLayoutDescriptor(partial));
  assert.notEqual(a, b);
});

test('changing a field type → different hash', async () => {
  const intField = { name: 'T', kind: 'OBJECT', fields: [{ name: 'x', type: 'Int', required: true, list: false }] };
  const floatField = { name: 'T', kind: 'OBJECT', fields: [{ name: 'x', type: 'Float', required: true, list: false }] };
  const a = await computeLayoutHash(buildLayoutDescriptor(intField));
  const b = await computeLayoutHash(buildLayoutDescriptor(floatField));
  assert.notEqual(a, b);
});

test('changing type name → different hash', async () => {
  const fields = [{ name: 'x', type: 'Int', required: true, list: false }];
  const a = await computeLayoutHash(buildLayoutDescriptor({ name: 'Alpha', kind: 'OBJECT', fields }));
  const b = await computeLayoutHash(buildLayoutDescriptor({ name: 'Beta', kind: 'OBJECT', fields }));
  assert.notEqual(a, b);
});

test('same fields different declaration order → same hash (alphabetical sort)', async () => {
  const orderA = { name: 'T', kind: 'OBJECT', fields: [
    { name: 'b', type: 'String', required: true, list: false },
    { name: 'a', type: 'Int', required: true, list: false }
  ]};
  const orderB = { name: 'T', kind: 'OBJECT', fields: [
    { name: 'a', type: 'Int', required: true, list: false },
    { name: 'b', type: 'String', required: true, list: false }
  ]};
  const a = await computeLayoutHash(buildLayoutDescriptor(orderA));
  const b = await computeLayoutHash(buildLayoutDescriptor(orderB));
  assert.equal(a, b);
});

test('enum variant order in IR does not matter (sorted in descriptor)', async () => {
  const enumA = { name: 'E', kind: 'ENUM', values: ['B', 'A', 'C'] };
  const enumB = { name: 'E', kind: 'ENUM', values: ['C', 'A', 'B'] };
  const a = await computeLayoutHash(buildLayoutDescriptor(enumA));
  const b = await computeLayoutHash(buildLayoutDescriptor(enumB));
  assert.equal(a, b);
});

// ─── golden vectors (pinned expected hashes) ────────────────────────

test('golden: simple-object (Foo with age:Int, name:String)', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Foo',
    kind: 'OBJECT',
    fields: [
      { name: 'age', type: 'Int', required: true, list: false },
      { name: 'name', type: 'String', required: true, list: false }
    ]
  });
  const hash = await computeLayoutHash(desc);
  assert.equal(hash, '18855c79f3f2992b7f32a992bb2b2458b14822eeed8f4eefedb53bb6ea754fc0');
});

test('golden: object-with-optional (Bar with active:Boolean!, score:Float?)', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Bar',
    kind: 'OBJECT',
    fields: [
      { name: 'score', type: 'Float', required: false, list: false },
      { name: 'active', type: 'Boolean', required: true, list: false }
    ]
  });
  const hash = await computeLayoutHash(desc);
  assert.equal(hash, '9287dde957145246c01bfa2977c42ff364b9e9adcb1a77abb7a3f0f6bac7c15e');
});

test('golden: enum-type (Status)', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Status',
    kind: 'ENUM',
    values: ['ACTIVE', 'INACTIVE', 'PENDING']
  });
  const hash = await computeLayoutHash(desc);
  assert.equal(hash, '834e09cac92029e872d78a3da5844ccc631c81bc0ded1b5fcb530e1aa679ad09');
});

test('golden: object-with-list (Inventory with id:ID!, tags:[String]!)', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Inventory',
    kind: 'OBJECT',
    fields: [
      { name: 'tags', type: 'String', required: true, list: true },
      { name: 'id', type: 'ID', required: true, list: false }
    ]
  });
  const hash = await computeLayoutHash(desc);
  assert.equal(hash, '2059a166bf17d4ed7322cdd46c2e99a621e797c5fd446af8c5a2b4918070700f');
});

test('golden: object-with-nested (Order with item:Product!, quantity:Int!)', async () => {
  const desc = buildLayoutDescriptor({
    name: 'Order',
    kind: 'OBJECT',
    fields: [
      { name: 'item', type: 'Product', required: true, list: false },
      { name: 'quantity', type: 'Int', required: true, list: false }
    ]
  });
  const hash = await computeLayoutHash(desc);
  assert.equal(hash, 'b9b819b4c1430e257e33416babc0bd8126b48802ddd81daf6cd2051723f5af2c');
});
