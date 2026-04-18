import { describe, it, expect } from 'vitest';
import { generateEcho } from '../src/index.mjs';
import { emitRawLeTsCodec } from '../src/emitRawLeTsCodec.mjs';

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

const hashSDL = /* GraphQL */ `
  scalar Hash
  type HashedArtifact {
    digest: Hash!
    label: String!
  }
  type Query { artifact: HashedArtifact! }
`;

// ---------------------------------------------------------------------------
// Helper to get the TS codec content from a full generation
// ---------------------------------------------------------------------------

async function getTsCodec(sdl) {
  const result = await generateEcho({ sdl });
  const file = result.files.find((f) => f.path === 'raw_le_codec.generated.ts');
  return file?.content ?? null;
}

// ---------------------------------------------------------------------------
// 1. File generation
// ---------------------------------------------------------------------------

describe('raw_le_codec.generated.ts file generation', () => {
  it('generates raw_le_codec.generated.ts for schemas with types', async () => {
    const result = await generateEcho({ sdl: basicSDL });
    const file = result.files.find((f) => f.path === 'raw_le_codec.generated.ts');
    expect(file).toBeDefined();
    expect(file.content.length).toBeGreaterThan(0);
  });

  // 2. No file when no types
  it('omits raw_le_codec.generated.ts when no OBJECT or ENUM types', async () => {
    const sdl = 'type Query { hello: String! }';
    const result = await generateEcho({ sdl });
    const file = result.files.find((f) => f.path === 'raw_le_codec.generated.ts');
    expect(file).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Uses DataView/Uint8Array, not Buffer
// ---------------------------------------------------------------------------

describe('browser-safe output', () => {
  it('uses DataView and Uint8Array, never Buffer', async () => {
    const ts = await getTsCodec(allTypesSDL);
    expect(ts).toContain('DataView');
    expect(ts).toContain('Uint8Array');
    // Ensure no Node.js Buffer usage — only ArrayBuffer is acceptable
    expect(ts).not.toMatch(/(?<!Array)Buffer/);
  });
});

// ---------------------------------------------------------------------------
// 4. Alphabetical field order
// ---------------------------------------------------------------------------

describe('alphabetical field order', () => {
  it('encodes field a before field b in encode function', async () => {
    const ts = await getTsCodec(basicSDL);
    // In-place encoder has the field ordering logic
    const encodeBlock = ts.slice(ts.indexOf('function _encodeFoo'));
    const aIdx = encodeBlock.indexOf('value.a');
    const bIdx = encodeBlock.indexOf('value.b');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeLessThan(bIdx);
  });
});

// ---------------------------------------------------------------------------
// 5. Boolean encoding
// ---------------------------------------------------------------------------

describe('Boolean encoding', () => {
  it('uses 0x00/0x01 pattern', async () => {
    const ts = await getTsCodec(allTypesSDL);
    expect(ts).toContain('0x00');
    expect(ts).toContain('0x01');
    expect(ts).toContain('_encodeBool');
  });
});

// ---------------------------------------------------------------------------
// 6. Int encoding
// ---------------------------------------------------------------------------

describe('Int encoding', () => {
  it('uses DataView.setInt32 with LE flag', async () => {
    const ts = await getTsCodec(basicSDL);
    expect(ts).toContain('setInt32');
    expect(ts).toMatch(/setInt32\(\s*0\s*,\s*v\s*,\s*true\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 7. Float encoding with NaN canonicalization
// ---------------------------------------------------------------------------

describe('Float encoding', () => {
  it('uses DataView.setFloat32 with LE and NaN canonicalization', async () => {
    const ts = await getTsCodec(allTypesSDL);
    expect(ts).toContain('setFloat32');
    expect(ts).toMatch(/setFloat32\(\s*0\s*,\s*v\s*,\s*true\s*\)/);
    expect(ts).toContain('0x7FC00000');
    expect(ts).toContain('Number.isNaN');
  });
});

// ---------------------------------------------------------------------------
// 8. String/ID encoding
// ---------------------------------------------------------------------------

describe('String/ID encoding', () => {
  it('uses length-prefixed encoding with DataView.setUint32 + TextEncoder', async () => {
    const ts = await getTsCodec(basicSDL);
    expect(ts).toContain('setUint32');
    expect(ts).toContain('TextEncoder');
    expect(ts).toContain('_encodeString');
  });
});

// ---------------------------------------------------------------------------
// 9. Optional field encoding
// ---------------------------------------------------------------------------

describe('Optional field encoding', () => {
  it('uses 0x00 for null/undefined, 0x01 prefix for present values', async () => {
    const ts = await getTsCodec(optionalSDL);
    expect(ts).toContain('_encodeOption');
    // The helper function checks null with 0x00/0x01
    expect(ts).toContain('buf.push(0x00)');
    expect(ts).toContain('buf.push(0x01)');
  });

  it('wraps optional fields with _encodeOption call', async () => {
    const ts = await getTsCodec(optionalSDL);
    expect(ts).toContain('_encodeOption(buf, value.name');
    expect(ts).toContain('_encodeOption(buf, value.score');
  });
});

// ---------------------------------------------------------------------------
// 10. List encoding
// ---------------------------------------------------------------------------

describe('List encoding', () => {
  it('uses count-prefixed encoding with u32 LE', async () => {
    const ts = await getTsCodec(listSDL);
    expect(ts).toContain('_encodeList');
    // The helper uses setUint32 for the count
    expect(ts).toContain('setUint32');
  });

  it('calls _encodeList for list fields', async () => {
    const ts = await getTsCodec(listSDL);
    expect(ts).toContain('_encodeList(buf, value.scores');
    expect(ts).toContain('_encodeList(buf, value.tags');
  });
});

// ---------------------------------------------------------------------------
// 11. Enum encoding
// ---------------------------------------------------------------------------

describe('Enum encoding', () => {
  it('encodes alphabetically-sorted variants as u32 LE indices', async () => {
    const ts = await getTsCodec(enumSDL);
    // Alphabetical: ACTIVE=0, ARCHIVED=1, DRAFT=2
    expect(ts).toContain("case 'ACTIVE': idx = 0; break;");
    expect(ts).toContain("case 'ARCHIVED': idx = 1; break;");
    expect(ts).toContain("case 'DRAFT': idx = 2; break;");
    // Uses setUint32 with LE
    expect(ts).toContain('setUint32(0, idx, true)');
  });

  it('decodes enum with alphabetical variant mapping', async () => {
    const ts = await getTsCodec(enumSDL);
    expect(ts).toContain("case 0: value = 'ACTIVE'; break;");
    expect(ts).toContain("case 1: value = 'ARCHIVED'; break;");
    expect(ts).toContain("case 2: value = 'DRAFT'; break;");
  });

  it('emits an internal enum helper so object codecs do not call undefined functions', async () => {
    const ts = await getTsCodec(mixedSDL);
    expect(ts).toContain('function _encodeColor(buf: number[], value: Color): void {');
    expect(ts).toContain('_encodeColor(buf, value.color);');
  });
});

// ---------------------------------------------------------------------------
// 12. Nested object encoding
// ---------------------------------------------------------------------------

describe('Nested object encoding', () => {
  it('calls the inner type encode function for nested objects', async () => {
    const ts = await getTsCodec(nestedSDL);
    expect(ts).toContain('_encodeInner');
    expect(ts).toContain('encodeOuter');
    // The in-place Outer encoder references the in-place Inner encoder
    const outerBlock = ts.slice(ts.indexOf('function _encodeOuter'));
    expect(outerBlock).toContain('_encodeInner');
  });
});

// ---------------------------------------------------------------------------
// 13. Returns null for empty IR
// ---------------------------------------------------------------------------

describe('emitRawLeTsCodec edge cases', () => {
  it('returns null for IR with no types', () => {
    expect(emitRawLeTsCodec({ types: [] })).toBeNull();
  });

  it('returns null for undefined types', () => {
    expect(emitRawLeTsCodec({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 14. Optional list fields
// ---------------------------------------------------------------------------

describe('Optional list fields', () => {
  it('combines option + list encoding for optional list fields', () => {
    const ts = emitRawLeTsCodec({
      types: [{
        name: 'OptList',
        kind: 'OBJECT',
        fields: [{ name: 'items', type: 'String', required: false, list: true }]
      }]
    });
    expect(ts).toContain('_encodeOption');
    expect(ts).toContain('_encodeList');
    // Decode side: _decodeOption wrapping _decodeList
    expect(ts).toContain('_decodeOption');
    expect(ts).toContain('_decodeList');
  });
});

// ---------------------------------------------------------------------------
// 15. Type interfaces generated
// ---------------------------------------------------------------------------

describe('Type interfaces generated', () => {
  it('generates TypeScript interface for OBJECT types', async () => {
    const ts = await getTsCodec(basicSDL);
    expect(ts).toContain('export interface Foo {');
    expect(ts).toContain('a: number;');
    expect(ts).toContain('b: string;');
  });

  it('generates TypeScript type for ENUM types', async () => {
    const ts = await getTsCodec(enumSDL);
    expect(ts).toContain('export type Status =');
    expect(ts).toContain("'ACTIVE'");
    expect(ts).toContain("'ARCHIVED'");
    expect(ts).toContain("'DRAFT'");
  });

  it('generates interface for all-types object', async () => {
    const ts = await getTsCodec(allTypesSDL);
    expect(ts).toContain('export interface Everything {');
    expect(ts).toContain('active: boolean;');
    expect(ts).toContain('count: number;');
    expect(ts).toContain('label: string;');
    expect(ts).toContain('ratio: number;');
    expect(ts).toContain('uid: string;');
  });

  it('maps Hash custom scalars to string in TypeScript interfaces', async () => {
    const ts = await getTsCodec(hashSDL);
    expect(ts).toContain('export interface HashedArtifact {');
    expect(ts).toContain('digest: string;');
  });
});

describe('Hash scalar encoding', () => {
  it('treats Hash custom scalars like strings in encode/decode helpers', async () => {
    const ts = await getTsCodec(hashSDL);
    expect(ts).toContain('_encodeString(buf, value.digest);');
    expect(ts).toContain('const digest = _decodeString(bytes, off);');
  });
});

// ---------------------------------------------------------------------------
// 16. TextEncoder for strings (browser-safe)
// ---------------------------------------------------------------------------

describe('TextEncoder for strings', () => {
  it('uses TextEncoder for UTF-8 encoding (browser-safe)', async () => {
    const ts = await getTsCodec(basicSDL);
    expect(ts).toContain('new TextEncoder()');
    expect(ts).toContain('_textEncoder.encode');
  });
});

// ---------------------------------------------------------------------------
// NaN canonical encoding — must match Rust (little-endian 0x7FC00000)
// ---------------------------------------------------------------------------

describe('NaN canonical encoding endianness', () => {
  it('emits NaN bits in little-endian order (matching Rust to_le_bytes)', async () => {
    const ts = await getTsCodec(allTypesSDL);
    // The NaN branch must use little-endian (true), same as the normal Float path.
    // Big-endian (false) would produce [0x7F, 0xC0, 0x00, 0x00] — wrong!
    // Little-endian (true) produces [0x00, 0x00, 0xC0, 0x7F] — matches Rust.
    expect(ts).toMatch(/setUint32\(\s*0\s*,\s*0x7FC00000\s*,\s*true\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// DO NOT EDIT header
// ---------------------------------------------------------------------------

describe('header comment', () => {
  it('includes DO NOT EDIT comment', async () => {
    const ts = await getTsCodec(basicSDL);
    expect(ts).toContain('DO NOT EDIT');
  });
});

// ---------------------------------------------------------------------------
// Nested object decode — offset must advance correctly
// ---------------------------------------------------------------------------

describe('Nested object decode offset advancement', () => {
  it('generates decode closure that advances offset for nested objects', async () => {
    const ts = await getTsCodec(nestedSDL);
    // The decode closure for nested types must advance off.v by bytesRead.
    // Bug: `(bytes, off) => decode${typeName}(bytes, off.v).value` discards bytesRead.
    // Fix: must capture result and advance: off.v += res.bytesRead
    const decodeFn = ts.slice(ts.indexOf('export function decodeOuter'));
    // The closure should NOT simply return .value without advancing offset
    expect(decodeFn).not.toMatch(/=>\s*decodeInner\(bytes,\s*off\.v\)\.value/);
  });

  it('generates list-of-nested decode that advances offset per element', () => {
    const ts = emitRawLeTsCodec({
      types: [
        { name: 'Child', kind: 'OBJECT', fields: [{ name: 'val', type: 'Int', required: true, list: false }] },
        { name: 'Parent', kind: 'OBJECT', fields: [{ name: 'children', type: 'Child', required: true, list: true }] }
      ]
    });
    // The decode list closure for Child must advance offset
    expect(ts).not.toMatch(/=>\s*decodeChild\(bytes,\s*off\.v\)\.value[^;]*[,)]/);
  });
});

// ---------------------------------------------------------------------------
// Mixed schema (enum + object)
// ---------------------------------------------------------------------------

describe('Mixed schema', () => {
  it('generates codecs for both enum and object types', async () => {
    const ts = await getTsCodec(mixedSDL);
    expect(ts).toContain('export function encodeColor');
    expect(ts).toContain('export function decodeColor');
    expect(ts).toContain('export function encodeSprite');
    expect(ts).toContain('export function decodeSprite');
  });
});
