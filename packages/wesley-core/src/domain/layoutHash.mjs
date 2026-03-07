/**
 * Layout Hash Computation (E2a.3)
 *
 * Produces a deterministic SHA-256 hex digest that uniquely identifies
 * the exact byte layout of a type's encoding. Decoders can refuse to
 * decode blobs whose layout_hash doesn't match.
 *
 * Uses globalThis.crypto.subtle (available in Node 18+ and browsers)
 * so @wesley/core remains host-agnostic with zero external deps.
 */

import { canonicalizeJSON } from './registryHash.mjs';

const encoder = new TextEncoder();

/**
 * Map a GraphQL scalar/wrapper type to its raw_le encoding identifier.
 *
 * @param {string} graphqlType - The GraphQL type name (e.g. "Int", "String")
 * @param {{ required: boolean, list: boolean, kind?: string }} opts
 * @returns {string} encoding identifier
 */
export function encodingForType(graphqlType, { required = true, list = false, kind } = {}) {
  const base = baseEncoding(graphqlType, kind);
  let enc = list ? `list_${base}` : base;
  if (!required) {
    enc = `option_${enc}`;
  }
  return enc;
}

/**
 * @param {string} typeName
 * @param {string} [kind]
 * @returns {string}
 */
function baseEncoding(typeName, kind) {
  if (kind === 'ENUM') return 'enum_u32_le';
  switch (typeName) {
  case 'Boolean': return 'bool_u8';
  case 'Int':     return 'i32_le';
  case 'Float':   return 'f32_le';
  case 'String':  return 'len_prefix_utf8';
  case 'ID':      return 'len_prefix_utf8';
  default:        return `nested_${typeName}`;
  }
}

/**
 * Build a canonical layout descriptor from an IR type object.
 *
 * The descriptor captures every aspect of the byte layout:
 * format version, endianness, type name, and ordered field encodings.
 *
 * @param {object} irType - A type from the Echo IR (OBJECT or ENUM)
 * @param {Map<string, object>} [typeIndex] - Optional map of type name → IR type for resolving field kinds
 * @returns {object} layout descriptor
 */
export function buildLayoutDescriptor(irType, typeIndex) {
  const descriptor = {
    format: 'raw_le/v1',
    endian: 'little',
    type_name: irType.name
  };

  if (irType.kind === 'ENUM') {
    const variants = [...(irType.values ?? [])].sort();
    descriptor.variants = variants;
    descriptor.variant_encoding = 'enum_u32_le';
  } else {
    // OBJECT: build sorted field list
    const fields = [...(irType.fields ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => {
        const fieldKind = resolveFieldKind(f.type, typeIndex);
        return {
          name: f.name,
          type: f.type,
          required: f.required,
          encoding: encodingForType(f.type, { required: f.required, list: f.list, kind: fieldKind })
        };
      });
    descriptor.fields = fields;
  }

  return descriptor;
}

/**
 * Resolve whether a field's type is an ENUM (for encoding purposes).
 * @param {string} typeName
 * @param {Map<string, object>} [typeIndex]
 * @returns {string|undefined}
 */
function resolveFieldKind(typeName, typeIndex) {
  if (!typeIndex) return undefined;
  const resolved = typeIndex.get(typeName);
  return resolved?.kind;
}

/**
 * Compute a deterministic SHA-256 layout hash from a layout descriptor.
 *
 * The descriptor is serialized to canonical JSON (sorted keys, compact),
 * then hashed with SHA-256. The result is a 64-character lowercase hex string.
 *
 * @param {object} descriptor - Layout descriptor (from buildLayoutDescriptor)
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function computeLayoutHash(descriptor) {
  const json = canonicalizeJSON(descriptor);
  const bytes = encoder.encode(json);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
