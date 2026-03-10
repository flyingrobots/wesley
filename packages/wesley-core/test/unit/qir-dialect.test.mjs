import test from 'node:test';
import assert from 'node:assert/strict';

import { SqlDialect } from '../../src/domain/qir/dialects/SqlDialect.mjs';
import { PostgresDialect } from '../../src/domain/qir/dialects/PostgresDialect.mjs';

// ────────────────────────────────────────────────────────────────────────────
// SqlDialect (abstract) — every method must throw
// ────────────────────────────────────────────────────────────────────────────

test('SqlDialect: name getter throws', () => {
  const d = new SqlDialect();
  assert.throws(() => d.name, /must be implemented/);
});

test('SqlDialect: all rendering methods throw', () => {
  const d = new SqlDialect();
  const methods = [
    ['jsonBuildObject', [[]]],
    ['jsonAgg', ['expr', '']],
    ['arrayContains', ['a', 'b']],
    ['arrayIn', ['a', 'b']],
    ['ilike', ['a', 'b']],
    ['paramPlaceholder', [1]],
    ['quoteIdent', ['x']],
    ['identifierLimit', []],
    ['wrapToJsonb', ['q']],
    ['createView', ['v', 'SELECT 1']],
    ['createFunction', [{}]]
  ];
  for (const [method, args] of methods) {
    assert.throws(() => d[method](...args), /must be implemented/, `${method} should throw`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PostgresDialect — concrete rendering
// ────────────────────────────────────────────────────────────────────────────

test('PostgresDialect: name is "postgres"', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.name, 'postgres');
});

test('PostgresDialect: jsonBuildObject renders jsonb_build_object', () => {
  const pg = new PostgresDialect();
  const result = pg.jsonBuildObject([
    { key: 'id', valueSql: 't0."id"' },
    { key: 'name', valueSql: 't0."name"' }
  ]);
  assert.equal(result, "jsonb_build_object('id', t0.\"id\", 'name', t0.\"name\")");
});

test('PostgresDialect: jsonBuildObject escapes single quotes in keys', () => {
  const pg = new PostgresDialect();
  const result = pg.jsonBuildObject([
    { key: "it's", valueSql: 'val' }
  ]);
  assert.equal(result, "jsonb_build_object('it''s', val)");
});

test('PostgresDialect: jsonAgg renders COALESCE wrapper', () => {
  const pg = new PostgresDialect();
  assert.equal(
    pg.jsonAgg('expr', ''),
    "COALESCE(jsonb_agg(expr), '[]'::jsonb)"
  );
});

test('PostgresDialect: jsonAgg includes ORDER BY when provided', () => {
  const pg = new PostgresDialect();
  assert.equal(
    pg.jsonAgg('expr', 'ORDER BY t0."id" ASC'),
    "COALESCE(jsonb_agg(expr ORDER BY t0.\"id\" ASC), '[]'::jsonb)"
  );
});

test('PostgresDialect: arrayContains renders @>', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.arrayContains('"col"', '$1'), '"col" @> $1');
});

test('PostgresDialect: arrayIn renders = ANY()', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.arrayIn('"col"', '$1::text[]'), '"col" = ANY($1::text[])');
});

test('PostgresDialect: ilike renders ILIKE', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.ilike('"col"', '$1'), '"col" ILIKE $1');
});

test('PostgresDialect: paramPlaceholder renders $N', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.paramPlaceholder(1), '$1');
  assert.equal(pg.paramPlaceholder(42), '$42');
});

test('PostgresDialect: quoteIdent uses double quotes', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.quoteIdent('users'), '"users"');
  assert.equal(pg.quoteIdent('has"quote'), '"has""quote"');
});

test('PostgresDialect: identifierLimit returns 63', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.identifierLimit(), 63);
});

test('PostgresDialect: wrapToJsonb renders to_jsonb', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.wrapToJsonb('q'), 'to_jsonb("q".*)');
});

test('PostgresDialect: createView renders CREATE OR REPLACE VIEW', () => {
  const pg = new PostgresDialect();
  const result = pg.createView('"wes_ops"."op_all_users"', 'SELECT * FROM users');
  assert.equal(result, 'CREATE OR REPLACE VIEW "wes_ops"."op_all_users" AS\nSELECT * FROM users;');
});

test('PostgresDialect: createFunction renders full function DDL (invoker)', () => {
  const pg = new PostgresDialect();
  const result = pg.createFunction({
    qualifiedName: '"wes_ops"."op_by_id"',
    paramsSql: 'p_id text',
    bodySql: 'SELECT to_jsonb("q".*) FROM (SELECT 1) AS "q"',
    security: 'invoker',
    searchPathSql: ''
  });
  assert.ok(result.includes('CREATE OR REPLACE FUNCTION "wes_ops"."op_by_id"(p_id text)'));
  assert.ok(result.includes('RETURNS SETOF jsonb'));
  assert.ok(result.includes('LANGUAGE sql'));
  assert.ok(result.includes('STABLE'));
  assert.ok(result.includes('SECURITY INVOKER'));
  assert.ok(result.includes('AS $$'));
  assert.ok(result.includes('$$;'));
  assert.ok(!result.includes('SET search_path'));
});

test('PostgresDialect: createFunction renders definer + search_path', () => {
  const pg = new PostgresDialect();
  const result = pg.createFunction({
    qualifiedName: '"wes_ops"."op_admin"',
    paramsSql: '',
    bodySql: 'SELECT 1',
    security: 'definer',
    searchPathSql: '"wes_ops", "public"'
  });
  assert.ok(result.includes('SECURITY DEFINER'));
  assert.ok(result.includes('SET search_path = "wes_ops", "public"'));
});

test('PostgresDialect: jsonBuildObject with empty fields', () => {
  const pg = new PostgresDialect();
  assert.equal(pg.jsonBuildObject([]), 'jsonb_build_object()');
});

test('PostgresDialect: is an instanceof SqlDialect', () => {
  const pg = new PostgresDialect();
  assert.ok(pg instanceof SqlDialect);
});
