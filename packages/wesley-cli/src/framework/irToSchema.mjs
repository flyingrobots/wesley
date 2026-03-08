/**
 * Convert Wesley IR (from parsers.graphql.parse) to core domain Schema
 *
 * TypeScriptGenerator and ZodGenerator expect a Schema with getTables(),
 * where each table has getFields() returning Field instances. The parser
 * returns IR with .tables[].columns[] in PostgreSQL types. This adapter
 * bridges the two representations.
 */

import { Schema, Table, Field } from '@wesley/core';

const PG_TO_GQL = {
  'uuid': 'ID',
  'text': 'String',
  'integer': 'Int',
  'double precision': 'Float',
  'boolean': 'Boolean',
  'timestamptz': 'DateTime',
  'date': 'Date',
  'time with time zone': 'Time',
  'jsonb': 'JSON'
};

function pgTypeToGraphQL(pgType) {
  const base = pgType.replace('[]', '');
  const mapped = PG_TO_GQL[base];
  if (!mapped) {
    throw new Error(`irToSchema: unmapped PostgreSQL type "${pgType}" — add it to PG_TO_GQL`);
  }
  return mapped;
}

function buildFieldDirectives(column, table) {
  const directives = { ...(column.directives || {}) };

  if (table.primaryKey === column.name) {
    directives['@primaryKey'] = {};
  }

  const fk = table.foreignKeys?.find(f => f.column === column.name);
  if (fk) {
    directives['@foreignKey'] = { ref: `${fk.refTable}.${fk.refColumn}` };
  }

  if (column.unique) {
    directives['@unique'] = {};
  }

  if (column.default) {
    directives['@default'] = { expr: column.default };
  }

  const indexes = table.indexes?.filter(i => i.columns?.includes(column.name));
  if (indexes?.length === 1) {
    directives['@index'] = { name: indexes[0].name, using: indexes[0].using };
  } else if (indexes?.length > 1) {
    directives['@index'] = indexes.map(i => ({ name: i.name, using: i.using }));
  }

  return directives;
}

export function irToSchema(ir) {
  const tables = {};

  for (const t of ir.tables) {
    const fields = {};
    for (const c of t.columns) {
      fields[c.name] = new Field({
        name: c.name,
        type: pgTypeToGraphQL(c.type),
        nonNull: !c.nullable,
        list: c.type?.includes('[]') || false,
        directives: buildFieldDirectives(c, t)
      });
    }
    tables[t.name] = new Table({
      name: t.name,
      directives: t.directives || {},
      fields
    });
  }

  return new Schema(tables);
}
