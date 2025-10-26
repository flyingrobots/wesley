/**
 * QIR → SQL Lowering (MVP)
 * Pure string renderer for SELECT-style queries from QIR Nodes.
 * - Handles Table/Subquery/Lateral/Join relations
 * - Supports WHERE, ORDER BY, LIMIT/OFFSET
 * - JSON helpers: jsonb_build_object, jsonb_agg with COALESCE([])
 * - Predicate mapping incl. NULL semantics and IN → = ANY($n::<arr>)
 *
 * This module intentionally avoids Node built-ins; consumers pass in
 * a QueryPlan shaped as defined in qir/Nodes.mjs. Parameter placeholders
 * use $1, $2… in deterministic order via collectParams().
 */

import { collectParams } from './ParamCollector.mjs';
import { renderIdent } from './identifiers.mjs';

// Lightweight helpers
const isObject = (v) => v && typeof v === 'object';
const escIdent = (s, opts) => renderIdent(s, opts);
const escString = (s) => String(s).replace(/'/g, "''");

export function lowerToSQL(plan, paramsEnv = null, opts = {}) {
  if (!plan || !plan.root) throw new Error('lowerToSQL: invalid plan');
  const identOpts = { policy: opts.identPolicy || 'minimal' };

  const params = paramsEnv && paramsEnv.ordered && paramsEnv.indexByName
    ? paramsEnv
    : collectParams(plan);

  // Build SELECT list
  const selectList = (plan.projection?.items || []).map(pi => `${renderExpr(pi.expr, params, identOpts)} AS ${escIdent(pi.alias, identOpts)}`).join(', ');
  const projectionSQL = selectList.length > 0 ? selectList : '*';

  // Render FROM and gather WHERE predicates from Filter nodes embedded in relation tree
  const whereParts = [];
  const fromSQL = renderRelation(plan.root, params, whereParts, identOpts);

  // WHERE
  const whereSQL = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';

  // ORDER BY with deterministic tie-breaker
  let orderSQL = '';
  const orderItems = [...(plan.orderBy || [])];
  if (orderItems.length > 0) {
    const rendered = orderItems.map(ob => renderOrderBy(ob, params, identOpts));
    // Append tie-breaker if primary key (id) not already present
    const pkRef = typeof opts.pkResolver === 'function' ? opts.pkResolver(plan) : guessPrimaryKeyRef(plan);
    if (pkRef && !orderMentionsExpr(orderItems, pkRef)) {
      rendered.push(`${renderExpr(pkRef, params, identOpts)} ASC`);
    }
    orderSQL = `\nORDER BY ${rendered.join(', ')}`;
  }

  // LIMIT/OFFSET
  const lim = plan.limit != null ? `\nLIMIT ${Number(plan.limit)}` : '';
  const off = plan.offset != null ? `\nOFFSET ${Number(plan.offset)}` : '';

  return `SELECT ${projectionSQL}\nFROM ${fromSQL}${whereSQL}${orderSQL}${lim}${off}`.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Relation rendering
function renderRelation(r, params, whereParts, identOpts) {
  if (!r) return '';
  switch (r.kind) {
    case 'Table':
      return `${escIdent(r.table, identOpts)} ${escIdent(r.alias, identOpts)}`;
    case 'Subquery': {
      const sql = lowerToSQL(r.plan, params, identOpts);
      return `(\n${sql}\n) ${escIdent(r.alias, identOpts)}`;
    }
    case 'Lateral': {
      const sql = lowerToSQL(r.plan, params, identOpts);
      return `LATERAL (\n${sql}\n) ${escIdent(r.alias, identOpts)}`;
    }
    case 'Join': {
      const left = renderRelation(r.left, params, whereParts, identOpts);
      const right = renderRelation(r.right, params, whereParts, identOpts);
      const jt = r.joinType && String(r.joinType).toUpperCase() === 'LEFT' ? 'LEFT JOIN' : 'JOIN';
      const on = r.on ? renderPredicate(r.on, params, identOpts) : 'TRUE';
      return `${left} ${jt} ${right} ON ${on}`;
    }
    case 'Filter': {
      // Non-canonical node used in tests; extract predicate into WHERE
      if (r.predicate) whereParts.push(renderPredicate(r.predicate, params, identOpts));
      return renderRelation(r.input, params, whereParts, identOpts);
    }
    default:
      // Fallback: assume table-like
      if (r.table && r.alias) return `${escIdent(r.table, identOpts)} ${escIdent(r.alias, identOpts)}`;
      throw new Error(`Unsupported relation kind: ${r.kind}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Predicates & expressions
function renderPredicate(p, params, identOpts) {
  if (!p) return 'TRUE';
  switch (p.kind) {
    case 'Exists':
      return `EXISTS (\n${lowerToSQL(p.subquery, params, identOpts)}\n)`;
    case 'Not':
      return `(NOT ${renderPredicate(p.left, params, identOpts)})`;
    case 'And':
      return `(${renderPredicate(p.left, params, identOpts)} AND ${renderPredicate(p.right, params, identOpts)})`;
    case 'Or':
      return `(${renderPredicate(p.left, params, identOpts)} OR ${renderPredicate(p.right, params, identOpts)})`;
    case 'Compare': {
      const { op } = p;
      // Null checks
      if (op === 'isNull')    return `${renderExpr(p.left, params, identOpts)} IS NULL`;
      if (op === 'isNotNull') return `${renderExpr(p.left, params, identOpts)} IS NOT NULL`;

      if (op === 'in') {
        const left = renderExpr(p.left, params, identOpts);
        const paramSql = renderParam(p.right, params, /*forceCast*/true);
        return `${left} = ANY(${paramSql})`;
      }

      const left = renderExpr(p.left, params, identOpts);
      const right = renderExpr(p.right, params, identOpts);
      switch (op) {
        case 'eq':  return `${left} = ${right}`;
        case 'ne':  return `${left} <> ${right}`;
        case 'lt':  return `${left} < ${right}`;
        case 'lte': return `${left} <= ${right}`;
        case 'gt':  return `${left} > ${right}`;
        case 'gte': return `${left} >= ${right}`;
        case 'like': return `${left} LIKE ${right}`;
        case 'ilike': return `${left} ILIKE ${right}`;
        case 'contains': return `${left} @> ${right}`;
        default:
          throw new Error(`Unsupported compare op '${op}'`);
      }
    }
    default:
      throw new Error(`Unsupported predicate kind '${p.kind}'`);
  }
}

function renderExpr(e, params, identOpts) {
  if (!e) return 'NULL';
  switch (e.kind) {
    case 'ColumnRef':
      return `${escIdent(e.table, identOpts)}.${escIdent(e.column, identOpts)}`;
    case 'ParamRef':
      return renderParam(e, params);
    case 'Literal':
      return renderLiteral(e.value, e.type);
    case 'FuncCall': {
      const fn = String(e.name); // keep unquoted for built-ins; validated upstream when needed
      const args = (e.args || []).map(a => renderExpr(a, params, identOpts)).join(', ');
      return `${fn}(${args})`;
    }
    case 'ScalarSubquery':
      return `(\n${lowerToSQL(e.plan, params, identOpts)}\n)`;
    case 'JsonBuildObject':
      return renderJsonBuildObject(e, params, identOpts);
    case 'JsonAgg':
      return renderJsonAgg(e, params, identOpts);
    default:
      // Allow plain objects shaped like ColumnRef/ParamRef/Literal
      if (isObject(e.left) && e.op) return renderPredicate(e, params, identOpts);
      if (e.table && e.column) return `${escIdent(e.table, identOpts)}.${escIdent(e.column, identOpts)}`;
      if (e.name && e.args) {
        const fn2 = String(e.name);
        return `${fn2}(${(e.args||[]).map(a => renderExpr(a, params, identOpts)).join(', ')})`;
      }
      throw new Error(`Unsupported expr kind '${e.kind}'`);
  }
}

function renderLiteral(v, type = null) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) || isObject(v)) {
    const json = JSON.stringify(v);
    return `'${escString(json)}'::${type || 'jsonb'}`;
  }
  return `'${escString(v)}'${type ? `::${type}` : ''}`;
}

function renderJsonBuildObject(e, params, identOpts) {
  // fields: [{ key, value }]
  const pairs = (e.fields || []).flatMap(({ key, value }) => [
    `'${escString(String(key))}'`,
    renderExpr(value, params, identOpts)
  ]);
  return `jsonb_build_object(${pairs.join(', ')})`;
}

function renderJsonAgg(e, params, identOpts) {
  const inner = renderExpr(e.value, params, identOpts);
  const order = (e.orderBy || []).length
    ? ' ORDER BY ' + e.orderBy.map(ob => renderOrderBy(ob, params, identOpts)).join(', ')
    : '';
  return `COALESCE(jsonb_agg(${inner}${order}), '[]'::jsonb)`;
}

function renderOrderBy(ob, params, identOpts) {
  const dir = ob.direction && String(ob.direction).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const nulls = ob.nulls ? ` NULLS ${String(ob.nulls).toUpperCase()}` : '';
  return `${renderExpr(ob.expr, params, identOpts)} ${dir}${nulls}`;
}

function renderParam(p, params, forceCast = false) {
  const name = p.name ?? p.param ?? 'p';
  const typeHint = p.typeHint || null;
  const special = p.special || '';
  const key = `${special}:${name}:${typeHint || ''}`;

  const idx = params.indexByName?.get ? params.indexByName.get(key) : null;
  // If not found, try by name only as a fallback (useful in tests)
  const discoveredIndex = idx || findIndexByNameOnly(params, name) || 0;
  if (!discoveredIndex) throw new Error(`Param not collected for '${name}'`);

  const cast = typeHint && (forceCast || !/::/.test(typeHint)) ? `::${typeHint}` : '';
  return `$${discoveredIndex}${cast}`;
}

function findIndexByNameOnly(params, name) {
  if (!params?.ordered) return 0;
  const i = params.ordered.findIndex(p => p.name === name);
  return i >= 0 ? i + 1 : 0;
}

function guessPrimaryKeyRef(plan) {
  // Heuristic: prefer alias.id of the leftmost base table
  let r = plan.root;
  while (r && r.kind === 'Filter') r = r.input;
  while (r && r.kind === 'Join') r = r.left; // leftmost
  if (r && r.alias) return { kind: 'ColumnRef', table: r.alias, column: 'id' };
  return null;
}

function orderMentionsExpr(orderByList, expr) {
  return (orderByList || []).some(ob => {
    const e = ob.expr || {};
    return e.kind === 'ColumnRef' && expr.kind === 'ColumnRef' && e.table === expr.table && e.column === expr.column;
  });
}
