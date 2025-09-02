/**
 * GraphQL Schema Parser - Node.js implementation
 * Implements SchemaParser port from wesley-core
 */

import { parse, visit, Kind } from 'graphql';
import { Schema, Table, Field } from '@wesley/core';

export class GraphQLSchemaParser {
  async parse(sdl) {
    const doc = parse(sdl);
    const tables = {};

    visit(doc, {
      ObjectTypeDefinition(node) {
        const isTable = !!getDirective(node, 'table');
        if (!isTable) return;

        const fields = {};
        for (const f of node.fields || []) {
          const t = unwrapType(f.type);
          fields[f.name.value] = new Field({
            name: f.name.value,
            type: t.base,
            nonNull: t.nonNull,
            list: t.list,
            directives: allDirectives(f)
          });
        }

        tables[node.name.value] = new Table({
          name: node.name.value,
          directives: allDirectives(node),
          fields
        });
      }
    });

    return new Schema(tables);
  }
}

function getDirective(node, name) {
  const d = node.directives?.find((d) => d.name.value === name);
  if (!d) return null;
  const args = {};
  for (const a of d.arguments || []) {
    args[a.name.value] = a.value.kind === Kind.STRING ? a.value.value : String(a.value.value ?? '');
  }
  return args;
}

function allDirectives(node) {
  const out = {};
  for (const d of node.directives || []) {
    const args = {};
    for (const a of d.arguments || []) {
      args[a.name.value] =
        a.value.kind === Kind.STRING
          ? a.value.value
          : a.value.kind === Kind.ENUM
          ? a.value.value
          : a.value.kind === Kind.INT
          ? Number(a.value.value)
          : String(a.value.value ?? '');
    }
    out[`@${d.name.value}`] = args;
  }
  return out;
}

function unwrapType(t) {
  let base = '';
  let nonNull = false;
  let list = false;
  let cur = t;
  if (cur.kind === Kind.NON_NULL_TYPE) {
    nonNull = true;
    cur = cur.type;
  }
  if (cur.kind === Kind.LIST_TYPE) {
    list = true;
    cur = cur.type;
  }
  if (cur.kind === Kind.NON_NULL_TYPE) {
    nonNull = true;
    cur = cur.type;
  }
  base = cur.name?.value || 'String';
  return { base, nonNull, list };
}