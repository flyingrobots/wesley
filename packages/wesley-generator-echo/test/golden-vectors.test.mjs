import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, Kind } from 'graphql';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectorDir = join(__dirname, 'golden-vectors');

// ---------------------------------------------------------------------------
// Reference encoder — minimal, spec-conformant implementation of raw_le
// encoding rules. This is the single source of truth used to validate
// the golden vector hex strings.
//
// SPEC-0008 rules:
//   - Fields encoded in **alphabetical** order
//   - Boolean:  1 byte — 0x00 false, 0x01 true
//   - Int:      i32 little-endian (4 bytes)
//   - Float:    f32 little-endian (4 bytes), NaN -> canonical 0x7FC00000
//   - String/ID: u32 LE length prefix + UTF-8 bytes
//   - Option:   0x00 = None, 0x01 + encoded value = Some
//   - List:     u32 LE count + encoded elements
//   - Enum:     u32 LE index, variants sorted alphabetically
//   - Nested:   encode recursively, fields in alphabetical order
// ---------------------------------------------------------------------------

function refEncodeBool(v) {
  return [v ? 0x01 : 0x00];
}

function refEncodeI32(v) {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, v, true);
  return [...new Uint8Array(buf)];
}

function refEncodeF32(v) {
  const buf = new ArrayBuffer(4);
  const dv = new DataView(buf);
  if (Number.isNaN(v)) {
    // Canonical NaN: bit pattern 0x7FC00000 stored as little-endian bytes
    dv.setUint32(0, 0x7FC00000, true);
  } else {
    dv.setFloat32(0, v, true);
  }
  return [...new Uint8Array(buf)];
}

function refEncodeString(v) {
  const encoded = new TextEncoder().encode(v);
  const lenBuf = new ArrayBuffer(4);
  new DataView(lenBuf).setUint32(0, encoded.length, true);
  return [...new Uint8Array(lenBuf), ...encoded];
}

function refEncodeOption(v, encodeInner) {
  if (v == null) return [0x00];
  return [0x01, ...encodeInner(v)];
}

function refEncodeList(arr, encodeInner) {
  const lenBuf = new ArrayBuffer(4);
  new DataView(lenBuf).setUint32(0, arr.length, true);
  const bytes = [...new Uint8Array(lenBuf)];
  for (const item of arr) bytes.push(...encodeInner(item));
  return bytes;
}

function refEncodeEnum(value, sortedVariants) {
  const idx = sortedVariants.indexOf(value);
  if (idx === -1) throw new Error(`Unknown enum variant: ${value}`);
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, idx, true);
  return [...new Uint8Array(buf)];
}

// ---------------------------------------------------------------------------
// Schema introspection — parse the SDL from each fixture to determine field
// types, required/list flags, and enum definitions.
// ---------------------------------------------------------------------------

/** @param {string} sdl */
function parseSchema(sdl) {
  const doc = parse(sdl);
  const types = new Map();
  const enums = new Map();

  for (const def of doc.definitions) {
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION) {
      if (def.name.value === 'Query' || def.name.value === 'Mutation') continue;
      const fields = (def.fields ?? []).map((f) => {
        const { typeName, required, list } = unwrapType(f.type);
        return { name: f.name.value, type: typeName, required, list };
      });
      types.set(def.name.value, { kind: 'OBJECT', fields });
    }
    if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
      const values = (def.values ?? []).map((v) => v.name.value);
      enums.set(def.name.value, { kind: 'ENUM', values });
    }
  }

  return { types, enums };
}

function unwrapType(typeNode) {
  let required = false;
  let list = false;
  let node = typeNode;

  if (node.kind === Kind.NON_NULL_TYPE) {
    required = true;
    node = node.type;
  }
  if (node.kind === Kind.LIST_TYPE) {
    list = true;
    node = node.type;
    if (node.kind === Kind.NON_NULL_TYPE) {
      node = node.type;
    }
  }

  const typeName = node.name?.value ?? 'Unknown';
  return { typeName, required, list };
}

// ---------------------------------------------------------------------------
// Recursive encoder: encodes a JS value according to a schema type definition
// ---------------------------------------------------------------------------

const SCALAR_ENCODERS = {
  Boolean: refEncodeBool,
  Int: refEncodeI32,
  Float: refEncodeF32,
  String: refEncodeString,
  ID: refEncodeString,
};

/**
 * Encode a value for a given scalar or complex type.
 * @param {*} value       - the JS value to encode
 * @param {string} typeName - the GraphQL type name
 * @param {boolean} required - whether the field is required (non-nullable)
 * @param {boolean} list     - whether the field is a list
 * @param {{ types: Map, enums: Map }} schema - parsed schema info
 * @returns {number[]}
 */
function encodeFieldValue(value, typeName, required, list, schema) {
  const innerEncoder = (v) => encodeSingleValue(v, typeName, schema);

  if (list && required) {
    return refEncodeList(value, innerEncoder);
  }
  if (list && !required) {
    return refEncodeOption(value, (listVal) => refEncodeList(listVal, innerEncoder));
  }
  if (!required) {
    return refEncodeOption(value, innerEncoder);
  }
  return innerEncoder(value);
}

/**
 * Encode a single (non-list, non-option) value.
 */
function encodeSingleValue(value, typeName, schema) {
  if (SCALAR_ENCODERS[typeName]) {
    return SCALAR_ENCODERS[typeName](value);
  }
  if (schema.enums.has(typeName)) {
    const enumDef = schema.enums.get(typeName);
    const sorted = [...enumDef.values].sort((a, b) => a.localeCompare(b));
    return refEncodeEnum(value, sorted);
  }
  if (schema.types.has(typeName)) {
    return encodeObject(value, typeName, schema);
  }
  throw new Error(`Unknown type: ${typeName}`);
}

/**
 * Encode an object value according to its type definition.
 * Fields are sorted alphabetically.
 */
function encodeObject(value, typeName, schema) {
  const typeDef = schema.types.get(typeName);
  if (!typeDef) throw new Error(`Unknown object type: ${typeName}`);

  const sortedFields = [...typeDef.fields].sort((a, b) => a.name.localeCompare(b.name));
  const bytes = [];

  for (const field of sortedFields) {
    const fieldValue = value[field.name];
    bytes.push(...encodeFieldValue(fieldValue, field.type, field.required, field.list, schema));
  }

  return bytes;
}

function toHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Pre-process a vector value: resolve _nan sentinels.
//
// In JSON, NaN cannot be represented. The convention in golden vector files
// is to use `_nan: true` as a sibling flag at the object level. When a Float
// field has a null value and the object-level `_nan` flag is true, the test
// harness substitutes NaN for that field.
// ---------------------------------------------------------------------------

function resolveNanSentinels(value, typeName, schema) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value;

  const typeDef = schema.types.get(typeName);
  if (!typeDef) return value;

  const resolved = { ...value };
  const hasNanFlag = resolved._nan === true;

  for (const field of typeDef.fields) {
    const fv = resolved[field.name];

    // If the _nan flag is set at the object level and a Float field is null,
    // replace it with NaN.
    if (field.type === 'Float' && hasNanFlag && fv == null) {
      resolved[field.name] = NaN;
    }
    // Recurse into nested object fields
    else if (schema.types.has(field.type) && fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
      resolved[field.name] = resolveNanSentinels(fv, field.type, schema);
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Test runner: read all vector files and validate each vector against the
// reference encoder.
// ---------------------------------------------------------------------------

const vectorFiles = readdirSync(vectorDir).filter((f) => f.endsWith('.json'));

for (const file of vectorFiles) {
  const fixture = JSON.parse(readFileSync(join(vectorDir, file), 'utf-8'));
  const schema = parseSchema(fixture.schema);

  describe(`golden vectors: ${file}`, () => {
    for (const vec of fixture.vectors) {
      // Support both fixture-level and per-vector type names
      const typeName = vec.type ?? fixture.type;

      it(vec.label, () => {
        // Resolve NaN sentinels before encoding
        const resolvedValue = resolveNanSentinels(vec.value, typeName, schema);

        // Encode using the reference encoder
        const encoded = encodeObject(resolvedValue, typeName, schema);
        const hex = toHex(encoded);

        expect(hex).toBe(vec.raw_le_hex);
      });
    }
  });
}
