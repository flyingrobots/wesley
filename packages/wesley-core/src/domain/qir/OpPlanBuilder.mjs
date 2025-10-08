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

import { QueryPlan, TableNode, JoinNode, LateralNode, Projection, ProjectionItem, ColumnRef, OrderBy, Predicate, ParamRef, JsonBuildObject, JsonAgg } from './Nodes.mjs';

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
  let rel = predicate ? { kind: 'Filter', input: root, predicate } : root;

  // Optional simple joins (INNER/LEFT) with on clause
  if (Array.isArray(op.joins)) {
    for (const j of op.joins) {
      const jAlias = j.alias || `j_${String(j.table).slice(0,1)}`;
      const right = new TableNode(String(j.table), jAlias);
      const joinType = (j.type || 'INNER').toUpperCase() === 'LEFT' ? 'LEFT' : 'INNER';
      const on = buildOnPredicate(j.on, alias, jAlias);
      rel = new JoinNode(rel, right, joinType, on);
    }
  }

  // Nested lists via LATERAL + jsonb_agg
  if (Array.isArray(op.lists)) {
    let lateralIdx = 0;
    for (const list of op.lists) {
      const lAlias = list.lateralAlias || `l${lateralIdx++}`;
      const jsonAlias = list.alias || 'items';
      const lt = String(list.table);
      const ltAlias = list.tableAlias || `${lAlias}_t`;

      // Build subplan: SELECT COALESCE(jsonb_agg(jsonb_build_object(...)), '[]'::jsonb) AS <jsonAlias>
      const subRoot = new TableNode(lt, ltAlias);
      const subProj = new Projection();
      const fields = [];
      const sels = Array.isArray(list.select) && list.select.length ? list.select : [];
      for (const s of sels) {
        const k = typeof s === 'string' ? s : (s.alias || s.column);
        const col = typeof s === 'string' ? s : s.column;
        fields.push({ key: k, value: new ColumnRef(ltAlias, String(col)) });
      }
      const orderBy = (list.orderBy || []).map(ob => new OrderBy(new ColumnRef(ltAlias, String(ob.column)), ob.dir || 'asc'));
      const jsonExpr = new JsonAgg(new JsonBuildObject(fields), orderBy);
      subProj.add(new ProjectionItem(jsonAlias, jsonExpr));

      // Subplan filters: either match.local/foreign or explicit filters
      let subPred = null;
      if (list.match && list.match.local && list.match.foreign) {
        // foreign refers to sub table column, local refers to outer (root) alias
        const left = new ColumnRef(ltAlias, String(list.match.foreign));
        const right = new ColumnRef(alias, String(list.match.local));
        subPred = Predicate.compare(left, 'eq', right);
      }
      if (Array.isArray(list.filters) && list.filters.length) {
        const extra = buildPredicate(ltAlias, list.filters);
        subPred = subPred ? Predicate.and(subPred, extra) : extra;
      }
      const subRel = subPred ? { kind: 'Filter', input: subRoot, predicate: subPred } : subRoot;
      const subPlan = new QueryPlan(subRel, subProj, {});

      // Attach as LEFT JOIN LATERAL subquery
      const lateral = new LateralNode(subPlan, lAlias);
      rel = new JoinNode(rel, lateral, 'LEFT', null);

      // Project the aggregated field from lateral
      proj.add(new ProjectionItem(jsonAlias, new ColumnRef(lAlias, jsonAlias)));
    }
  }

  // ORDER BY, LIMIT/OFFSET
  const order = [];
  for (const ob of op.orderBy || []) {
    order.push(new OrderBy(new ColumnRef(alias, String(ob.column)), ob.dir || 'asc', ob.nulls || null));
  }

  const plan = new QueryPlan(rel, proj, {
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

function buildOnPredicate(on, leftDefault, rightAlias) {
  if (!on) return { kind: 'Compare', left: { kind: 'Literal', value: true }, op: 'eq', right: { kind: 'Literal', value: true } }; // ON TRUE
  const parseRef = (r) => {
    if (Array.isArray(r)) return new ColumnRef(String(r[0] || leftDefault), String(r[1]));
    if (typeof r === 'string') {
      const m = r.split('.');
      if (m.length === 2) return new ColumnRef(m[0], m[1]);
      return new ColumnRef(leftDefault, r);
    }
    // structured { table, column }
    return new ColumnRef(String(r.table || leftDefault), String(r.column));
  };
  const op = String(on.op || 'eq');
  const left = parseRef(on.left);
  const right = parseRef(on.right || [rightAlias, on.rightColumn || 'id']);
  return Predicate.compare(left, op, right);
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
