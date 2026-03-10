import test from 'node:test';
import assert from 'node:assert/strict';

import { QirPlugin } from '../../src/domain/qir/QirPlugin.mjs';
import { validatePlugin, validatePlan, validateGenerateResult } from '../../src/ports/GeneratorPlugin.mjs';
import {
  QueryPlan,
  TableNode,
  Projection,
  ProjectionItem,
  ColumnRef,
  AliasAllocator,
  OrderBy,
  ParamRef
} from '../../src/domain/qir/Nodes.mjs';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeContext() {
  return Object.freeze({
    logger: { info() {}, warn() {}, error() {}, child() { return this; } },
    clock: { now() { return '2026-01-01T00:00:00Z'; } },
    config: Object.freeze({}),
    runId: 'test-run-001'
  });
}

function makeParamlessPlan() {
  const aa = new AliasAllocator('t');
  const root = new TableNode('users', aa.next());
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef(root.alias, 'id')),
    new ProjectionItem('name', new ColumnRef(root.alias, 'name'))
  ]);
  return new QueryPlan(root, proj, {
    orderBy: [new OrderBy(new ColumnRef(root.alias, 'name'), 'asc')]
  });
}

function makeParameterizedPlan() {
  const aa = new AliasAllocator('t');
  const root = new TableNode('orders', aa.next());
  const paramRef = new ParamRef('user_id');
  paramRef.typeHint = 'uuid';

  const filterNode = {
    kind: 'Filter',
    input: root,
    predicate: {
      kind: 'Compare',
      left: new ColumnRef(root.alias, 'user_id'),
      op: 'eq',
      right: paramRef
    }
  };

  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef(root.alias, 'id')),
    new ProjectionItem('total', new ColumnRef(root.alias, 'total'))
  ]);

  return new QueryPlan(filterNode, proj, {
    orderBy: [new OrderBy(new ColumnRef(root.alias, 'id'), 'asc')]
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Contract compliance
// ────────────────────────────────────────────────────────────────────────────

test('QirPlugin: passes validatePlugin', () => {
  const plugin = new QirPlugin();
  assert.doesNotThrow(() => validatePlugin(plugin));
});

test('QirPlugin: name is "qir"', () => {
  const plugin = new QirPlugin();
  assert.equal(plugin.name, 'qir');
});

test('QirPlugin: apiVersion is "1"', () => {
  const plugin = new QirPlugin();
  assert.equal(plugin.apiVersion, '1');
});

// ────────────────────────────────────────────────────────────────────────────
// plan() phase
// ────────────────────────────────────────────────────────────────────────────

test('QirPlugin.plan: empty ops returns empty artifacts', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const result = await plugin.plan({ ops: [] }, ctx);
  validatePlan(result, 'qir');
  assert.equal(result.artifacts.length, 0);
});

test('QirPlugin.plan: null ops returns empty artifacts', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const result = await plugin.plan({}, ctx);
  validatePlan(result, 'qir');
  assert.equal(result.artifacts.length, 0);
});

test('QirPlugin.plan: parameterless op declares both fn and view', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const plan = makeParamlessPlan();
  const result = await plugin.plan({ ops: [{ name: 'all_users', plan }] }, ctx);
  validatePlan(result, 'qir');
  assert.equal(result.artifacts.length, 2);
  assert.ok(result.artifacts.some(a => a.path === 'ops/all_users.fn.sql'));
  assert.ok(result.artifacts.some(a => a.path === 'ops/all_users.view.sql'));
});

test('QirPlugin.plan: parameterized op declares only fn', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const plan = makeParameterizedPlan();
  const result = await plugin.plan({ ops: [{ name: 'orders_by_user', plan }] }, ctx);
  validatePlan(result, 'qir');
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0].path, 'ops/orders_by_user.fn.sql');
});

test('QirPlugin.plan: multiple ops produce correct artifact count', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const result = await plugin.plan({
    ops: [
      { name: 'all_users', plan: makeParamlessPlan() },
      { name: 'orders_by_user', plan: makeParameterizedPlan() }
    ]
  }, ctx);
  validatePlan(result, 'qir');
  // 2 (fn+view) + 1 (fn only) = 3
  assert.equal(result.artifacts.length, 3);
});

// ────────────────────────────────────────────────────────────────────────────
// generate() phase
// ────────────────────────────────────────────────────────────────────────────

test('QirPlugin.generate: parameterless op produces fn + view files', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const qirPlan = makeParamlessPlan();
  const genPlan = await plugin.plan({ ops: [{ name: 'all_users', plan: qirPlan }] }, ctx);
  const result = await plugin.generate(genPlan, ctx);

  const normalized = validateGenerateResult(result, 'qir');
  assert.ok('ops/all_users.fn.sql' in normalized.artifacts);
  assert.ok('ops/all_users.view.sql' in normalized.artifacts);

  const fnSql = normalized.artifacts['ops/all_users.fn.sql'];
  assert.ok(fnSql.includes('CREATE OR REPLACE FUNCTION'));
  assert.ok(fnSql.includes('RETURNS SETOF jsonb'));

  const viewSql = normalized.artifacts['ops/all_users.view.sql'];
  assert.ok(viewSql.includes('CREATE OR REPLACE VIEW'));
});

test('QirPlugin.generate: parameterized op produces fn only', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const qirPlan = makeParameterizedPlan();
  const genPlan = await plugin.plan({ ops: [{ name: 'orders_by_user', plan: qirPlan }] }, ctx);
  const result = await plugin.generate(genPlan, ctx);

  const normalized = validateGenerateResult(result, 'qir');
  assert.ok('ops/orders_by_user.fn.sql' in normalized.artifacts);
  assert.ok(!('ops/orders_by_user.view.sql' in normalized.artifacts));

  const fnSql = normalized.artifacts['ops/orders_by_user.fn.sql'];
  assert.ok(fnSql.includes('p_user_id uuid'));
});

test('QirPlugin.generate: produces evidence per op', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const qirPlan = makeParamlessPlan();
  const genPlan = await plugin.plan({ ops: [{ name: 'all_users', plan: qirPlan }] }, ctx);
  const result = await plugin.generate(genPlan, ctx);

  const normalized = validateGenerateResult(result, 'qir');
  assert.ok(normalized.evidence !== null);
  assert.ok('op:all_users' in normalized.evidence);
  assert.ok(normalized.evidence['op:all_users'].artifacts.sql);
});

test('QirPlugin.generate: empty plan produces empty files', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const genPlan = await plugin.plan({ ops: [] }, ctx);
  const result = await plugin.generate(genPlan, ctx);

  const normalized = validateGenerateResult(result, 'qir');
  assert.equal(Object.keys(normalized.artifacts).length, 0);
});

test('QirPlugin: respects custom schema option', async () => {
  const plugin = new QirPlugin({ schema: 'custom_schema' });
  const ctx = makeContext();
  const qirPlan = makeParamlessPlan();
  const genPlan = await plugin.plan({ ops: [{ name: 'all_users', plan: qirPlan }] }, ctx);
  const result = await plugin.generate(genPlan, ctx);

  const normalized = validateGenerateResult(result, 'qir');
  const fnSql = normalized.artifacts['ops/all_users.fn.sql'];
  assert.ok(fnSql.includes('"custom_schema"'));
});

test('QirPlugin.plan: rejects duplicate op names', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const plan = makeParamlessPlan();
  await assert.rejects(
    () => plugin.plan({ ops: [{ name: 'dup', plan }, { name: 'dup', plan }] }, ctx),
    /duplicate op name "dup"/
  );
});

test('QirPlugin.plan: rejects path-traversal op names', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const plan = makeParamlessPlan();
  await assert.rejects(
    () => plugin.plan({ ops: [{ name: '../escape', plan }] }, ctx),
    /path-traversal/
  );
  await assert.rejects(
    () => plugin.plan({ ops: [{ name: 'foo/bar', plan }] }, ctx),
    /path-traversal/
  );
});

test('QirPlugin.plan: rejects empty op name', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const plan = makeParamlessPlan();
  await assert.rejects(
    () => plugin.plan({ ops: [{ name: '', plan }] }, ctx),
    /non-empty string/
  );
});

test('QirPlugin: respects security=definer option', async () => {
  const plugin = new QirPlugin({ security: 'definer', setSearchPath: ['wes_ops', 'pg_catalog'] });
  const ctx = makeContext();
  const qirPlan = makeParamlessPlan();
  const genPlan = await plugin.plan({ ops: [{ name: 'all_users', plan: qirPlan }] }, ctx);
  const result = await plugin.generate(genPlan, ctx);

  const normalized = validateGenerateResult(result, 'qir');
  const fnSql = normalized.artifacts['ops/all_users.fn.sql'];
  assert.ok(fnSql.includes('SECURITY DEFINER'));
  assert.ok(fnSql.includes('SET search_path'));
});

test('QirPlugin: rejects definer without setSearchPath', () => {
  assert.throws(
    () => new QirPlugin({ security: 'definer' }),
    /requires a non-empty setSearchPath/
  );
  assert.throws(
    () => new QirPlugin({ security: 'definer', setSearchPath: [] }),
    /requires a non-empty setSearchPath/
  );
});

test('QirPlugin: rejects op names exceeding identifier limit', async () => {
  const plugin = new QirPlugin();
  const ctx = makeContext();
  const qirPlan = makeParamlessPlan();
  // 64 chars exceeds PostgreSQL's 63-byte limit
  const longName = 'a'.repeat(64);
  await assert.rejects(
    () => plugin.plan({ ops: [{ name: longName, plan: qirPlan }] }, ctx),
    /exceeds identifier limit/
  );
});
