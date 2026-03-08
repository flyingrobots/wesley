/**
 * QIR Emission (MVP): wrap lowered SELECT into a deterministic VIEW or SQL function.
 * - View: CREATE OR REPLACE VIEW wes_ops.op_<name> AS <select>;
 * - Function (invoker): CREATE OR REPLACE FUNCTION wes_ops.op_<name>(params...) RETURNS SETOF jsonb LANGUAGE sql STABLE AS $$ SELECT to_jsonb(q.*) FROM (<select>) q $$;
 *
 * Notes
 * - Deterministic naming via sanitizeName().
 * - Parameter order and types derived from collectParams(plan).
 * - Body uses to_jsonb wrapper to avoid table type mapping for MVP.
 */

import { lowerToSQL } from './lowerToSQL.mjs';
import { collectParams } from './ParamCollector.mjs';
import { sanitizeIdentBase as _sanitizeIdentBase, RESERVED } from './identifiers.mjs';

const DEFAULT_SCHEMA = 'wes_ops';

// identPolicy defaults to 'strict' here (ops emission is always strict) whereas
// lowerToSQL defaults to 'minimal' for backward-compat with direct callers.
export function emitView(opName, plan, { schema = DEFAULT_SCHEMA, identPolicy = 'strict', pkResolver = null } = {}) {
  const name = qualifiedOpName(schema, opName);
  const selectSql = lowerToSQL(plan, null, { identPolicy, pkResolver });
  return `CREATE OR REPLACE VIEW ${name} AS\n${selectSql};`;
}

export function emitFunction(opName, plan, {
  schema = DEFAULT_SCHEMA,
  identPolicy = 'strict',
  pkResolver = null,
  security = 'invoker',
  setSearchPath = null
} = {}) {
  const name = qualifiedOpName(schema, opName);
  const paramEnv = collectParams(plan);
  const { ordered } = paramEnv;
  const params = uniqueParamNames(ordered).map(({ display, type }) => `${display} ${type || 'text'}`).join(', ');
  const selectSql = lowerToSQL(plan, paramEnv, { identPolicy, pkResolver });
  const body = `SELECT to_jsonb(${sqlQuoteIdent('q')}.*) FROM (\n${selectSql}\n) AS ${sqlQuoteIdent('q')}`;
  const attrs = [];
  // Language and volatility first
  attrs.push('LANGUAGE sql');
  attrs.push('STABLE');
  // SECURITY { INVOKER | DEFINER }
  const sec = String(security || 'invoker').toLowerCase() === 'definer' ? 'SECURITY DEFINER' : 'SECURITY INVOKER';
  attrs.push(sec);
  // Optional: SET search_path = <list>
  const sp = renderSearchPath(setSearchPath);
  if (sp) attrs.push(`SET search_path = ${sp}`);

  return [
    `CREATE OR REPLACE FUNCTION ${name}(${params})`,
    'RETURNS SETOF jsonb',
    ...attrs,
    'AS $$',
    body,
    '$$;'
  ].join('\n');
}

function qualifiedOpName(schema, opName) {
  return `${sanitizeIdent(schema)}.${sanitizeOpName(opName)}`;
}

/**
 * Normalize a string into a safe SQL identifier base (unquoted).
 * Delegates to the shared `sanitizeIdentBase` from identifiers.mjs,
 * then enforces PostgreSQL's 63-character identifier limit.
 */
function sanitizeIdentBase(s, fallback) {
  const result = _sanitizeIdentBase(s, fallback);
  if (result.length > 63) {
    throw new Error(`Identifier base exceeds PostgreSQL's 63-character limit: "${result}"`);
  }
  return result;
}

function sanitizeOpName(s) {
  const base = sanitizeIdentBase(s, 'op');
  // Avoid confusing collisions with the required "op_" prefix by substituting
  // "unnamed" when the sanitized base is exactly "op" → "op_unnamed".
  const final = `op_${base === 'op' ? 'unnamed' : base}`;
  if (final.length > 63) {
    throw new Error(`Operation identifier exceeds 63 characters: "${final}"`);
  }
  return sqlQuoteIdent(final);
}

function sanitizeIdent(s) {
  const base = sanitizeIdentBase(s, 'public');
  return sqlQuoteIdent(base);
}

function sqlQuoteIdent(raw) {
  const escaped = String(raw).replace(/"/g, '""');
  return `"${escaped}"`;
}

function uniqueParamNames(ordered) {
  const seen = new Map();
  const out = [];
  for (const p of ordered) {
    const base = `p_${sanitizeIdentBase(p.name, 'arg')}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    let display = n === 0 ? base : `${base}_${n}`;
    if (RESERVED.has(display.toLowerCase())) display = `${display}_p`;
    if (display.length > 63) {
      throw new Error(`Parameter identifier exceeds 63 characters: "${display}"`);
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
function renderSearchPath(sp) {
  if (!sp) return '';
  let parts = Array.isArray(sp) ? sp : String(sp).split(',');
  parts = parts.map((p) => String(p).trim()).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((p) => {
    if (PG_SPECIAL_SEARCH_PATH.has(p)) return p;
    return sqlQuoteIdent(sanitizeIdentBase(p, 'public'));
  }).join(', ');
}
