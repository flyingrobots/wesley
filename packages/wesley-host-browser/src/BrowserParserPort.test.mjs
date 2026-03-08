/**
 * Tests for BrowserParserPort — asserts the canonical WesleyIR shape.
 */
import { describe, it, expect } from 'vitest';
import { BrowserParserPort } from './BrowserParserPort.mjs';

async function parse(sdl) {
  return new BrowserParserPort().parse(sdl);
}

// ---------- Top-level IR structure ----------

describe('top-level IR', () => {
  it('has version "1.0.0"', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.version).toBe('1.0.0');
  });

  it('has metadata with generatedAt timestamp', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.metadata).toBeDefined();
    expect(ir.metadata.generatedAt).toBeDefined();
    expect(Number.isNaN(Date.parse(ir.metadata.generatedAt))).toBe(false);
  });

  it('has tables array', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.tables).toBeInstanceOf(Array);
    expect(ir.tables).toHaveLength(1);
  });

  it('has enums array', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.enums).toEqual([]);
  });

  it('has scalars array', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.scalars).toEqual([]);
  });

  it('has relationships array', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.relationships).toEqual([]);
  });
});

// ---------- Table structure ----------

describe('table structure', () => {
  it('uses fields (not columns)', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    const table = ir.tables[0];
    expect(table.fields).toBeInstanceOf(Array);
    expect(table.fields).toHaveLength(1);
    expect(table.columns).toBeUndefined();
  });

  it('has structured TableDirectives with table: true', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.tables[0].directives.table).toBe(true);
  });

  it('has @wes_rls directive', async () => {
    const ir = await parse(`
      type User @wes_table @wes_rls { id: ID! @wes_pk }
    `);
    expect(ir.tables[0].directives.rls).toEqual({ enable: true });
  });

  it('has @wes_tenant directive', async () => {
    const ir = await parse(`
      type User @wes_table @wes_tenant(by: "org_id") {
        id: ID! @wes_pk
        org_id: ID!
      }
    `);
    expect(ir.tables[0].directives.tenant).toEqual({ field: 'org_id' });
  });

  it('has indexes array', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        email: String! @wes_index
      }
    `);
    const table = ir.tables[0];
    expect(table.indexes).toBeInstanceOf(Array);
    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0].fields).toEqual(['email']);
  });

  it('has constraints array', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.tables[0].constraints).toEqual([]);
  });

  it('does NOT have legacy shim properties', async () => {
    const ir = await parse(`
      type User @wes_table @wes_tenant(by: "org_id") {
        id: ID! @wes_pk
        org_id: ID!
      }
    `);
    const table = ir.tables[0];
    expect(table.columns).toBeUndefined();
    expect(table.primaryKey).toBeUndefined();
    expect(table.foreignKeys).toBeUndefined();
    expect(table.tenantBy).toBeUndefined();
  });
});

// ---------- Field structure ----------

describe('field structure', () => {
  it('field.type is a structured FieldType object', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    const field = ir.tables[0].fields[0];
    expect(field.type).toEqual({ base: 'ID', isList: false });
  });

  it('field.type.base preserves GraphQL scalar names', async () => {
    const ir = await parse(`
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
    const byName = Object.fromEntries(ir.tables[0].fields.map(f => [f.name, f]));
    expect(byName.id.type.base).toBe('ID');
    expect(byName.name.type.base).toBe('String');
    expect(byName.age.type.base).toBe('Int');
    expect(byName.score.type.base).toBe('Float');
    expect(byName.active.type.base).toBe('Boolean');
    expect(byName.created.type.base).toBe('DateTime');
    expect(byName.born.type.base).toBe('Date');
    expect(byName.alarm.type.base).toBe('Time');
    expect(byName.meta.type.base).toBe('JSON');
  });

  it('field.type.isList is true for list types', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        tags: [String]
      }
    `);
    const tags = ir.tables[0].fields.find(f => f.name === 'tags');
    expect(tags.type.isList).toBe(true);
    expect(tags.type.base).toBe('String');
  });

  it('field.nullable reflects NonNull', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        email: String!
        bio: String
      }
    `);
    const byName = Object.fromEntries(ir.tables[0].fields.map(f => [f.name, f]));
    expect(byName.id.nullable).toBe(false);
    expect(byName.email.nullable).toBe(false);
    expect(byName.bio.nullable).toBe(true);
  });
});

// ---------- Field directives ----------

describe('field directives', () => {
  it('@wes_pk sets directives.pk', async () => {
    const ir = await parse('type User @wes_table { id: ID! @wes_pk }');
    expect(ir.tables[0].fields[0].directives.pk).toBe(true);
  });

  it('@wes_unique sets directives.unique', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        email: String! @wes_unique
      }
    `);
    const email = ir.tables[0].fields.find(f => f.name === 'email');
    expect(email.directives.unique).toBe(true);
  });

  it('@wes_index sets directives.index', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        email: String! @wes_index
      }
    `);
    const email = ir.tables[0].fields.find(f => f.name === 'email');
    expect(email.directives.index).toBe(true);
  });

  it('@wes_default sets structured directives.default', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        status: String! @wes_default(value: "active")
      }
    `);
    const status = ir.tables[0].fields.find(f => f.name === 'status');
    expect(status.directives.default).toEqual({ value: 'active' });
  });

  it('@wes_fk sets structured directives.fk', async () => {
    const ir = await parse(`
      type User @wes_table {
        id: ID! @wes_pk
        org_id: ID! @wes_fk(ref: "Org.id")
      }
    `);
    const orgId = ir.tables[0].fields.find(f => f.name === 'org_id');
    expect(orgId.directives.fk).toEqual({ targetTable: 'Org', targetField: 'id' });
  });
});
