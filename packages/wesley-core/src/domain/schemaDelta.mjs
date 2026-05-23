/**
 * SchemaDelta Vocabulary (E1.6)
 *
 * Machine-readable structural diff between two GraphQL SDL versions.
 * Classifies every change as breaking or non-breaking according to
 * standard GraphQL evolution rules.
 */

import { parse } from 'graphql';

// ─── JSDoc types ────────────────────────────────────────────────────

/**
 * @typedef {object} TypeDelta
 * @property {string} name
 * @property {boolean} breaking
 * @property {string} description
 */

/**
 * @typedef {object} FieldChange
 * @property {string} name
 * @property {'added'|'removed'|'changed'} kind
 * @property {boolean} breaking
 * @property {string} description
 */

/**
 * @typedef {object} DirectiveChange
 * @property {string} name
 * @property {'added'|'removed'|'changed'} kind
 * @property {boolean} breaking
 * @property {string} description
 */

/**
 * @typedef {object} TypeModification
 * @property {string} name
 * @property {boolean} breaking
 * @property {string} description
 * @property {FieldChange[]} fieldChanges
 * @property {DirectiveChange[]} directiveChanges
 */

/**
 * @typedef {object} OpDelta
 * @property {string} name
 * @property {boolean} breaking
 * @property {string} description
 */

/**
 * @typedef {object} ArgChange
 * @property {string} name
 * @property {'added'|'removed'|'changed'} kind
 * @property {boolean} breaking
 * @property {string} description
 */

/**
 * @typedef {object} OpModification
 * @property {string} name
 * @property {boolean} breaking
 * @property {string} description
 * @property {ArgChange[]} argChanges
 * @property {string|null} returnTypeChange
 */

/**
 * @typedef {object} SchemaDelta
 * @property {TypeDelta[]} added_types
 * @property {TypeDelta[]} removed_types
 * @property {TypeModification[]} modified_types
 * @property {OpDelta[]} added_ops
 * @property {OpDelta[]} removed_ops
 * @property {OpModification[]} modified_ops
 */

// ─── internal helpers ───────────────────────────────────────────────

const ROOT_OP_KINDS = new Set(['query', 'mutation', 'subscription']);
const DEFAULT_ROOT_NAMES = { query: 'Query', mutation: 'Mutation', subscription: 'Subscription' };

/**
 * Serialize a GraphQL type node to a stable string for comparison.
 * @param {object} typeNode
 * @returns {string}
 */
function typeToString(typeNode) {
  switch (typeNode.kind) {
    case 'NamedType':
      return typeNode.name.value;
    case 'ListType':
      return `[${typeToString(typeNode.type)}]`;
    case 'NonNullType':
      return `${typeToString(typeNode.type)}!`;
    default:
      return '?';
  }
}

/**
 * Check if a type node is non-nullable (required).
 * @param {object} typeNode
 * @returns {boolean}
 */
function isNonNull(typeNode) {
  return typeNode.kind === 'NonNullType';
}

/**
 * Serialize a directive node for comparison.
 * @param {object} dir
 * @returns {string}
 */
function directiveToKey(dir) {
  const args = (dir.arguments || [])
    .map((a) => `${a.name.value}:${valueToString(a.value)}`)
    .sort()
    .join(',');
  return `@${dir.name.value}(${args})`;
}

/**
 * Quick value serialization for directive arg comparison.
 * @param {object} node
 * @returns {string}
 */
function valueToString(node) {
  switch (node.kind) {
    case 'StringValue':
      return `"${node.value}"`;
    case 'IntValue':
    case 'FloatValue':
    case 'EnumValue':
      return node.value;
    case 'BooleanValue':
      return String(node.value);
    case 'NullValue':
      return 'null';
    case 'ListValue':
      return `[${node.values.map(valueToString).join(',')}]`;
    case 'ObjectValue':
      return `{${node.fields
        .map((f) => `${f.name.value}:${valueToString(f.value)}`)
        .sort()
        .join(',')}}`;
    default:
      return '?';
  }
}

/**
 * Build a map of type definitions from parsed AST.
 * Handles extend types by merging into base.
 * @param {object[]} definitions
 * @returns {{ types: Map<string, object>, rootTypeNames: Set<string>, ops: Map<string, object> }}
 */
function buildMaps(definitions) {
  /** @type {Map<string, object>} */
  const types = new Map();
  /** @type {Set<string>} root type names (Query, Mutation, Subscription or custom) */
  const rootTypeNames = new Set(Object.values(DEFAULT_ROOT_NAMES));

  // First pass: detect schema definitions for custom root type names
  for (const def of definitions) {
    if (def.kind === 'SchemaDefinition') {
      // Clear defaults, use explicit roots
      rootTypeNames.clear();
      for (const op of def.operationTypes || []) {
        if (ROOT_OP_KINDS.has(op.operation)) {
          rootTypeNames.add(op.type.name.value);
        }
      }
    }
  }

  // Extension kinds → base kinds
  const extMap = {
    ObjectTypeExtension: 'ObjectTypeDefinition',
    InterfaceTypeExtension: 'InterfaceTypeDefinition',
    UnionTypeExtension: 'UnionTypeDefinition',
    EnumTypeExtension: 'EnumTypeDefinition',
    InputObjectTypeExtension: 'InputObjectTypeDefinition',
    ScalarTypeExtension: 'ScalarTypeDefinition'
  };

  // Collect base definitions
  for (const def of definitions) {
    if (
      def.name &&
      !extMap[def.kind] &&
      def.kind !== 'SchemaDefinition' &&
      def.kind !== 'DirectiveDefinition'
    ) {
      types.set(def.name.value, cloneDef(def));
    }
  }

  // Merge extensions
  for (const def of definitions) {
    if (extMap[def.kind] && def.name) {
      const base = types.get(def.name.value);
      if (base) {
        if (def.fields) base.fields = [...(base.fields || []), ...def.fields];
        if (def.values) base.values = [...(base.values || []), ...def.values];
        if (def.types) base.types = [...(base.types || []), ...def.types];
        if (def.directives && def.directives.length > 0) {
          base.directives = [...(base.directives || []), ...def.directives];
        }
      }
    }
  }

  // Extract operations from root types
  /** @type {Map<string, object>} op name -> field def */
  const ops = new Map();
  for (const name of rootTypeNames) {
    const rootType = types.get(name);
    if (rootType && rootType.fields) {
      for (const field of rootType.fields) {
        ops.set(`${name}.${field.name.value}`, field);
      }
    }
  }

  return { types, rootTypeNames, ops };
}

/**
 * Shallow clone a definition.
 * @param {object} def
 * @returns {object}
 */
function cloneDef(def) {
  const c = { ...def };
  if (c.fields) c.fields = [...c.fields];
  if (c.values) c.values = [...c.values];
  if (c.types) c.types = [...c.types];
  if (c.directives) c.directives = [...c.directives];
  return c;
}

/**
 * Build a field map from a type definition.
 * @param {object} typeDef
 * @returns {Map<string, object>}
 */
function fieldMap(typeDef) {
  const m = new Map();
  const fields = typeDef.fields || typeDef.values || [];
  for (const f of fields) {
    m.set(f.name.value, f);
  }
  return m;
}

/**
 * Build a directive map from a definition.
 * @param {object} def
 * @returns {Map<string, string>} directive name -> serialized key
 */
function directiveMap(def) {
  const m = new Map();
  for (const d of def.directives || []) {
    m.set(d.name.value, directiveToKey(d));
  }
  return m;
}

/**
 * Diff directives between two definitions.
 * @param {object} oldDef
 * @param {object} newDef
 * @param {string} parentName
 * @returns {DirectiveChange[]}
 */
function diffDirectives(oldDef, newDef, parentName) {
  const oldDirs = directiveMap(oldDef);
  const newDirs = directiveMap(newDef);
  /** @type {DirectiveChange[]} */
  const changes = [];

  for (const [name, key] of newDirs) {
    if (!oldDirs.has(name)) {
      changes.push({
        name,
        kind: 'added',
        breaking: false,
        description: `Directive @${name} added to ${parentName}`
      });
    } else if (oldDirs.get(name) !== key) {
      changes.push({
        name,
        kind: 'changed',
        breaking: true,
        description: `Directive @${name} changed on ${parentName}`
      });
    }
  }
  for (const [name] of oldDirs) {
    if (!newDirs.has(name)) {
      changes.push({
        name,
        kind: 'removed',
        breaking: true,
        description: `Directive @${name} removed from ${parentName}`
      });
    }
  }

  return changes;
}

/**
 * Check whether a type definition is an enum.
 * @param {object} def
 * @returns {boolean}
 */
function isEnum(def) {
  return def.kind === 'EnumTypeDefinition' || def.kind === 'EnumTypeExtension';
}

/**
 * Diff fields/values between two versions of the same type.
 * @param {object} oldDef
 * @param {object} newDef
 * @param {string} typeName
 * @returns {FieldChange[]}
 */
function diffFields(oldDef, newDef, typeName) {
  const oldFields = fieldMap(oldDef);
  const newFields = fieldMap(newDef);
  /** @type {FieldChange[]} */
  const changes = [];
  const enumMode = isEnum(oldDef) || isEnum(newDef);

  for (const [name, field] of newFields) {
    if (!oldFields.has(name)) {
      if (enumMode) {
        changes.push({
          name,
          kind: 'added',
          breaking: false,
          description: `Enum value "${name}" added to ${typeName}`
        });
      } else {
        const req = isNonNull(field.type);
        changes.push({
          name,
          kind: 'added',
          breaking: req,
          description: req
            ? `Required field "${name}" added to ${typeName} (breaking)`
            : `Optional field "${name}" added to ${typeName}`
        });
      }
    }
  }

  for (const [name] of oldFields) {
    if (!newFields.has(name)) {
      if (enumMode) {
        changes.push({
          name,
          kind: 'removed',
          breaking: true,
          description: `Enum value "${name}" removed from ${typeName}`
        });
      } else {
        changes.push({
          name,
          kind: 'removed',
          breaking: true,
          description: `Field "${name}" removed from ${typeName}`
        });
      }
    }
  }

  // Changed types (only for non-enum fields that have .type)
  if (!enumMode) {
    for (const [name, newField] of newFields) {
      const oldField = oldFields.get(name);
      if (oldField && oldField.type && newField.type) {
        const oldType = typeToString(oldField.type);
        const newType = typeToString(newField.type);
        if (oldType !== newType) {
          changes.push({
            name,
            kind: 'changed',
            breaking: true,
            description: `Field "${name}" on ${typeName} changed type from ${oldType} to ${newType}`
          });
        }
      }
    }
  }

  return changes;
}

/**
 * Diff arguments between two operation fields.
 * @param {object} oldField
 * @param {object} newField
 * @param {string} opName
 * @returns {ArgChange[]}
 */
function diffArgs(oldField, newField, opName) {
  const oldArgs = new Map((oldField.arguments || []).map((a) => [a.name.value, a]));
  const newArgs = new Map((newField.arguments || []).map((a) => [a.name.value, a]));
  /** @type {ArgChange[]} */
  const changes = [];

  for (const [name, arg] of newArgs) {
    if (!oldArgs.has(name)) {
      const req = isNonNull(arg.type);
      changes.push({
        name,
        kind: 'added',
        breaking: req,
        description: req
          ? `Required argument "${name}" added to ${opName} (breaking)`
          : `Optional argument "${name}" added to ${opName}`
      });
    }
  }

  for (const [name] of oldArgs) {
    if (!newArgs.has(name)) {
      changes.push({
        name,
        kind: 'removed',
        breaking: true,
        description: `Argument "${name}" removed from ${opName}`
      });
    }
  }

  for (const [name, newArg] of newArgs) {
    const oldArg = oldArgs.get(name);
    if (oldArg) {
      const oldType = typeToString(oldArg.type);
      const newType = typeToString(newArg.type);
      if (oldType !== newType) {
        changes.push({
          name,
          kind: 'changed',
          breaking: true,
          description: `Argument "${name}" on ${opName} changed type from ${oldType} to ${newType}`
        });
      }
    }
  }

  return changes;
}

// ─── public API ─────────────────────────────────────────────────────

/**
 * Compute the structural delta between two GraphQL SDL strings.
 *
 * @param {string} oldSDL - previous schema version
 * @param {string} newSDL - new schema version
 * @returns {SchemaDelta}
 */
export function computeDelta(oldSDL, newSDL) {
  const oldAST = parse(oldSDL, { noLocation: true });
  const newAST = parse(newSDL, { noLocation: true });

  const oldMaps = buildMaps(oldAST.definitions);
  const newMaps = buildMaps(newAST.definitions);

  /** @type {TypeDelta[]} */
  const added_types = [];
  /** @type {TypeDelta[]} */
  const removed_types = [];
  /** @type {TypeModification[]} */
  const modified_types = [];

  // --- types ---
  for (const [name] of newMaps.types) {
    if (!oldMaps.types.has(name)) {
      added_types.push({ name, breaking: false, description: `Type "${name}" added` });
    }
  }

  for (const [name] of oldMaps.types) {
    if (!newMaps.types.has(name)) {
      removed_types.push({ name, breaking: true, description: `Type "${name}" removed` });
    }
  }

  for (const [name, newDef] of newMaps.types) {
    const oldDef = oldMaps.types.get(name);
    if (!oldDef) continue;

    const fieldChanges = diffFields(oldDef, newDef, name);
    const directiveChanges = diffDirectives(oldDef, newDef, name);

    if (fieldChanges.length > 0 || directiveChanges.length > 0) {
      const breaking =
        fieldChanges.some((c) => c.breaking) || directiveChanges.some((c) => c.breaking);
      const parts = [];
      if (fieldChanges.length > 0) parts.push(`${fieldChanges.length} field change(s)`);
      if (directiveChanges.length > 0) parts.push(`${directiveChanges.length} directive change(s)`);
      modified_types.push({
        name,
        breaking,
        description: `Type "${name}" modified: ${parts.join(', ')}`,
        fieldChanges,
        directiveChanges
      });
    }
  }

  // --- operations ---
  /** @type {OpDelta[]} */
  const added_ops = [];
  /** @type {OpDelta[]} */
  const removed_ops = [];
  /** @type {OpModification[]} */
  const modified_ops = [];

  for (const [name] of newMaps.ops) {
    if (!oldMaps.ops.has(name)) {
      added_ops.push({ name, breaking: false, description: `Operation "${name}" added` });
    }
  }

  for (const [name] of oldMaps.ops) {
    if (!newMaps.ops.has(name)) {
      removed_ops.push({ name, breaking: true, description: `Operation "${name}" removed` });
    }
  }

  for (const [name, newField] of newMaps.ops) {
    const oldField = oldMaps.ops.get(name);
    if (!oldField) continue;

    const argChanges = diffArgs(oldField, newField, name);

    let returnTypeChange = null;
    const oldRet = typeToString(oldField.type);
    const newRet = typeToString(newField.type);
    if (oldRet !== newRet) {
      returnTypeChange = `Return type changed from ${oldRet} to ${newRet}`;
    }

    if (argChanges.length > 0 || returnTypeChange) {
      const breaking = argChanges.some((c) => c.breaking) || returnTypeChange !== null;
      const parts = [];
      if (argChanges.length > 0) parts.push(`${argChanges.length} arg change(s)`);
      if (returnTypeChange) parts.push(returnTypeChange);
      modified_ops.push({
        name,
        breaking,
        description: `Operation "${name}" modified: ${parts.join(', ')}`,
        argChanges,
        returnTypeChange
      });
    }
  }

  return {
    added_types,
    removed_types,
    modified_types,
    added_ops,
    removed_ops,
    modified_ops
  };
}
