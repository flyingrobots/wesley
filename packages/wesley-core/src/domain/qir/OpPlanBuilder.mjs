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

// Allowed sets (module-level singletons)
const ALLOWED_FILTER_OPS = new Set(['eq','ne','lt','lte','gt','gte','like','ilike','contains','in','isNull','isNotNull']);
const ALLOWED_PARAM_TYPES = new Set(['text','uuid','int','bigint','numeric','jsonb','bool','date','timestamp']);

export function buildPlanFromJson(op) {
  const tableName = (typeof op?.table === 'string' && op.table.trim()) ? op.table.trim() : '';
  if (!tableName) throw new Error('op.table is required');
  const alias = (typeof op?.alias === 'string' && op.alias.trim()) ? op.alias.trim() : 't0';
  const root = new TableNode(tableName, alias);

  const proj = new Projection();
  const cols = op.columns ?? ['*'];
  if (!Array.isArray(cols)) throw new Error('op.columns must be an array when provided');
  if (cols.length === 0 || (cols.length === 1 && cols[0] === '*')) {
    // Leave projection empty → SELECT *
  } else {
    for (const c of cols) {
      if (typeof c !== 'string' || c.trim().length === 0) {
        throw new Error(`Invalid column name in columns[]: ${JSON.stringify(c)}`);
      }
      const name = c.trim();
      proj.add(new ProjectionItem(name, new ColumnRef(alias, name)));
    }
  }

  // WHERE predicate via a Filter relation wrapper
  const predicate = buildPredicate(alias, op.filters || []);
  let rel = predicate ? { kind: 'Filter', input: root, predicate } : root;

  // Optional simple joins (INNER/LEFT) with on clause
  if (Array.isArray(op.joins)) {
    for (const j of op.joins) {
      const table = (typeof j.table === 'string' && j.table.trim()) || null;
      if (!table) throw new Error(`join.table must be a non-empty string: ${JSON.stringify(j)}`);
      if (!j.on) throw new Error('join.on is required for joins');
      const jAlias = j.alias || `j_${table.slice(0,1)}`;
      const right = new TableNode(table, jAlias);
      const jt = String(j.type || 'INNER').toUpperCase();
      const joinType = jt === 'LEFT' ? 'LEFT' : 'INNER';
      const on = buildOnPredicate(j.on, alias, jAlias);
      rel = new JoinNode(rel, right, joinType, on);
    }
  }

  // Nested lists via LATERAL + jsonb_agg
  if (Array.isArray(op.lists)) {
    let lateralIdx = 0;
    for (const list of op.lists) {
      const hasAlias = typeof list.lateralAlias === 'string' && list.lateralAlias.trim().length > 0;
      const lAlias = hasAlias ? list.lateralAlias.trim() : `l${lateralIdx++}`;
      const jsonAlias = (typeof list.alias === 'string' && list.alias.trim()) ? list.alias.trim() : 'items';
      const tableName = (typeof list.table === 'string' && list.table.trim()) ? list.table.trim() : '';
      if (!tableName) throw new Error(`lists[].table must be a non-empty string: ${JSON.stringify(list)}`);
      const lt = tableName;
      const ltAlias = (typeof list.tableAlias === 'string' && list.tableAlias.trim()) ? list.tableAlias.trim() : `${lAlias}_t`;

      // Build subplan: SELECT COALESCE(jsonb_agg(jsonb_build_object(...)), '[]'::jsonb) AS <jsonAlias>
      const subRoot = new TableNode(lt, ltAlias);
      const subProj = new Projection();
      const fields = [];
      const sels = Array.isArray(list.select) ? list.select : [];
      for (const s of sels) {
        if (typeof s === 'string') {
          const col = s.trim();
          if (!col) throw new Error(`lists[].select column must be a non-empty string: ${JSON.stringify(s)}`);
          fields.push({ key: col, value: new ColumnRef(ltAlias, col) });
          continue;
        }
        if (!s || typeof s !== 'object') {
          throw new Error(`lists[].select entries must be strings or objects with column/alias: ${JSON.stringify(s)}`);
        }
        const column = (typeof s.column === 'string' && s.column.trim()) ? s.column.trim() : '';
        if (!column) throw new Error(`lists[].select column must be a non-empty string: ${JSON.stringify(s)}`);
        const key = (typeof s.alias === 'string' && s.alias.trim()) ? s.alias.trim() : column;
        fields.push({ key, value: new ColumnRef(ltAlias, column) });
      }
      const orderDefs = Array.isArray(list.orderBy) ? list.orderBy : [];
      const orderBy = [];
      for (const ob of orderDefs) {
        const col = (typeof ob.column === 'string' && ob.column.trim()) ? ob.column.trim() : '';
        if (!col) throw new Error(`lists[].orderBy entry missing valid column: ${JSON.stringify(ob)}`);
        let dir = ob.dir ? String(ob.dir).toLowerCase() : 'asc';
        if (dir !== 'asc' && dir !== 'desc') {
          throw new Error(`lists[].orderBy.dir must be "asc" or "desc". Received: ${JSON.stringify(ob.dir)}`);
        }
        orderBy.push(new OrderBy(new ColumnRef(ltAlias, col), dir));
      }
      const jsonExpr = new JsonAgg(new JsonBuildObject(fields), orderBy);
      subProj.add(new ProjectionItem(jsonAlias, jsonExpr));

      // Subplan filters: either match.local/foreign or explicit filters
      let subPred = null;
      if (list.match != null) {
        const foreign = (typeof list.match.foreign === 'string' && list.match.foreign.trim()) ? list.match.foreign.trim() : '';
        const local = (typeof list.match.local === 'string' && list.match.local.trim()) ? list.match.local.trim() : '';
        if (!foreign || !local) {
          throw new Error(`lists[].match requires non-empty local/foreign strings: ${JSON.stringify(list.match)}`);
        }
        const left = new ColumnRef(ltAlias, foreign);
        const right = new ColumnRef(alias, local);
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
    const col = (typeof ob.column === 'string' && ob.column.trim()) || null;
    if (!col) throw new Error(`orderBy entry missing valid column: ${JSON.stringify(ob)}`);
    let dir = String(ob.dir || 'asc').toLowerCase();
    if (dir !== 'asc' && dir !== 'desc') {
      throw new Error(`orderBy.dir must be "asc" or "desc". Received: ${JSON.stringify(ob.dir)}`);
    }
    let nulls = null;
    if (ob.nulls != null) {
      nulls = String(ob.nulls).toLowerCase();
      if (nulls !== 'first' && nulls !== 'last') {
        throw new Error(`orderBy.nulls must be "first" or "last". Received: ${JSON.stringify(ob.nulls)}`);
      }
    }
    order.push(new OrderBy(new ColumnRef(alias, col), dir, nulls));
  }

  const toPosInt = (v, name, allowZero) => {
    if (v == null) return null;
    if (typeof v === 'string' && v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || (!allowZero ? n <= 0 : n < 0)) {
      throw new Error(`${name} must be ${allowZero ? 'a non-negative' : 'a positive'} integer. Received: ${JSON.stringify(v)}`);
    }
    return n;
  };

  const plan = new QueryPlan(rel, proj, {
    orderBy: order,
    limit: toPosInt(op.limit, 'limit', false),
    offset: toPosInt(op.offset, 'offset', true),
  });
  return plan;
}

function buildPredicate(alias, filters) {
  if (!filters || filters.length === 0) return null;
  const parts = [];
  for (const f of filters) {
    const col = (typeof f.column === 'string' && f.column.trim()) || null;
    if (!col) throw new Error(`Filter missing valid column: ${JSON.stringify(f)}`);
    const left = new ColumnRef(alias, col);
    const op = String(f.op || 'eq');
    if (!ALLOWED_FILTER_OPS.has(op)) throw new Error(`Unsupported filter op: ${op}`);
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
  if (!on) throw new Error('Join requires an "on" condition. Provide { left, right, op }');
  const parseRef = (r) => {
    let table, column;
    if (Array.isArray(r)) { table = r[0] || leftDefault; column = r[1]; }
    else if (typeof r === 'string') { const m = r.split('.'); if (m.length === 2) { table = m[0]; column = m[1]; } else { table = leftDefault; column = r; } }
    else { table = r?.table || leftDefault; column = r?.column; }
    if (!table || typeof table !== 'string' || !column || typeof column !== 'string') {
      throw new Error(`Invalid column reference in join.on: ${JSON.stringify(r)}`);
    }
    return new ColumnRef(table, column);
  };
  const op = String(on.op || 'eq');
  const left = parseRef(on.left);
  const right = parseRef(on.right || [rightAlias, on.rightColumn || 'id']);
  return Predicate.compare(left, op, right);
}

function buildRightExpr(param, value, op) {
  if (param && param.name) {
    const name = String(param.name);
    let typeHint = param.type ? String(param.type) : undefined;
    if (typeHint && !ALLOWED_PARAM_TYPES.has(typeHint.replace(/\[\]$/, ''))) {
      throw new Error(`Unsupported param type: ${typeHint} for ${name}`);
    }
    if (op === 'in' && typeHint && !typeHint.endsWith('[]')) typeHint = typeHint + '[]';
    const p = new ParamRef(name);
    if (typeHint) p.typeHint = typeHint;
    return p;
  }
  // Fallback to literal value
  return { kind: 'Literal', value };
}
