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

const SAFE_FUNC_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
const SAFE_TYPE_RE = /^[a-zA-Z_][a-zA-Z0-9_ [\]]*$/;

// Lightweight helpers
const isObject = (v) => v && typeof v === 'object';
const escString = (s) => String(s).replace(/'/g, "''");

export function lowerToSQL(plan, paramsEnv = null, opts = {}) {
  if (!plan || !plan.root) throw new Error('lowerToSQL: invalid plan');
  const identOpts = { policy: opts.identPolicy || 'minimal' };

  const params = paramsEnv && paramsEnv.ordered && paramsEnv.indexByName
    ? paramsEnv
    : collectParams(plan);

  // Build DISTINCT ON (optional) and SELECT list
  const selectList = (plan.projection?.items || []).map(pi => `${renderExpr(pi.expr, params, identOpts)} AS ${renderIdent(pi.alias, identOpts)}`).join(', ');
  const projectionSQL = selectList.length > 0 ? selectList : '*';
  const distinctExprs = Array.isArray(plan.distinctOn) ? plan.distinctOn : [];
  const distinctSQL = distinctExprs.length ? `DISTINCT ON (${distinctExprs.map(e => renderExpr(e, params, identOpts)).join(', ')}) ` : '';

  // Render FROM and gather WHERE predicates from Filter nodes embedded in relation tree
  const whereParts = [];
  const fromSQL = renderRelation(plan.root, params, whereParts, identOpts, opts);

  // WHERE
  const whereSQL = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';

  // ORDER BY with deterministic tie-breaker; ensure DISTINCT ON prefix when present
  let orderSQL = '';
  const orderItems = [...(plan.orderBy || [])];
  if (distinctExprs.length) {
    // Ensure orderBy begins with distinctOn expressions by position.
    // First, remove any existing entries that match a distinctOn expression
    // to prevent duplicates when the user supplies them in a different order.
    for (const de of distinctExprs) {
      const idx = orderItems.findIndex(ob => orderMentionsExpr([ob], de));
      if (idx >= 0) orderItems.splice(idx, 1);
    }
    // Then prepend all distinctOn expressions in order, preserving the
    // user's original direction/nulls if one was found above.
    const origOrderBy = plan.orderBy || [];
    for (let i = distinctExprs.length - 1; i >= 0; i--) {
      const de = distinctExprs[i];
      const orig = origOrderBy.find(ob => orderMentionsExpr([ob], de));
      orderItems.unshift(orig ? { ...orig } : { expr: de, direction: 'asc', nulls: null });
    }
  }
  if (orderItems.length > 0) {
    const rendered = orderItems.map(ob => renderOrderBy(ob, params, identOpts, opts));
    // Append tie-breaker if primary key (id) not already present
    const pkRef = typeof opts.pkResolver === 'function' ? opts.pkResolver(plan) : guessPrimaryKeyRef(plan);
    if (pkRef && !orderMentionsExpr(orderItems, pkRef)) {
      rendered.push(`${renderExpr(pkRef, params, identOpts)} ASC`);
    }
    orderSQL = `\nORDER BY ${rendered.join(', ')}`;
  }

  // LIMIT/OFFSET
  let lim = '';
  if (plan.limit != null) {
    const n = Number(plan.limit);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error(`Invalid LIMIT: ${JSON.stringify(plan.limit)}`);
    lim = `\nLIMIT ${n}`;
  }
  let off = '';
  if (plan.offset != null) {
    const n = Number(plan.offset);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error(`Invalid OFFSET: ${JSON.stringify(plan.offset)}`);
    off = `\nOFFSET ${n}`;
  }

  return `SELECT ${distinctSQL}${projectionSQL}\nFROM ${fromSQL}${whereSQL}${orderSQL}${lim}${off}`.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Relation rendering
function renderRelation(r, params, whereParts, identOpts, opts) {
  if (!r) return '';
  switch (r.kind) {
  case 'Table':
    return `${renderIdent(r.table, identOpts)} ${renderIdent(r.alias, identOpts)}`;
  case 'Subquery': {
    const sql = lowerToSQL(r.plan, params, opts);
    return `(\n${sql}\n) ${renderIdent(r.alias, identOpts)}`;
  }
  case 'Lateral': {
    const sql = lowerToSQL(r.plan, params, opts);
    return `LATERAL (\n${sql}\n) ${renderIdent(r.alias, identOpts)}`;
  }
  case 'Join': {
    const left = renderRelation(r.left, params, whereParts, identOpts, opts);
    const right = renderRelation(r.right, params, whereParts, identOpts, opts);
    let jt;
    switch (String(r.joinType || 'INNER').toUpperCase()) {
    case 'LEFT':  jt = 'LEFT JOIN';  break;
    case 'INNER': jt = 'JOIN';       break;
    default:
      throw new Error(`Unsupported join type: ${r.joinType}`);
    }
    const on = r.on ? renderPredicate(r.on, params, identOpts, opts) : 'TRUE';
    return `${left} ${jt} ${right} ON ${on}`;
  }
  case 'Filter': {
    // Non-canonical node used in tests; extract predicate into WHERE
    if (r.predicate) whereParts.push(renderPredicate(r.predicate, params, identOpts, opts));
    return renderRelation(r.input, params, whereParts, identOpts, opts);
  }
  default:
    // Fallback: assume table-like
    if (r.table && r.alias) return `${renderIdent(r.table, identOpts)} ${renderIdent(r.alias, identOpts)}`;
    throw new Error(`Unsupported relation kind: ${r.kind}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Predicates & expressions
function renderPredicate(p, params, identOpts, opts) {
  if (!p) return 'TRUE';
  switch (p.kind) {
  case 'Exists':
    return `EXISTS (\n${lowerToSQL(p.subquery, params, opts || {})}\n)`;
  case 'Not':
    return `(NOT ${renderPredicate(p.left, params, identOpts, opts)})`;
  case 'And':
    return `(${renderPredicate(p.left, params, identOpts, opts)} AND ${renderPredicate(p.right, params, identOpts, opts)})`;
  case 'Or':
    return `(${renderPredicate(p.left, params, identOpts, opts)} OR ${renderPredicate(p.right, params, identOpts, opts)})`;
  case 'Compare': {
    const { op } = p;
    // Null checks
    if (op === 'isNull')    return `${renderExpr(p.left, params, identOpts, opts)} IS NULL`;
    if (op === 'isNotNull') return `${renderExpr(p.left, params, identOpts, opts)} IS NOT NULL`;

    if (op === 'in') {
      const left = renderExpr(p.left, params, identOpts, opts);
      const paramSql = renderParam(p.right, params, /*forceCast*/true);
      return `${left} = ANY(${paramSql})`;
    }

    const left = renderExpr(p.left, params, identOpts, opts);
    const right = renderExpr(p.right, params, identOpts, opts);
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

function renderExpr(e, params, identOpts, opts) {
  if (!e) return 'NULL';
  switch (e.kind) {
  case 'ColumnRef':
    return `${renderIdent(e.table, identOpts)}.${renderIdent(e.column, identOpts)}`;
  case 'ParamRef':
    return renderParam(e, params);
  case 'Literal':
    return renderLiteral(e.value, e.type);
  case 'FuncCall': {
    const fn = String(e.name);
    if (!SAFE_FUNC_RE.test(fn)) throw new Error(`Unsafe SQL function name: ${fn}`);
    const args = (e.args || []).map(a => renderExpr(a, params, identOpts, opts)).join(', ');
    return `${fn}(${args})`;
  }
  case 'ScalarSubquery':
    return `(\n${lowerToSQL(e.plan, params, opts || {})}\n)`;
  case 'JsonBuildObject':
    return renderJsonBuildObject(e, params, identOpts, opts);
  case 'JsonAgg':
    return renderJsonAgg(e, params, identOpts, opts);
  default:
    // Backward-compat shims: duck-type plain objects that lack an explicit
    // `kind` tag but structurally match known expression shapes. These
    // fallbacks exist for legacy callers that construct raw objects instead
    // of using Nodes.mjs constructors. Tracked in .claude/bad_code.md.
    if (isObject(e.left) && e.op) return renderPredicate(e, params, identOpts, opts);
    if (e.table && e.column) return `${renderIdent(e.table, identOpts)}.${renderIdent(e.column, identOpts)}`;
    if (e.name && e.args) {
      const fn2 = String(e.name);
      if (!SAFE_FUNC_RE.test(fn2)) throw new Error(`Unsafe SQL function name: ${fn2}`);
      return `${fn2}(${(e.args||[]).map(a => renderExpr(a, params, identOpts, opts)).join(', ')})`;
    }
    throw new Error(`Unsupported expr kind '${e.kind}'`);
  }
}

function renderLiteral(v, type = null) {
  if (v === null || v === undefined) return 'NULL';
  if (type != null && !SAFE_TYPE_RE.test(String(type))) {
    throw new Error(`Unsafe SQL type cast in Literal: ${type}`);
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Invalid numeric literal: ${v}`);
    return String(v);
  }
  if (Array.isArray(v) || isObject(v)) {
    const json = JSON.stringify(v);
    return `'${escString(json)}'::${type || 'jsonb'}`;
  }
  return `'${escString(v)}'${type ? `::${type}` : ''}`;
}

function renderJsonBuildObject(e, params, identOpts, opts) {
  // fields: [{ key, value }]
  const pairs = (e.fields || []).flatMap(({ key, value }) => [
    `'${escString(String(key))}'`,
    renderExpr(value, params, identOpts, opts)
  ]);
  return `jsonb_build_object(${pairs.join(', ')})`;
}

function renderJsonAgg(e, params, identOpts, opts) {
  const inner = renderExpr(e.value, params, identOpts, opts);
  const order = (e.orderBy || []).length
    ? ' ORDER BY ' + e.orderBy.map(ob => renderOrderBy(ob, params, identOpts, opts)).join(', ')
    : '';
  return `COALESCE(jsonb_agg(${inner}${order}), '[]'::jsonb)`;
}

function renderOrderBy(ob, params, identOpts, opts) {
  const dir = ob.direction && String(ob.direction).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  let nulls = '';
  if (ob.nulls) {
    const n = String(ob.nulls).toLowerCase();
    if (n !== 'first' && n !== 'last') {
      throw new Error(`Invalid NULLS value in ORDER BY: ${ob.nulls}`);
    }
    nulls = ` NULLS ${n.toUpperCase()}`;
  }
  return `${renderExpr(ob.expr, params, identOpts, opts)} ${dir}${nulls}`;
}

function renderParam(p, params, _forceCast = false) {
  const name = p.name ?? p.param ?? 'p';
  const typeHint = p.typeHint || null;
  const special = p.special || '';
  const key = `${special}:${name}:${typeHint || ''}`;

  const idx = params.indexByName?.get ? params.indexByName.get(key) : null;
  // Fallback: look up by bare name when the fully-qualified key (special:name:typeHint)
  // misses. This legitimately triggers when the caller supplies a ParamRef whose
  // special/typeHint metadata differs from the originally collected key — e.g., a
  // forceCast=true call re-rendering the same param with an array type suffix.
  // Risk: if two params share a name but differ only in special/typeHint, the
  // name-only lookup silently binds to whichever was collected first.
  const discoveredIndex = idx ?? findIndexByNameOnly(params, name);
  if (discoveredIndex == null) throw new Error(`Param not collected for '${name}'`);

  if (typeHint && !SAFE_TYPE_RE.test(String(typeHint))) {
    throw new Error(`Unsafe SQL type hint on ParamRef: ${typeHint}`);
  }
  const cast = typeHint ? `::${typeHint}` : '';
  return `$${discoveredIndex}${cast}`;
}

function findIndexByNameOnly(params, name) {
  if (!params?.ordered) return null;
  const i = params.ordered.findIndex(p => p.name === name);
  return i >= 0 ? i + 1 : null;
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
