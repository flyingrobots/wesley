/**
 * QIR Emission (MVP): wrap lowered SELECT into a deterministic VIEW or SQL function.
 * - View: CREATE OR REPLACE VIEW wes_ops.op_<name> AS <select>;
 * - Function (invoker): CREATE OR REPLACE FUNCTION wes_ops.op_<name>(params...) RETURNS SETOF jsonb LANGUAGE sql STABLE AS $$ SELECT to_jsonb(q.*) FROM (<select>) q $$;
 *
 * Notes
 * - Deterministic naming via sanitizeName().
 * - Parameter order and types derived from collectParams(plan).
 * - Body uses to_jsonb wrapper to avoid table type mapping for MVP.
 * - Delegates DDL rendering to SqlDialect (default: PostgresDialect).
 */

import { lowerToSQL } from './lowerToSQL.mjs';
import { collectParams } from './ParamCollector.mjs';
import { sanitizeIdentBase as _sanitizeIdentBase, RESERVED } from './identifiers.mjs';
import { PostgresDialect } from './dialects/PostgresDialect.mjs';

const DEFAULT_SCHEMA = 'wes_ops';
const DEFAULT_DIALECT = new PostgresDialect();

// identPolicy defaults to 'strict' here (ops emission is always strict) whereas
// lowerToSQL defaults to 'minimal' for backward-compat with direct callers.
export function emitView(opName, plan, {
  schema = DEFAULT_SCHEMA,
  identPolicy = 'strict',
  pkResolver = null,
  setSearchPath = null,
  baseSchema = null,
  dialect = DEFAULT_DIALECT
} = {}) {
  const name = qualifiedOpName(schema, opName, dialect);
  const selectSql = lowerToSQL(plan, null, { identPolicy, pkResolver, dialect, tableSchema: baseSchema });
  const sp = renderSearchPath(setSearchPath, dialect);
  return dialect.createView(name, selectSql, sp);
}

export function emitFunction(opName, plan, {
  schema = DEFAULT_SCHEMA,
  identPolicy = 'strict',
  pkResolver = null,
  security = 'invoker',
  setSearchPath = null,
  baseSchema = null,
  dialect = DEFAULT_DIALECT
} = {}) {
  const name = qualifiedOpName(schema, opName, dialect);
  const paramEnv = collectParams(plan);
  const { ordered } = paramEnv;
  const params = uniqueParamNames(ordered, dialect).map(({ display, type }) => `${display} ${type || 'text'}`).join(', ');
  const selectSql = lowerToSQL(plan, paramEnv, { identPolicy, pkResolver, dialect, tableSchema: baseSchema });
  const body = `SELECT ${dialect.wrapToJsonb('q')} FROM (\n${selectSql}\n) AS ${dialect.quoteIdent('q')}`;

  // Optional: SET search_path = <list>
  const sp = renderSearchPath(setSearchPath, dialect);

  return dialect.createFunction({
    qualifiedName: name,
    paramsSql: params,
    bodySql: body,
    security,
    searchPathSql: sp
  });
}

function qualifiedOpName(schema, opName, dialect) {
  return `${sanitizeIdent(schema, dialect)}.${sanitizeOpName(opName, dialect)}`;
}

/**
 * Normalize a string into a safe SQL identifier base (unquoted).
 * Delegates to the shared `sanitizeIdentBase` from identifiers.mjs,
 * then enforces the dialect's identifier limit.
 */
function sanitizeIdentBase(s, fallback, dialect) {
  const result = _sanitizeIdentBase(s, fallback);
  const limit = dialect.identifierLimit();
  if (result.length > limit) {
    throw new Error(`Identifier base exceeds ${limit}-character limit: "${result}"`);
  }
  return result;
}

function sanitizeOpName(s, dialect) {
  const base = sanitizeIdentBase(s, 'op', dialect);
  // Avoid confusing collisions with the required "op_" prefix by substituting
  // "unnamed" when the sanitized base is exactly "op" → "op_unnamed".
  const final = `op_${base === 'op' ? 'unnamed' : base}`;
  const limit = dialect.identifierLimit();
  if (final.length > limit) {
    throw new Error(`Operation identifier exceeds ${limit} characters: "${final}"`);
  }
  return dialect.quoteIdent(final);
}

function sanitizeIdent(s, dialect) {
  const base = sanitizeIdentBase(s, 'public', dialect);
  return dialect.quoteIdent(base);
}

function uniqueParamNames(ordered, dialect) {
  const seen = new Map();
  const out = [];
  const limit = dialect.identifierLimit();
  for (const p of ordered) {
    const base = `p_${sanitizeIdentBase(p.name, 'arg', dialect)}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    let display = n === 0 ? base : `${base}_${n}`;
    if (RESERVED.has(display.toLowerCase())) display = `${display}_p`;
    if (display.length > limit) {
      throw new Error(`Parameter identifier exceeds ${limit} characters: "${display}"`);
    }
    out.push({ display, type: p.typeHint || 'text' });
  }
  return out;
}

// PostgreSQL special search_path entries that must be emitted verbatim (unquoted).
// $user resolves to the session user's default schema; pg_temp is the per-session
// temp schema. Both are pseudo-identifiers that cannot survive sanitizeIdentBase.
const PG_SPECIAL_SEARCH_PATH = new Set(['$user', 'pg_temp']);

/**
 * Render SET search_path value. Non-special entries are lowercased via
 * sanitizeIdentBase and double-quoted. PostgreSQL special variables ($user,
 * pg_temp) are emitted verbatim. Note: case-sensitive schema names are
 * folded to lowercase by sanitizeIdentBase.
 */
function renderSearchPath(sp, dialect) {
  if (!sp) return '';
  let parts = Array.isArray(sp) ? sp : String(sp).split(',');
  parts = parts.map((p) => String(p).trim()).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((p) => {
    if (PG_SPECIAL_SEARCH_PATH.has(p)) return p;
    return dialect.quoteIdent(sanitizeIdentBase(p, 'public', dialect));
  }).join(', ');
}
