import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryPlan,
  TableNode,
  Projection,
  ProjectionItem,
  ColumnRef,
  OrderBy,
} from '../../src/domain/qir/Nodes.mjs';

import { emitView, emitFunction } from '../../src/domain/qir/emit.mjs';

test('emitFunction: generates deterministic function with params and jsonb rows', () => {
  const root = new TableNode('organization', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id')),
    new ProjectionItem('name', new ColumnRef('t0', 'name')),
  ]);
  // Filter with IN param
  const filter = {
    kind: 'Filter',
    alias: 'f0',
    input: root,
    predicate: { kind: 'Compare', op: 'in', left: new ColumnRef('t0', 'id'), right: { kind: 'ParamRef', name: 'ids', typeHint: 'text[]' } }
  };
  const plan = new QueryPlan(filter, proj, { orderBy: [ new OrderBy(new ColumnRef('t0','name'), 'asc') ] });

  const sql = emitFunction('Org List', plan);
  assert.ok(sql.startsWith('CREATE OR REPLACE FUNCTION wes_ops.op_org_list('));
  assert.ok(sql.includes('p_ids text[]'));
  assert.ok(sql.includes('RETURNS SETOF jsonb'));
  assert.ok(sql.includes('SELECT to_jsonb(q.*) FROM ('));
  assert.ok(sql.includes('FROM organization t0'));
  assert.ok(/ORDER BY\s+t0\.name\s+ASC?,?\s*,\s*t0\.id\s+ASC?/i.test(sql));
});

test('emitView: wraps lowered SQL in CREATE VIEW', () => {
  const root = new TableNode('organization', 't0');
  const proj = new Projection([
    new ProjectionItem('id', new ColumnRef('t0', 'id')),
    new ProjectionItem('name', new ColumnRef('t0', 'name')),
  ]);
  const plan = new QueryPlan(root, proj, { orderBy: [ new OrderBy(new ColumnRef('t0','name'), 'asc') ] });

  const sql = emitView('Org View!', plan);
  assert.ok(sql.startsWith('CREATE OR REPLACE VIEW wes_ops.op_org_view AS'));
  assert.ok(sql.includes('SELECT t0.id AS id, t0.name AS name'));
});

test('emitFunction: preserves jsonb_agg COALESCE inside wrapper', () => {
  const root = new TableNode('organization', 't0');
  const value = { kind: 'JsonBuildObject', fields: [ { key: 'id', value: new ColumnRef('t0','id') } ] };
  const proj = new Projection([ new ProjectionItem('items', { kind: 'JsonAgg', value }) ]);
  const plan = new QueryPlan(root, proj, {});
  const sql = emitFunction('agg', plan);
  assert.ok(sql.includes("COALESCE(jsonb_agg(jsonb_build_object('id', t0.id)), '[]'::jsonb)"));
});
