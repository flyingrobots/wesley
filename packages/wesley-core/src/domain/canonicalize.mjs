/**
 * Canonical AST Representation (E1.1)
 *
 * Deterministic, canonical serialization of parsed GraphQL SDL.
 * Same semantic schema always produces identical bytes regardless of
 * formatting, field order, or comments.
 *
 * This is the trust root for all downstream hashing.
 */

import { parse } from 'graphql';

/**
 * Compare strings by Unicode code-point order (case-sensitive).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function codePointCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Normalize a string value: trim whitespace, NFC normalize.
 * @param {string} s
 * @returns {string}
 */
function nfc(s) {
  return s.trim().normalize('NFC');
}

/**
 * Extract a canonical value from a GraphQL AST value node.
 * @param {object} node - GraphQL AST value node
 * @returns {*}
 */
function extractValue(node) {
  switch (node.kind) {
    case 'StringValue':
      return nfc(node.value);
    case 'IntValue':
      return parseInt(node.value, 10);
    case 'FloatValue':
      return parseFloat(node.value);
    case 'BooleanValue':
      return node.value;
    case 'NullValue':
      return null;
    case 'EnumValue':
      return nfc(node.value);
    case 'ListValue':
      return node.values.map(extractValue);
    case 'ObjectValue': {
      const obj = {};
      for (const field of [...node.fields].sort((a, b) =>
        codePointCompare(a.name.value, b.name.value)
      )) {
        obj[nfc(field.name.value)] = extractValue(field.value);
      }
      return obj;
    }
    default:
      throw new Error(`Unknown AST value kind: ${node.kind}`);
  }
}

/**
 * Canonical representation of a single directive instance.
 * @param {object} dir - GraphQL AST directive node
 * @returns {object}
 */
function canonicalDirective(dir) {
  const args = [...(dir.arguments || [])].sort((a, b) =>
    codePointCompare(a.name.value, b.name.value)
  );
  const result = { name: nfc(dir.name.value) };
  if (args.length > 0) {
    result.arguments = args.map((a) => ({
      name: nfc(a.name.value),
      value: extractValue(a.value)
    }));
  }
  return result;
}

/**
 * Serialize a directive to a stable string for tie-breaking identical names.
 * @param {object} canonical - canonical directive object
 * @returns {string}
 */
function directiveSortKey(canonical) {
  return JSON.stringify(canonical);
}

/**
 * Sort an array of directive AST nodes canonically.
 * Primary: lexicographic by directive name.
 * Secondary (same name): lexicographic by serialized arguments.
 * @param {object[]} directives
 * @returns {object[]}
 */
function sortDirectives(directives) {
  const pairs = directives.map((d) => {
    const c = canonicalDirective(d);
    return { canonical: c, sortKey: directiveSortKey(c) };
  });
  pairs.sort((a, b) => {
    const nameComp = codePointCompare(a.canonical.name, b.canonical.name);
    if (nameComp !== 0) return nameComp;
    return codePointCompare(a.sortKey, b.sortKey);
  });
  return pairs.map((p) => p.canonical);
}

/**
 * Canonical type representation (recursive for NonNull/List wrappers).
 * @param {object} typeNode
 * @returns {object}
 */
function canonicalType(typeNode) {
  switch (typeNode.kind) {
    case 'NamedType':
      return { kind: 'Named', name: nfc(typeNode.name.value) };
    case 'ListType':
      return { kind: 'List', type: canonicalType(typeNode.type) };
    case 'NonNullType':
      return { kind: 'NonNull', type: canonicalType(typeNode.type) };
    default:
      throw new Error(`Unknown type kind: ${typeNode.kind}`);
  }
}

/**
 * Canonical input value (argument / input field) representation.
 * @param {object} node
 * @returns {object}
 */
function canonicalInputValue(node) {
  const result = {
    name: nfc(node.name.value),
    type: canonicalType(node.type)
  };
  if (node.defaultValue) {
    result.defaultValue = extractValue(node.defaultValue);
  }
  if (node.directives && node.directives.length > 0) {
    result.directives = sortDirectives(node.directives);
  }
  return result;
}

/**
 * Canonical field definition (for object types, interface types).
 * @param {object} field
 * @returns {object}
 */
function canonicalFieldDef(field) {
  const result = {
    name: nfc(field.name.value),
    type: canonicalType(field.type)
  };
  // Arguments sorted by name
  if (field.arguments && field.arguments.length > 0) {
    result.arguments = [...field.arguments]
      .sort((a, b) => codePointCompare(a.name.value, b.name.value))
      .map(canonicalInputValue);
  }
  if (field.directives && field.directives.length > 0) {
    result.directives = sortDirectives(field.directives);
  }
  return result;
}

/**
 * Canonical enum value definition.
 * @param {object} val
 * @returns {object}
 */
function canonicalEnumValue(val) {
  const result = { name: nfc(val.name.value) };
  if (val.directives && val.directives.length > 0) {
    result.directives = sortDirectives(val.directives);
  }
  return result;
}

// ─── extend type folding ───────────────────────────────────────────

/**
 * The set of definition kinds that have named extensions.
 */
const EXTENSION_MAP = {
  ObjectTypeExtension: 'ObjectTypeDefinition',
  InterfaceTypeExtension: 'InterfaceTypeDefinition',
  UnionTypeExtension: 'UnionTypeDefinition',
  EnumTypeExtension: 'EnumTypeDefinition',
  InputObjectTypeExtension: 'InputObjectTypeDefinition',
  ScalarTypeExtension: 'ScalarTypeDefinition'
};

/**
 * Fold all `extend type` (and extend interface, union, enum, input, scalar)
 * definitions into their base types. Mutates nothing — returns new arrays.
 *
 * @param {object[]} definitions - AST definition nodes
 * @returns {object[]} - definitions with extensions merged
 */
function foldExtensions(definitions) {
  /** @type {Map<string, object>} keyed by "Kind:Name" */
  const baseMap = new Map();
  /** @type {object[]} extensions to merge */
  const extensions = [];
  /** @type {object[]} non-type definitions (schema, directive defs, etc.) */
  const others = [];

  for (const def of definitions) {
    if (EXTENSION_MAP[def.kind]) {
      extensions.push(def);
    } else if (def.name) {
      // Clone the node so we can merge into it
      const key = `${def.kind}:${def.name.value}`;
      baseMap.set(key, cloneDefShallow(def));
    } else {
      others.push(def);
    }
  }

  // Merge each extension into its base
  for (const ext of extensions) {
    const baseKind = EXTENSION_MAP[ext.kind];
    const key = `${baseKind}:${ext.name.value}`;
    const base = baseMap.get(key);
    if (!base) {
      throw new Error(`Cannot extend type "${ext.name.value}": no base definition found`);
    }
    mergeExtension(base, ext);
  }

  return [...others, ...baseMap.values()];
}

/**
 * Shallow clone a definition node so we can mutate fields/values/members
 * without affecting the original AST.
 * @param {object} def
 * @returns {object}
 */
function cloneDefShallow(def) {
  const clone = { ...def };
  if (clone.fields) clone.fields = [...clone.fields];
  if (clone.values) clone.values = [...clone.values];
  if (clone.types) clone.types = [...clone.types];
  if (clone.interfaces) clone.interfaces = [...clone.interfaces];
  if (clone.directives) clone.directives = [...clone.directives];
  return clone;
}

/**
 * Merge fields / values / members / interfaces / directives from an
 * extension into a base definition.
 * @param {object} base
 * @param {object} ext
 */
function mergeExtension(base, ext) {
  if (ext.fields) {
    base.fields = base.fields ? [...base.fields, ...ext.fields] : [...ext.fields];
  }
  if (ext.values) {
    base.values = base.values ? [...base.values, ...ext.values] : [...ext.values];
  }
  if (ext.types) {
    base.types = base.types ? [...base.types, ...ext.types] : [...ext.types];
  }
  if (ext.interfaces) {
    base.interfaces = base.interfaces
      ? [...base.interfaces, ...ext.interfaces]
      : [...ext.interfaces];
  }
  if (ext.directives && ext.directives.length > 0) {
    base.directives = base.directives
      ? [...base.directives, ...ext.directives]
      : [...ext.directives];
  }
}

// ─── per-kind canonical builders ────────────────────────────────────

function canonicalObjectType(def) {
  const result = {
    kind:
      def.kind === 'InterfaceTypeDefinition' ? 'InterfaceTypeDefinition' : 'ObjectTypeDefinition',
    name: nfc(def.name.value)
  };
  if (def.interfaces && def.interfaces.length > 0) {
    result.interfaces = [...def.interfaces].map((i) => nfc(i.name.value)).sort(codePointCompare);
  }
  if (def.fields && def.fields.length > 0) {
    result.fields = [...def.fields]
      .sort((a, b) => codePointCompare(a.name.value, b.name.value))
      .map(canonicalFieldDef);
  }
  if (def.directives && def.directives.length > 0) {
    result.directives = sortDirectives(def.directives);
  }
  return result;
}

function canonicalUnionType(def) {
  const result = {
    kind: 'UnionTypeDefinition',
    name: nfc(def.name.value)
  };
  if (def.types && def.types.length > 0) {
    result.members = [...def.types].map((t) => nfc(t.name.value)).sort(codePointCompare);
  }
  if (def.directives && def.directives.length > 0) {
    result.directives = sortDirectives(def.directives);
  }
  return result;
}

function canonicalEnumType(def) {
  const result = {
    kind: 'EnumTypeDefinition',
    name: nfc(def.name.value)
  };
  if (def.values && def.values.length > 0) {
    result.values = [...def.values]
      .sort((a, b) => codePointCompare(a.name.value, b.name.value))
      .map(canonicalEnumValue);
  }
  if (def.directives && def.directives.length > 0) {
    result.directives = sortDirectives(def.directives);
  }
  return result;
}

function canonicalInputObjectType(def) {
  const result = {
    kind: 'InputObjectTypeDefinition',
    name: nfc(def.name.value)
  };
  if (def.fields && def.fields.length > 0) {
    result.fields = [...def.fields]
      .sort((a, b) => codePointCompare(a.name.value, b.name.value))
      .map(canonicalInputValue);
  }
  if (def.directives && def.directives.length > 0) {
    result.directives = sortDirectives(def.directives);
  }
  return result;
}

function canonicalScalarType(def) {
  const result = {
    kind: 'ScalarTypeDefinition',
    name: nfc(def.name.value)
  };
  if (def.directives && def.directives.length > 0) {
    result.directives = sortDirectives(def.directives);
  }
  return result;
}

function canonicalSchemaDefinition(def) {
  const result = { kind: 'SchemaDefinition' };
  const ops = [...(def.operationTypes || [])].sort((a, b) =>
    codePointCompare(a.operation, b.operation)
  );
  if (ops.length > 0) {
    result.operationTypes = ops.map((op) => ({
      operation: op.operation,
      type: nfc(op.type.name.value)
    }));
  }
  if (def.directives && def.directives.length > 0) {
    result.directives = sortDirectives(def.directives);
  }
  return result;
}

function canonicalDirectiveDefinition(def) {
  const result = {
    kind: 'DirectiveDefinition',
    name: nfc(def.name.value)
  };
  if (def.arguments && def.arguments.length > 0) {
    result.arguments = [...def.arguments]
      .sort((a, b) => codePointCompare(a.name.value, b.name.value))
      .map(canonicalInputValue);
  }
  result.repeatable = !!def.repeatable;
  if (def.locations && def.locations.length > 0) {
    result.locations = [...def.locations].map((l) => l.value).sort(codePointCompare);
  }
  return result;
}

// ─── top-level dispatch ─────────────────────────────────────────────

/**
 * Convert a single AST definition to its canonical form.
 * @param {object} def
 * @returns {object}
 */
function canonicalDefinition(def) {
  switch (def.kind) {
    case 'ObjectTypeDefinition':
    case 'InterfaceTypeDefinition':
      return canonicalObjectType(def);
    case 'UnionTypeDefinition':
      return canonicalUnionType(def);
    case 'EnumTypeDefinition':
      return canonicalEnumType(def);
    case 'InputObjectTypeDefinition':
      return canonicalInputObjectType(def);
    case 'ScalarTypeDefinition':
      return canonicalScalarType(def);
    case 'SchemaDefinition':
      return canonicalSchemaDefinition(def);
    case 'DirectiveDefinition':
      return canonicalDirectiveDefinition(def);
    default:
      throw new Error(`Unsupported definition kind: ${def.kind}`);
  }
}

/**
 * Sort key for a definition: kind first, then name.
 * SchemaDefinition has no name and always sorts first.
 * @param {object} def
 * @returns {string}
 */
function definitionSortKey(def) {
  const name = def.name ? def.name.value : '';
  return `${def.kind}:${name}`;
}

// ─── public API ─────────────────────────────────────────────────────

const encoder = new TextEncoder();

/**
 * Canonicalize a GraphQL SDL string into deterministic bytes.
 *
 * Same semantic schema always produces identical Uint8Array output,
 * regardless of formatting, field order, or comments.
 *
 * @param {string} sdl - GraphQL SDL source text
 * @returns {Uint8Array} - canonical bytes (UTF-8 encoded JSON)
 */
export function canonicalize(sdl) {
  // Parse SDL — graphql-js will throw on invalid input
  const ast = parse(sdl, { noLocation: true });

  // Fold extend types into base definitions
  const folded = foldExtensions(ast.definitions);

  // Sort definitions by kind then name
  const sorted = [...folded].sort((a, b) =>
    codePointCompare(definitionSortKey(a), definitionSortKey(b))
  );

  // Build canonical representation
  const canonical = sorted.map(canonicalDefinition);

  // Deterministic JSON — keys are already in controlled order from object
  // literals, but we use a replacer to guarantee sorted keys at every level
  const json = JSON.stringify(canonical, sortedKeysReplacer);

  return encoder.encode(json);
}

/**
 * JSON.stringify replacer that ensures object keys are sorted.
 * This is the final guarantee of byte-level determinism.
 * @param {string} _key
 * @param {*} value
 * @returns {*}
 */
function sortedKeysReplacer(_key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = value[k];
    }
    return sorted;
  }
  return value;
}
