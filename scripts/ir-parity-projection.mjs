#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { parse } from 'graphql';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';

export const TABLE_PROJECTION_NAME = 'js-table-vs-rust-table.v0';
export const TYPE_FAMILY_PROJECTION_NAME = 'js-sdl-type-family-vs-rust-l1-type-family.v0';
export const PROJECTION_NAME = TABLE_PROJECTION_NAME;
export const PROJECTION_NORMALIZER_VERSION = 'v0';
export const PROJECTION_NAMES = Object.freeze([TABLE_PROJECTION_NAME, TYPE_FAMILY_PROJECTION_NAME]);

export const DEFAULT_PARITY_FIXTURES = Object.freeze([
  parityFixture('test/fixtures/ir-parity/small-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/medium-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/directive-heavy-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/legacy-alias-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture(
    'test/fixtures/ir-parity/schema-extensions-schema.graphql',
    TYPE_FAMILY_PROJECTION_NAME
  ),
  parityFixture('test/fixtures/ir-parity/nested-list-schema.graphql', TYPE_FAMILY_PROJECTION_NAME)
]);

const TABLE_COLUMN_SCALARS = new Set([
  'ID',
  'UUID',
  'String',
  'Int',
  'Float',
  'Boolean',
  'DateTime',
  'Date',
  'Time',
  'JSON'
]);
const CANONICAL_KIND_TO_TYPE_FAMILY_KIND = new Map([
  ['ScalarTypeDefinition', 'SCALAR'],
  ['ObjectTypeDefinition', 'OBJECT'],
  ['InterfaceTypeDefinition', 'INTERFACE'],
  ['UnionTypeDefinition', 'UNION'],
  ['EnumTypeDefinition', 'ENUM'],
  ['InputObjectTypeDefinition', 'INPUT_OBJECT']
]);
const TYPE_EXTENSION_TO_DEFINITION_KIND = new Map([
  ['ScalarTypeExtension', 'ScalarTypeDefinition'],
  ['ObjectTypeExtension', 'ObjectTypeDefinition'],
  ['InterfaceTypeExtension', 'InterfaceTypeDefinition'],
  ['UnionTypeExtension', 'UnionTypeDefinition'],
  ['EnumTypeExtension', 'EnumTypeDefinition'],
  ['InputObjectTypeExtension', 'InputObjectTypeDefinition']
]);

export function parityFixture(fixture, projection = TABLE_PROJECTION_NAME) {
  assertKnownProjection(projection);
  return Object.freeze({ fixture, projection });
}

export function normalizeParityFixture(entry, defaultProjection = TABLE_PROJECTION_NAME) {
  if (typeof entry === 'string') {
    return parityFixture(entry, defaultProjection);
  }

  if (entry && typeof entry.fixture === 'string') {
    return parityFixture(entry.fixture, entry.projection || defaultProjection);
  }

  throw new Error(`Invalid parity fixture entry: ${JSON.stringify(entry)}`);
}

export function formatParityFixture(entry) {
  const fixture = normalizeParityFixture(entry);
  return `${fixture.fixture}\t${fixture.projection}`;
}

export function projectLegacyProjection(projection, context) {
  assertKnownProjection(projection);

  if (projection === TABLE_PROJECTION_NAME) {
    return projectLegacyTableIR(context.legacyIr);
  }

  return projectLegacyTypeFamilySDL(context.sdl);
}

export function projectRustProjection(projection, ir) {
  assertKnownProjection(projection);

  if (projection === TABLE_PROJECTION_NAME) {
    return projectRustL1IR(ir);
  }

  return projectRustTypeFamilyIR(ir);
}

export function assertKnownProjection(projection) {
  if (!PROJECTION_NAMES.includes(projection)) {
    throw new Error(
      `Unknown IR parity projection: ${projection}. Known projections: ${PROJECTION_NAMES.join(', ')}`
    );
  }

  return projection;
}

export function projectLegacyTableIR(ir) {
  const tables = Array.isArray(ir?.tables) ? ir.tables : [];

  return withProjectionEnvelope(TABLE_PROJECTION_NAME, {
    tables: tables.map(projectLegacyTable).sort(compareByName)
  });
}

export function projectRustL1IR(ir) {
  const types = Array.isArray(ir?.types) ? ir.types : [];
  const tables = types
    .filter((type) => type?.kind === 'OBJECT' && type?.directives?.wes_table)
    .map(projectRustTable)
    .sort(compareByName);

  return withProjectionEnvelope(TABLE_PROJECTION_NAME, { tables });
}

export function projectLegacyTypeFamilySDL(sdl) {
  const document = parse(sdl);
  const definitions = foldTypeFamilyExtensions(document.definitions || []);
  const types = definitions.map(projectGraphqlTypeFamilyDefinition).sort(compareByNameThenKind);

  return withProjectionEnvelope(TYPE_FAMILY_PROJECTION_NAME, { types });
}

export function projectRustTypeFamilyIR(ir) {
  const types = (Array.isArray(ir?.types) ? ir.types : [])
    .map(projectRustTypeFamilyDefinition)
    .sort(compareByNameThenKind);

  return withProjectionEnvelope(TYPE_FAMILY_PROJECTION_NAME, { types });
}

export function canonicalProjectionBytes(value) {
  return canonicalizeJSON(value);
}

export function projectionHash(value) {
  return sha256Hex(canonicalProjectionBytes(value));
}

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function firstMismatch(left, right) {
  return findFirstMismatch(left, right, []);
}

function withProjectionEnvelope(projection, value) {
  return {
    projection,
    normalizerVersion: PROJECTION_NORMALIZER_VERSION,
    ...value
  };
}

function foldTypeFamilyExtensions(definitions) {
  const folded = [];
  const byKey = new Map();
  const extensions = [];

  for (const definition of definitions) {
    if (CANONICAL_KIND_TO_TYPE_FAMILY_KIND.has(definition.kind)) {
      const clone = cloneTypeFamilyDefinition(definition);
      folded.push(clone);
      byKey.set(typeFamilyDefinitionKey(clone.kind, clone.name.value), clone);
    } else if (TYPE_EXTENSION_TO_DEFINITION_KIND.has(definition.kind)) {
      extensions.push(definition);
    }
  }

  for (const extension of extensions) {
    const baseKind = TYPE_EXTENSION_TO_DEFINITION_KIND.get(extension.kind);
    const base = byKey.get(typeFamilyDefinitionKey(baseKind, extension.name.value));
    if (!base) {
      throw new Error(`Cannot extend type "${extension.name.value}": no base definition found`);
    }
    mergeTypeFamilyExtension(base, extension);
  }

  return folded;
}

function cloneTypeFamilyDefinition(definition) {
  return {
    ...definition,
    directives: definition.directives ? [...definition.directives] : [],
    fields: definition.fields ? [...definition.fields] : [],
    interfaces: definition.interfaces ? [...definition.interfaces] : [],
    types: definition.types ? [...definition.types] : [],
    values: definition.values ? [...definition.values] : []
  };
}

function typeFamilyDefinitionKey(kind, name) {
  return `${kind}:${name}`;
}

function mergeTypeFamilyExtension(base, extension) {
  if (extension.directives?.length > 0) {
    base.directives.push(...extension.directives);
  }
  if (extension.fields?.length > 0) {
    base.fields.push(...extension.fields);
  }
  if (extension.interfaces?.length > 0) {
    base.interfaces.push(...extension.interfaces);
  }
  if (extension.types?.length > 0) {
    base.types.push(...extension.types);
  }
  if (extension.values?.length > 0) {
    base.values.push(...extension.values);
  }
}

function projectGraphqlTypeFamilyDefinition(definition) {
  const kind = CANONICAL_KIND_TO_TYPE_FAMILY_KIND.get(definition.kind);

  const projected = {
    name: normalizeAstString(definition.name.value),
    kind,
    directives: projectGraphqlDirectives(definition.directives)
  };

  if (Array.isArray(definition.interfaces) && definition.interfaces.length > 0) {
    projected.implements = definition.interfaces
      .map((type) => normalizeAstString(type.name.value))
      .sort(compareStrings);
  }

  if (Array.isArray(definition.fields) && definition.fields.length > 0) {
    projected.fields = definition.fields.map(projectGraphqlTypeFamilyField).sort(compareByName);
  }

  if (Array.isArray(definition.types) && definition.types.length > 0) {
    projected.unionMembers = definition.types
      .map((type) => normalizeAstString(type.name.value))
      .sort(compareStrings);
  }

  if (Array.isArray(definition.values) && definition.values.length > 0) {
    projected.enumValues = definition.values
      .map((value) => normalizeAstString(value.name.value))
      .sort(compareStrings);
  }

  return projected;
}

function projectRustTypeFamilyDefinition(type) {
  const projected = {
    name: type.name,
    kind: type.kind,
    directives: projectRustDirectives(type.directives)
  };

  if (Array.isArray(type.implements) && type.implements.length > 0) {
    projected.implements = [...type.implements].sort(compareStrings);
  }

  if (Array.isArray(type.fields) && type.fields.length > 0) {
    projected.fields = type.fields.map(projectRustTypeFamilyField).sort(compareByName);
  }

  if (Array.isArray(type.unionMembers) && type.unionMembers.length > 0) {
    projected.unionMembers = [...type.unionMembers].sort(compareStrings);
  }

  if (Array.isArray(type.enumValues) && type.enumValues.length > 0) {
    projected.enumValues = type.enumValues
      .map((value) => (typeof value === 'string' ? value : value.name))
      .sort(compareStrings);
  }

  return projected;
}

function projectGraphqlTypeFamilyField(field) {
  const projected = {
    name: normalizeAstString(field.name.value),
    type: projectGraphqlType(field.type),
    directives: projectGraphqlDirectives(field.directives)
  };

  if (field.defaultValue) {
    projected.defaultValue = projectGraphqlValue(field.defaultValue);
  }

  if (Array.isArray(field.arguments) && field.arguments.length > 0) {
    projected.arguments = field.arguments.map(projectGraphqlTypeFamilyField).sort(compareByName);
  }

  return projected;
}

function projectRustTypeFamilyField(field) {
  const projected = {
    name: field.name,
    type: projectRustTypeFamilyFieldType(field.type || {}),
    directives: projectRustDirectives(field.directives)
  };

  if (Object.hasOwn(field, 'defaultValue')) {
    projected.defaultValue = field.defaultValue;
  }

  if (Array.isArray(field.arguments) && field.arguments.length > 0) {
    projected.arguments = field.arguments.map(projectRustTypeFamilyField).sort(compareByName);
  }

  return projected;
}

function projectGraphqlType(type) {
  const shape = projectGraphqlTypeShape(type, true);
  const projected = {
    base: shape.base,
    nullable: shape.nullable,
    isList: shape.listWrappers.length > 0
  };

  if (projected.isList) {
    projected.listItemNullable = shape.listWrappers[1]?.nullable ?? shape.leafNullable;
  }

  if (shape.listWrappers.length > 1) {
    projected.listWrappers = shape.listWrappers;
    projected.leafNullable = shape.leafNullable;
  }

  return projected;
}

function projectGraphqlTypeShape(type, nullable) {
  if (type?.kind === 'NonNullType') {
    return projectGraphqlTypeShape(type.type, false);
  }

  if (type?.kind === 'NamedType') {
    return {
      base: normalizeAstString(type.name.value),
      nullable,
      listWrappers: [],
      leafNullable: nullable
    };
  }

  if (type?.kind === 'ListType') {
    const nested = projectGraphqlTypeShape(type.type, true);
    return {
      ...nested,
      nullable,
      listWrappers: [{ nullable }, ...nested.listWrappers]
    };
  }

  throw new Error(`Unsupported GraphQL type shape: ${JSON.stringify(type)}`);
}

function projectRustTypeFamilyFieldType(type) {
  const projected = {
    base: type.base,
    nullable: type.nullable === true,
    isList: type.isList === true
  };

  if (projected.isList) {
    projected.listItemNullable = type.listItemNullable !== false;
  }

  if (Array.isArray(type.listWrappers) && type.listWrappers.length > 1) {
    projected.listWrappers = type.listWrappers.map((wrapper) => ({
      nullable: wrapper?.nullable === true
    }));
    projected.leafNullable = type.leafNullable !== false;
  }

  return projected;
}

function projectGraphqlDirectives(directives = []) {
  const projected = {};

  for (const directive of directives || []) {
    insertProjectedDirectiveValue(
      projected,
      normalizeAstString(directive.name.value),
      projectGraphqlDirectiveValue(directive)
    );
  }

  return projected;
}

function insertProjectedDirectiveValue(target, name, value) {
  if (!Object.hasOwn(target, name)) {
    target[name] = value;
    return;
  }

  if (Array.isArray(target[name])) {
    target[name].push(value);
    return;
  }

  target[name] = [target[name], value];
}

function projectGraphqlDirectiveValue(directive) {
  if (!Array.isArray(directive.arguments) || directive.arguments.length === 0) {
    return true;
  }

  const args = {};
  for (const arg of [...directive.arguments].sort(compareAstNodeNames)) {
    args[normalizeAstString(arg.name.value)] = projectGraphqlValue(arg.value);
  }
  return args;
}

function projectGraphqlValue(value) {
  switch (value.kind) {
    case 'StringValue':
    case 'EnumValue':
      return normalizeAstString(value.value);
    case 'IntValue':
      return Number.parseInt(value.value, 10);
    case 'FloatValue':
      return Number.parseFloat(value.value);
    case 'BooleanValue':
      return value.value;
    case 'NullValue':
      return null;
    case 'ListValue':
      return value.values.map(projectGraphqlValue);
    case 'ObjectValue': {
      const projected = {};
      for (const field of [...value.fields].sort(compareAstNodeNames)) {
        projected[normalizeAstString(field.name.value)] = projectGraphqlValue(field.value);
      }
      return projected;
    }
    default:
      throw new Error(`Unknown GraphQL value kind: ${value.kind}`);
  }
}

function projectRustDirectives(directives = {}) {
  const projected = {};

  for (const name of Object.keys(directives || {}).sort(compareStrings)) {
    projected[name] = directives[name];
  }

  return projected;
}

function projectLegacyTable(table) {
  const indexByField = legacyIndexByField(table);

  return {
    name: table.name,
    directives: projectLegacyTableDirectives(table.directives || {}),
    fields: (table.fields || []).map((field) => projectLegacyField(field, indexByField))
  };
}

function projectLegacyTableDirectives(directives) {
  const projected = {
    table: directives.table === true
  };

  if (directives.rls) {
    projected.rls = true;
  }

  if (directives.tenant?.field) {
    projected.tenant = { field: directives.tenant.field };
  }

  return projected;
}

function projectLegacyField(field, indexByField) {
  return {
    name: field.name,
    type: projectLegacyFieldType(field),
    directives: projectLegacyFieldDirectives(field, indexByField)
  };
}

function projectLegacyFieldType(field) {
  const type = {
    base: field.type?.base,
    nullable: field.nullable === true,
    isList: field.type?.isList === true
  };

  if (type.isList) {
    type.listItemNullable = field.type?.listItemNullable !== false;
  }

  return type;
}

function projectLegacyFieldDirectives(field, indexByField) {
  const source = field.directives || {};
  const projected = {};
  const index = indexByField.get(field.name);

  if (source.pk === true) projected.pk = true;
  if (source.unique === true) projected.unique = true;
  if (source.index === true || index) projected.index = projectIndex(index);

  if (source.default) {
    projected.default = { value: source.default.value };
  }

  if (source.fk) {
    projected.fk = {
      targetTable: source.fk.targetTable,
      targetField: source.fk.targetField
    };
  }

  return projected;
}

function legacyIndexByField(table) {
  const byField = new Map();

  for (const index of table.indexes || []) {
    if (!Array.isArray(index.fields) || index.fields.length !== 1) continue;
    byField.set(index.fields[0], index);
  }

  return byField;
}

function projectRustTable(type) {
  const tableDirective = type.directives.wes_table;
  const fields = (type.fields || []).filter(isRustColumnField).map(projectRustField);

  return {
    name: tableDirective?.name || type.name,
    directives: projectRustTableDirectives(type.directives || {}),
    fields
  };
}

function projectRustTableDirectives(directives) {
  const projected = {
    table: Boolean(directives.wes_table)
  };

  if (Object.hasOwn(directives, 'wes_rls')) {
    projected.rls = true;
  }

  if (directives.wes_tenant?.by) {
    projected.tenant = { field: directives.wes_tenant.by };
  }

  return projected;
}

function projectRustField(field) {
  return {
    name: field.name,
    type: projectRustFieldType(field.type || {}),
    directives: projectRustFieldDirectives(field.directives || {})
  };
}

function projectRustFieldType(type) {
  const projected = {
    base: type.base,
    nullable: type.nullable === true,
    isList: type.isList === true
  };

  if (projected.isList) {
    projected.listItemNullable = type.listItemNullable !== false;
  }

  return projected;
}

function projectRustFieldDirectives(directives) {
  const projected = {};

  if (directives.wes_pk === true) projected.pk = true;
  if (directives.wes_unique === true) projected.unique = true;
  if (Object.hasOwn(directives, 'wes_index')) {
    projected.index = projectIndex(directives.wes_index);
  }

  if (directives.wes_default) {
    projected.default = { value: directives.wes_default.value };
  }

  if (directives.wes_fk?.ref) {
    const [targetTable, targetField] = directives.wes_fk.ref.split('.');
    projected.fk = { targetTable, targetField };
  }

  return projected;
}

function projectIndex(index) {
  if (!index || index === true) return true;

  const projected = {};
  if (index.name) projected.name = index.name;
  if (index.using) projected.using = index.using;

  return Object.keys(projected).length > 0 ? projected : true;
}

function isRustColumnField(field) {
  if (field?.directives?.wes_fk) return true;
  return TABLE_COLUMN_SCALARS.has(field?.type?.base);
}

function compareByName(left, right) {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function compareByNameThenKind(left, right) {
  const name = compareByName(left, right);
  if (name !== 0) return name;
  return compareStrings(left.kind, right.kind);
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareAstNodeNames(left, right) {
  return compareStrings(normalizeAstString(left.name.value), normalizeAstString(right.name.value));
}

function normalizeAstString(value) {
  return value.trim().normalize('NFC');
}

function findFirstMismatch(left, right, path) {
  if (Object.is(left, right)) return null;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return mismatch(path, left, right, 'type');
    }

    const max = Math.max(left.length, right.length);
    for (let index = 0; index < max; index += 1) {
      if (index >= left.length || index >= right.length) {
        return mismatch([...path, index], left[index], right[index], 'array-length');
      }
      const child = findFirstMismatch(left[index], right[index], [...path, index]);
      if (child) return child;
    }
    return null;
  }

  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return mismatch(path, left, right, 'type');
    }

    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) {
        return mismatch([...path, key], left[key], right[key], 'object-key');
      }
      const child = findFirstMismatch(left[key], right[key], [...path, key]);
      if (child) return child;
    }
    return null;
  }

  return mismatch(path, left, right, 'value');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mismatch(path, left, right, reason) {
  return {
    path: toJsonPointer(path),
    reason,
    legacy: preview(left),
    rust: preview(right)
  };
}

function toJsonPointer(path) {
  if (path.length === 0) return '/';
  return `/${path.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function preview(value) {
  if (value === undefined) return '<missing>';
  return value;
}
