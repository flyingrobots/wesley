import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';
import { emitRawLeCodec } from '../src/emitRawLeCodec.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basicSDL = /* GraphQL */ `
  type Foo {
    b: String!
    a: Int!
  }
  type Query { foo: Foo! }
`;

const allTypesSDL = /* GraphQL */ `
  type Everything {
    active: Boolean!
    count: Int!
    label: String!
    ratio: Float!
    uid: ID!
  }
  type Query { everything: Everything! }
`;

const optionalSDL = /* GraphQL */ `
  type Optionals {
    name: String
    score: Int
  }
  type Query { opt: Optionals }
`;

const listSDL = /* GraphQL */ `
  type WithLists {
    tags: [String!]!
    scores: [Int!]!
  }
  type Query { wl: WithLists! }
`;

const enumSDL = /* GraphQL */ `
  enum Status { DRAFT ACTIVE ARCHIVED }
  type Query { status: Status! }
`;

const nestedSDL = /* GraphQL */ `
  type Inner {
    x: Int!
  }
  type Outer {
    inner: Inner!
    label: String!
  }
  type Query { outer: Outer! }
`;

const emptyTypeSDL = /* GraphQL */ `
  type Empty {
    _placeholder: Boolean
  }
  type Query { e: Empty }
`;

const mixedSDL = /* GraphQL */ `
  enum Color { RED GREEN BLUE }
  type Sprite {
    color: Color!
    name: String!
    x: Float!
    y: Float!
  }
  type Query { sprite: Sprite! }
`;

// ---------------------------------------------------------------------------
// Integration: file presence
// ---------------------------------------------------------------------------

describe('raw_le_codec file generation', () => {
  it('generates raw_le_codec.generated.rs for schemas with types', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const file = result.files.find((f) => f.path === 'raw_le_codec.generated.rs');
    expect(file).toBeDefined();
    expect(file.content.length).toBeGreaterThan(0);
  });

  it('omits raw_le_codec.generated.rs when no OBJECT or ENUM types', async () => {
    const sdl = `type Query { hello: String! }`;
    const result = await generateEcho({ sdl });
    const file = result.files.find((f) => f.path === 'raw_le_codec.generated.rs');
    // Query/Mutation types are excluded from IR types, so no encodable types
    expect(file).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// #[forbid(unsafe_code)]
// ---------------------------------------------------------------------------

describe('safety attributes', () => {
  it('includes #[forbid(unsafe_code)]', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('#![forbid(unsafe_code)]');
  });

  it('includes DO NOT EDIT comment', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('DO NOT EDIT');
  });
});

// ---------------------------------------------------------------------------
// DecodeError
// ---------------------------------------------------------------------------

describe('DecodeError', () => {
  it('emits DecodeError enum', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('pub enum DecodeError {');
    expect(rs).toContain('UnexpectedEof');
    expect(rs).toContain('InvalidOptionTag');
    expect(rs).toContain('InvalidEnumVariant');
    expect(rs).toContain('Utf8Error');
  });
});

// ---------------------------------------------------------------------------
// Field alphabetical ordering
// ---------------------------------------------------------------------------

describe('alphabetical field order', () => {
  it('encodes fields in alphabetical order (a before b)', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    // In the encode method, `a` should appear before `b`
    const encodeBlock = rs.slice(rs.indexOf('impl Foo {'));
    const aIdx = encodeBlock.indexOf('self.a');
    const bIdx = encodeBlock.indexOf('self.b');
    expect(aIdx).toBeLessThan(bIdx);
  });
});

// ---------------------------------------------------------------------------
// Boolean encoding
// ---------------------------------------------------------------------------

describe('Boolean encoding', () => {
  it('uses encode_bool helper', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('encode_bool');
    expect(rs).toContain('0x00');
    expect(rs).toContain('0x01');
  });

  it('emits encode_bool function with correct values', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn encode_bool(v: bool) -> u8 {');
    expect(rs).toContain('if v { 0x01 } else { 0x00 }');
  });
});

// ---------------------------------------------------------------------------
// Int encoding
// ---------------------------------------------------------------------------

describe('Int encoding', () => {
  it('uses to_le_bytes for i32', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn encode_i32_le(v: i32) -> [u8; 4]');
    expect(rs).toContain('v.to_le_bytes()');
  });
});

// ---------------------------------------------------------------------------
// Float encoding with NaN canonicalization
// ---------------------------------------------------------------------------

describe('Float encoding', () => {
  it('uses encode_f32_le with NaN canonicalization', async () => {
    const result = await generateEcho({ sdl: allTypesSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn encode_f32_le(v: f32) -> [u8; 4]');
    expect(rs).toContain('0x7FC00000');
    expect(rs).toContain('is_nan()');
  });
});

// ---------------------------------------------------------------------------
// String encoding
// ---------------------------------------------------------------------------

describe('String encoding', () => {
  it('uses length-prefixed UTF-8 encoding', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn encode_string(s: &str) -> Vec<u8>');
    expect(rs).toContain('as_bytes()');
    expect(rs).toContain('(bytes.len() as u32).to_le_bytes()');
  });
});

// ---------------------------------------------------------------------------
// Optional (Option<T>) encoding
// ---------------------------------------------------------------------------

describe('Optional field encoding', () => {
  it('uses encode_option with 0x00/0x01 prefix', async () => {
    const result = await generateEcho({ sdl: optionalSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn encode_option<T, F>');
    expect(rs).toContain('None => vec![0x00]');
    expect(rs).toContain('let mut buf = vec![0x01];');
  });

  it('wraps non-required fields in encode_option call', async () => {
    const result = await generateEcho({ sdl: optionalSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('encode_option(&self.name');
    expect(rs).toContain('encode_option(&self.score');
  });

  it('wraps non-required decode fields in decode_option call', async () => {
    const result = await generateEcho({ sdl: optionalSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('decode_option(bytes, &mut offset, decode_string)');
    expect(rs).toContain('decode_option(bytes, &mut offset, decode_i32_le)');
  });
});

// ---------------------------------------------------------------------------
// List encoding
// ---------------------------------------------------------------------------

describe('List encoding', () => {
  it('uses encode_list with count prefix', async () => {
    const result = await generateEcho({ sdl: listSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn encode_list<T, F>');
    expect(rs).toContain('(v.len() as u32).to_le_bytes()');
  });

  it('calls encode_list for list fields', async () => {
    const result = await generateEcho({ sdl: listSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('encode_list(&self.scores');
    expect(rs).toContain('encode_list(&self.tags');
  });

  it('calls decode_list for list fields', async () => {
    const result = await generateEcho({ sdl: listSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('decode_list(bytes, &mut offset, decode_i32_le)');
    expect(rs).toContain('decode_list(bytes, &mut offset, decode_string)');
  });
});

// ---------------------------------------------------------------------------
// Enum encoding
// ---------------------------------------------------------------------------

describe('Enum encoding', () => {
  it('encodes enum variants in alphabetical order', async () => {
    const result = await generateEcho({ sdl: enumSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;

    // Alphabetical: ACTIVE=0, ARCHIVED=1, DRAFT=2
    expect(rs).toContain('Self::ACTIVE => 0,');
    expect(rs).toContain('Self::ARCHIVED => 1,');
    expect(rs).toContain('Self::DRAFT => 2,');
  });

  it('uses u32 LE for enum variant index', async () => {
    const result = await generateEcho({ sdl: enumSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('let idx: u32 = match self {');
    expect(rs).toContain('idx.to_le_bytes().to_vec()');
  });

  it('emits decode for enum', async () => {
    const result = await generateEcho({ sdl: enumSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('pub fn decode_raw_le(bytes: &[u8], offset: &mut usize) -> Result<Self, DecodeError>');
    expect(rs).toContain('0 => Ok(Self::ACTIVE),');
    expect(rs).toContain('1 => Ok(Self::ARCHIVED),');
    expect(rs).toContain('2 => Ok(Self::DRAFT),');
    expect(rs).toContain('v => Err(DecodeError::InvalidEnumVariant(v)),');
  });
});

// ---------------------------------------------------------------------------
// Nested object encoding
// ---------------------------------------------------------------------------

describe('Nested object encoding', () => {
  it('calls encode_raw_le on nested objects', async () => {
    const result = await generateEcho({ sdl: nestedSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('self.inner.encode_raw_le()');
  });
});

// ---------------------------------------------------------------------------
// Empty type
// ---------------------------------------------------------------------------

describe('Empty type', () => {
  it('generates valid encoder/decoder for type with only optional field', async () => {
    const result = await generateEcho({ sdl: emptyTypeSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('impl Empty {');
    expect(rs).toContain('pub fn encode_raw_le(&self) -> Vec<u8>');
    expect(rs).toContain('pub fn decode_raw_le(bytes: &[u8]) -> Result<Self, DecodeError>');
  });
});

// ---------------------------------------------------------------------------
// Mixed enum + object schema
// ---------------------------------------------------------------------------

describe('Mixed schema', () => {
  it('generates codecs for both enum and object types', async () => {
    const result = await generateEcho({ sdl: mixedSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('impl Color {');
    expect(rs).toContain('impl Sprite {');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('Decode helpers', () => {
  it('emits decode_bool', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn decode_bool(bytes: &[u8], offset: &mut usize) -> Result<bool, DecodeError>');
  });

  it('emits decode_i32_le', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn decode_i32_le(bytes: &[u8], offset: &mut usize) -> Result<i32, DecodeError>');
  });

  it('emits decode_f32_le', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn decode_f32_le(bytes: &[u8], offset: &mut usize) -> Result<f32, DecodeError>');
  });

  it('emits decode_string', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn decode_string(bytes: &[u8], offset: &mut usize) -> Result<String, DecodeError>');
  });

  it('emits decode_option', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn decode_option<T, F>');
  });

  it('emits decode_list', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('fn decode_list<T, F>');
  });
});

// ---------------------------------------------------------------------------
// camelCase to snake_case
// ---------------------------------------------------------------------------

describe('snake_case conversion', () => {
  it('converts camelCase field names to snake_case in generated code', async () => {
    const sdl = /* GraphQL */ `
      type CamelTest {
        firstName: String!
        lastName: String!
      }
      type Query { ct: CamelTest! }
    `;
    const result = await generateEcho({ sdl });
    const rs = result.files.find((f) => f.path === 'raw_le_codec.generated.rs').content;
    expect(rs).toContain('self.first_name');
    expect(rs).toContain('self.last_name');
    expect(rs).not.toContain('self.firstName');
    expect(rs).not.toContain('self.lastName');
  });
});

// ---------------------------------------------------------------------------
// emitRawLeCodec edge cases (direct unit calls)
// ---------------------------------------------------------------------------

describe('emitRawLeCodec edge cases', () => {
  it('returns null for IR with no types', () => {
    expect(emitRawLeCodec({ types: [] })).toBeNull();
  });

  it('returns null for undefined types', () => {
    expect(emitRawLeCodec({})).toBeNull();
  });

  it('handles enum with single variant', () => {
    const rs = emitRawLeCodec({
      types: [{ name: 'Single', kind: 'ENUM', values: ['ONLY'] }],
    });
    expect(rs).toContain('Self::ONLY => 0,');
  });

  it('handles ID type same as String', () => {
    const rs = emitRawLeCodec({
      types: [{
        name: 'WithId',
        kind: 'OBJECT',
        fields: [{ name: 'uid', type: 'ID', required: true, list: false }],
      }],
    });
    expect(rs).toContain('encode_string(&self.uid)');
  });

  it('handles optional list field', () => {
    const rs = emitRawLeCodec({
      types: [{
        name: 'OptList',
        kind: 'OBJECT',
        fields: [{ name: 'items', type: 'String', required: false, list: true }],
      }],
    });
    expect(rs).toContain('encode_option(&self.items');
    expect(rs).toContain('encode_list');
  });
});
