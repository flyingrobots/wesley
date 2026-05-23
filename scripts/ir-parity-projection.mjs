#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { canonicalize } from '../packages/wesley-core/src/domain/canonicalize.mjs';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';

export const TABLE_PROJECTION_NAME = 'js-table-vs-rust-table.v0';
export const TYPE_FAMILY_PROJECTION_NAME = 'js-sdl-type-family-vs-rust-l1-type-family.v0';
export const PROJECTION_NAME = TABLE_PROJECTION_NAME;
export const PROJECTION_NORMALIZER_VERSION = 'v0';
export const PROJECTION_NAMES = Object.freeze([
  TABLE_PROJECTION_NAME,
  TYPE_FAMILY_PROJECTION_NAME
]);

export const DEFAULT_PARITY_FIXTURES = Object.freeze([
  parityFixture('test/fixtures/ir-parity/small-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/medium-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/directive-heavy-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/legacy-alias-schema.graphql', TABLE_PROJECTION_NAME),
  parityFixture('test/fixtures/ir-parity/schema-extensions-schema.graphql', TYPE_FAMILY_PROJECTION_NAME)
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
const textDecoder = new TextDecoder();

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
    .filter(type => type?.kind === 'OBJECT' && type?.directives?.wes_table)
    .map(projectRustTable)
    .sort(compareByName);

  return withProjectionEnvelope(TABLE_PROJECTION_NAME, { tables });
}

export function projectLegacyTypeFamilySDL(sdl) {
  const canonical = JSON.parse(textDecoder.decode(canonicalize(sdl)));
  const types = canonical
    .map(projectCanonicalTypeFamilyDefinition)
    .filter(Boolean)
    .sort(compareByNameThenKind);

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

function projectCanonicalTypeFamilyDefinition(definition) {
  const kind = CANONICAL_KIND_TO_TYPE_FAMILY_KIND.get(definition.kind);
  if (!kind) return null;

  const projected = {
    name: definition.name,
    kind,
    directives: projectCanonicalDirectives(definition.directives)
  };

  if (Array.isArray(definition.interfaces) && definition.interfaces.length > 0) {
    projected.implements = [...definition.interfaces].sort(compareStrings);
  }

  if (Array.isArray(definition.fields) && definition.fields.length > 0) {
    projected.fields = definition.fields
      .map(projectCanonicalTypeFamilyField)
      .sort(compareByName);
  }

  if (Array.isArray(definition.members) && definition.members.length > 0) {
    projected.unionMembers = [...definition.members].sort(compareStrings);
  }

  if (Array.isArray(definition.values) && definition.values.length > 0) {
    projected.enumValues = definition.values
      .map(value => value.name)
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
    projected.fields = type.fields
      .map(projectRustTypeFamilyField)
      .sort(compareByName);
  }

  if (Array.isArray(type.unionMembers) && type.unionMembers.length > 0) {
    projected.unionMembers = [...type.unionMembers].sort(compareStrings);
  }

  if (Array.isArray(type.enumValues) && type.enumValues.length > 0) {
    projected.enumValues = type.enumValues
      .map(value => typeof value === 'string' ? value : value.name)
      .sort(compareStrings);
  }

  return projected;
}

function projectCanonicalTypeFamilyField(field) {
  const projected = {
    name: field.name,
    type: projectCanonicalType(field.type),
    directives: projectCanonicalDirectives(field.directives)
  };

  if (Object.hasOwn(field, 'defaultValue')) {
    projected.defaultValue = field.defaultValue;
  }

  if (Array.isArray(field.arguments) && field.arguments.length > 0) {
    projected.arguments = field.arguments
      .map(projectCanonicalTypeFamilyField)
      .sort(compareByName);
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
    projected.arguments = field.arguments
      .map(projectRustTypeFamilyField)
      .sort(compareByName);
  }

  return projected;
}

function projectCanonicalType(type) {
  let nullable = true;
  let current = type;

  if (current?.kind === 'NonNull') {
    nullable = false;
    current = current.type;
  }

  if (current?.kind === 'Named') {
    return {
      base: current.name,
      nullable,
      isList: false
    };
  }

  if (current?.kind === 'List') {
    let listItemNullable = true;
    let item = current.type;

    if (item?.kind === 'NonNull') {
      listItemNullable = false;
      item = item.type;
    }

    if (item?.kind !== 'Named') {
      throw new Error('Nested list types are not supported by type-family parity projection v0');
    }

    return {
      base: item.name,
      nullable,
      isList: true,
      listItemNullable
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

  return projected;
}

function projectCanonicalDirectives(directives = []) {
  const projected = {};

  for (const directive of directives || []) {
    insertProjectedDirectiveValue(
      projected,
      directive.name,
      projectCanonicalDirectiveValue(directive)
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

function projectCanonicalDirectiveValue(directive) {
  if (!Array.isArray(directive.arguments) || directive.arguments.length === 0) {
    return true;
  }

  const args = {};
  for (const arg of directive.arguments) {
    args[arg.name] = arg.value;
  }
  return args;
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
    fields: (table.fields || []).map(field => projectLegacyField(field, indexByField))
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
  const fields = (type.fields || [])
    .filter(isRustColumnField)
    .map(projectRustField);

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
  return `/${path.map(part => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function preview(value) {
  if (value === undefined) return '<missing>';
  return value;
}
