#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';

export const PROJECTION_NAME = 'js-table-vs-rust-table.v0';
export const PROJECTION_NORMALIZER_VERSION = 'v0';

export const DEFAULT_PARITY_FIXTURES = Object.freeze([
  'test/fixtures/ir-parity/small-schema.graphql',
  'test/fixtures/ir-parity/medium-schema.graphql',
  'test/fixtures/ir-parity/directive-heavy-schema.graphql',
  'test/fixtures/ir-parity/legacy-alias-schema.graphql'
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

export function projectLegacyTableIR(ir) {
  const tables = Array.isArray(ir?.tables) ? ir.tables : [];

  return withProjectionEnvelope({
    tables: tables.map(projectLegacyTable).sort(compareByName)
  });
}

export function projectRustL1IR(ir) {
  const types = Array.isArray(ir?.types) ? ir.types : [];
  const tables = types
    .filter(type => type?.kind === 'OBJECT' && type?.directives?.wes_table)
    .map(projectRustTable)
    .sort(compareByName);

  return withProjectionEnvelope({ tables });
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

function withProjectionEnvelope(value) {
  return {
    projection: PROJECTION_NAME,
    normalizerVersion: PROJECTION_NORMALIZER_VERSION,
    ...value
  };
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
  return left.name.localeCompare(right.name);
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
