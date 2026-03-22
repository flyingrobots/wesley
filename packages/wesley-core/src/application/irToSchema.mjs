/**
 * Convert Wesley IR to core domain Schema
 *
 * TypeScriptGenerator and ZodGenerator expect a Schema with getTables(),
 * where each table has getFields() returning Field instances. The IR now
 * uses structured FieldType objects with GraphQL scalar names, so this
 * adapter is a straightforward mapping.
 */

import { Schema, Table, Field } from '../domain/Schema.mjs';

function buildFieldDirectives(field, table) {
  const directives = { ...(field.directives || {}) };

  if (field.directives.pk) {
    directives['@primaryKey'] = {};
  }

  if (field.directives.fk) {
    directives['@foreignKey'] = {
      ref: `${field.directives.fk.targetTable}.${field.directives.fk.targetField}`
    };
  }

  if (field.directives.unique) {
    directives['@unique'] = {};
  }

  if (field.directives.default) {
    directives['@default'] = { expr: field.directives.default.value };
  }

  if (field.directives.index) {
    // Find matching indexes from the table-level index array
    const indexes = table.indexes?.filter(i => i.fields?.includes(field.name));
    if (indexes?.length === 1) {
      directives['@index'] = { name: indexes[0].name, using: indexes[0].using };
    } else if (indexes?.length > 1) {
      directives['@index'] = indexes.map(i => ({ name: i.name, using: i.using }));
    } else {
      directives['@index'] = {};
    }
  }

  const uidDirective = normalizeUidDirective(field.directives);
  if (uidDirective) {
    directives['@uid'] = uidDirective;
  }

  return directives;
}

function buildTableDirectives(table) {
  const directives = { ...(table.directives || {}) };

  if (table.directives?.table && !directives['@table']) {
    directives['@table'] = {};
  }

  const uidDirective = normalizeUidDirective(table.directives);
  if (uidDirective) {
    directives['@uid'] = uidDirective;
  }

  if (table.directives?.rls && !directives['@rls']) {
    directives['@rls'] = table.directives.rls;
  }

  if (table.directives?.tenant && !directives['@tenant']) {
    directives['@tenant'] = table.directives.tenant;
  }

  if (table.directives?.owner && !directives['@owner']) {
    directives['@owner'] = table.directives.owner;
  }

  return directives;
}

function normalizeUidDirective(directives) {
  const raw = directives?.['@uid'] ?? directives?.uid;
  if (!raw) return null;

  if (typeof raw === 'string') {
    return { value: raw, uid: raw };
  }

  const value = raw.value ?? raw.uid;
  if (typeof value === 'string' && value.length > 0) {
    return { ...raw, value, uid: raw.uid ?? value };
  }

  return null;
}

export function irToSchema(ir) {
  const tables = {};

  for (const t of ir.tables) {
    const fields = {};
    for (const f of t.fields) {
      fields[f.name] = new Field({
        name: f.name,
        type: f.type.base,
        nonNull: !f.nullable,
        list: f.type.isList,
        itemNonNull: f.type.isList && f.type.listItemNullable === false,
        directives: buildFieldDirectives(f, t)
      });
    }
    tables[t.name] = new Table({
      name: t.name,
      directives: buildTableDirectives(t),
      fields
    });
  }

  return new Schema(tables);
}
