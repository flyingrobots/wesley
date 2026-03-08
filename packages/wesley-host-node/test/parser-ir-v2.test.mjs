/**
 * Tests for the new Wesley IR shape (WesleyIR.schema.ts)
 *
 * These tests assert the promoted IR format:
 *  - tables[].fields (not columns)
 *  - field.type is { base, isList, listItemNullable? } (not a PG string)
 *  - field.directives is structured FieldDirectives (not generic object)
 *  - table.directives is structured TableDirectives (not generic object)
 *  - Top-level version, metadata, enums, scalars, relationships
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphQLAdapter } from '../src/adapters/GraphQLAdapter.mjs';

function parseSDL(sdl) {
  return new GraphQLAdapter().parseSDL(sdl);
}

// ---------- Top-level IR structure ----------

test('IR has version "1.0.0"', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  assert.equal(ir.version, '1.0.0');
});

test('IR has metadata with generatedAt timestamp', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  assert.ok(ir.metadata, 'metadata should exist');
  assert.ok(ir.metadata.generatedAt, 'generatedAt should exist');
  // Should be a valid ISO timestamp
  assert.ok(!Number.isNaN(Date.parse(ir.metadata.generatedAt)));
});

test('IR has relationships array', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  assert.ok(Array.isArray(ir.relationships));
});

test('IR has enums array (empty when none defined)', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  assert.ok(Array.isArray(ir.enums));
  assert.equal(ir.enums.length, 0);
});

test('IR has scalars array (empty when none defined)', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  assert.ok(Array.isArray(ir.scalars));
  assert.equal(ir.scalars.length, 0);
});

// ---------- Table structure ----------

test('table uses fields (not columns)', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  const table = ir.tables[0];
  assert.ok(Array.isArray(table.fields), 'table.fields should be an array');
  assert.equal(table.fields.length, 1);
});

test('table has structured TableDirectives', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  const table = ir.tables[0];
  assert.equal(table.directives.table, true);
});

test('table with @wes_rls has structured rls directive', () => {
  const ir = parseSDL(`
    type User @wes_table @wes_rls {
      id: ID! @wes_pk
    }
  `);
  const table = ir.tables[0];
  assert.ok(table.directives.rls, 'rls directive should exist');
  assert.equal(table.directives.rls.enable, true);
});

test('table with @wes_tenant has structured tenant directive', () => {
  const ir = parseSDL(`
    type User @wes_table @wes_tenant(by: "org_id") {
      id: ID! @wes_pk
      org_id: ID!
    }
  `);
  const table = ir.tables[0];
  assert.ok(table.directives.tenant, 'tenant directive should exist');
  assert.equal(table.directives.tenant.field, 'org_id');
});

test('table has indexes array', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      email: String! @wes_index
    }
  `);
  const table = ir.tables[0];
  assert.ok(Array.isArray(table.indexes));
  assert.equal(table.indexes.length, 1);
  assert.deepEqual(table.indexes[0].fields, ['email']);
});

test('table has constraints array', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  const table = ir.tables[0];
  assert.ok(Array.isArray(table.constraints));
});

// ---------- Field structure ----------

test('field.type is a structured FieldType object', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  const field = ir.tables[0].fields[0];
  assert.equal(typeof field.type, 'object');
  assert.equal(field.type.base, 'ID');
  assert.equal(field.type.isList, false);
});

test('field.type.base preserves GraphQL scalar names', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      name: String!
      age: Int
      score: Float
      active: Boolean!
      created: DateTime!
      born: Date
      alarm: Time
      meta: JSON
    }
  `);
  const fields = ir.tables[0].fields;
  const byName = Object.fromEntries(fields.map(f => [f.name, f]));

  assert.equal(byName.id.type.base, 'ID');
  assert.equal(byName.name.type.base, 'String');
  assert.equal(byName.age.type.base, 'Int');
  assert.equal(byName.score.type.base, 'Float');
  assert.equal(byName.active.type.base, 'Boolean');
  assert.equal(byName.created.type.base, 'DateTime');
  assert.equal(byName.born.type.base, 'Date');
  assert.equal(byName.alarm.type.base, 'Time');
  assert.equal(byName.meta.type.base, 'JSON');
});

test('field.type.isList is true for list types', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      tags: [String]
    }
  `);
  const tags = ir.tables[0].fields.find(f => f.name === 'tags');
  assert.equal(tags.type.isList, true);
  assert.equal(tags.type.base, 'String');
});

test('field.nullable reflects NonNull', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      email: String!
      bio: String
    }
  `);
  const fields = ir.tables[0].fields;
  const byName = Object.fromEntries(fields.map(f => [f.name, f]));
  assert.equal(byName.id.nullable, false);
  assert.equal(byName.email.nullable, false);
  assert.equal(byName.bio.nullable, true);
});

// ---------- Field directives ----------

test('field with @wes_pk has directives.pk === true', () => {
  const ir = parseSDL('type User @wes_table { id: ID! @wes_pk }');
  const field = ir.tables[0].fields[0];
  assert.equal(field.directives.pk, true);
});

test('field with @wes_unique has directives.unique === true', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      email: String! @wes_unique
    }
  `);
  const email = ir.tables[0].fields.find(f => f.name === 'email');
  assert.equal(email.directives.unique, true);
});

test('field with @wes_index has directives.index === true', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      email: String! @wes_index
    }
  `);
  const email = ir.tables[0].fields.find(f => f.name === 'email');
  assert.equal(email.directives.index, true);
});

test('field with @wes_default has structured directives.default', () => {
  const ir = parseSDL(`
    type User @wes_table {
      id: ID! @wes_pk
      status: String! @wes_default(value: "active")
    }
  `);
  const status = ir.tables[0].fields.find(f => f.name === 'status');
  assert.ok(status.directives.default, 'default directive should exist');
  assert.equal(status.directives.default.value, 'active');
});

test('field with @wes_fk has structured directives.fk', () => {
  const ir = parseSDL(`
    type Org @wes_table {
      id: ID! @wes_pk
    }
    type User @wes_table {
      id: ID! @wes_pk
      org_id: ID! @wes_fk(ref: "Org.id")
    }
  `);
  const orgId = ir.tables[1].fields.find(f => f.name === 'org_id');
  assert.ok(orgId.directives.fk, 'fk directive should exist');
  assert.equal(orgId.directives.fk.targetTable, 'Org');
  assert.equal(orgId.directives.fk.targetField, 'id');
});

// ---------- Relationships ----------

test('foreign keys produce top-level relationships', () => {
  const ir = parseSDL(`
    type Org @wes_table {
      id: ID! @wes_pk
    }
    type User @wes_table {
      id: ID! @wes_pk
      org_id: ID! @wes_fk(ref: "Org.id")
    }
  `);
  assert.ok(ir.relationships.length > 0, 'should have at least one relationship');
  const rel = ir.relationships[0];
  assert.equal(rel.from.table, 'User');
  assert.equal(rel.from.field, 'org_id');
  assert.equal(rel.to.table, 'Org');
  assert.equal(rel.to.field, 'id');
});

// ---------- No legacy shim properties ----------

test('table does NOT have legacy shim properties (columns, primaryKey, foreignKeys, tenantBy)', () => {
  const ir = parseSDL(`
    type Org @wes_table { id: ID! @wes_pk }
    type User @wes_table @wes_tenant(by: "org_id") {
      id: ID! @wes_pk
      org_id: ID! @wes_fk(ref: "Org.id")
    }
  `);
  const user = ir.tables.find(t => t.name === 'User');
  assert.equal(user.columns, undefined, 'table.columns shim should be removed');
  assert.equal(user.primaryKey, undefined, 'table.primaryKey shim should be removed');
  assert.equal(user.foreignKeys, undefined, 'table.foreignKeys shim should be removed');
  assert.equal(user.tenantBy, undefined, 'table.tenantBy shim should be removed');
});
