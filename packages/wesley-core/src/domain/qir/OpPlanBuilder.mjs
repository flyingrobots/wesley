/**
 * Minimal Operation → QIR Plan builder (MVP)
 * Input: a tiny JSON DSL describing a root table selection with basic filters
 * and ordering/limits. Example shape:
 * {
 *   name: "products_by_name",
 *   table: "product",
 *   columns: ["id","name","slug"],
 *   filters: [ { column: "name", op: "ilike", param: { name: "q", type: "text" } } ],
 *   orderBy: [ { column: "name", dir: "asc" } ],
 *   limit: 50,
 *   offset: 0
 * }
 */

import { QueryPlan, TableNode, Projection, ProjectionItem, ColumnRef, OrderBy, Predicate, ParamRef } from './Nodes.mjs';

export function buildPlanFromJson(op) {
  if (!op || !op.table) throw new Error('op.table is required');
  const alias = op.alias || 't0';
  const root = new TableNode(op.table, alias);

  const proj = new Projection();
  const cols = Array.isArray(op.columns) && op.columns.length ? op.columns : ['*'];
  if (cols.length === 1 && cols[0] === '*') {
    // Leave projection empty → SELECT *
  } else {
    for (const c of cols) {
      proj.add(new ProjectionItem(String(c), new ColumnRef(alias, String(c))));
    }
  }

  // WHERE predicate via a Filter relation wrapper
  const predicate = buildPredicate(alias, op.filters || []);
  const rootRel = predicate ? { kind: 'Filter', input: root, predicate } : root;

  // ORDER BY, LIMIT/OFFSET
  const order = [];
  for (const ob of op.orderBy || []) {
    order.push(new OrderBy(new ColumnRef(alias, String(ob.column)), ob.dir || 'asc', ob.nulls || null));
  }

  const plan = new QueryPlan(rootRel, proj, {
    orderBy: order,
    limit: op.limit != null ? Number(op.limit) : null,
    offset: op.offset != null ? Number(op.offset) : null,
  });
  return plan;
}

function buildPredicate(alias, filters) {
  if (!filters || filters.length === 0) return null;
  const parts = [];
  for (const f of filters) {
    const left = new ColumnRef(alias, String(f.column));
    const op = String(f.op || 'eq');
    if (op === 'isNull' || op === 'isNotNull') {
      parts.push(op === 'isNull' ? Predicate.isNull(left) : Predicate.isNotNull(left));
      continue;
    }
    const right = buildRightExpr(f.param, f.value, op);
    parts.push(Predicate.compare(left, op, right));
  }
  // AND all filters for MVP
  return parts.reduce((acc, cur) => acc ? Predicate.and(acc, cur) : cur, null);
}

function buildRightExpr(param, value, op) {
  if (param && param.name) {
    const p = new ParamRef(String(param.name));
    if (param.type) p.typeHint = String(param.type);
    // For IN, expect array type
    if (op === 'in' && p.typeHint && !p.typeHint.endsWith('[]')) p.typeHint = p.typeHint + '[]';
    return p;
  }
  // Fallback to literal value
  return { kind: 'Literal', value };
}

