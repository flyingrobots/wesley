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
import { sanitizeIdentBase as _sanitizeIdentBase } from './identifiers.mjs';

const DEFAULT_SCHEMA = 'wes_ops';

// Minimal reserved keyword list (PostgreSQL core). Not exhaustive; used to avoid
// accidental collisions for unquoted identifiers (e.g., parameter names).
const RESERVED = new Set([
  'select','insert','update','delete','from','where','group','order','by','limit','offset','join','left','right','on','and','or','not','null','true','false','table','view','function','schema','user'
]);

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
  setSearchPath = null,
} = {}) {
  const name = qualifiedOpName(schema, opName);
  const { ordered } = collectParams(plan);
  const params = uniqueParamNames(ordered).map(({ display, type }) => `${display} ${type || 'text'}`).join(', ');
  const selectSql = lowerToSQL(plan, null, { identPolicy, pkResolver });
  const body = `SELECT to_jsonb(q.*) FROM (\n${selectSql}\n) AS q`;
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
    `RETURNS SETOF jsonb`,
    ...attrs,
    `AS $$`,
    body,
    `$$;`
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

function renderSearchPath(sp) {
  if (!sp) return '';
  let parts = Array.isArray(sp) ? sp : String(sp).split(',');
  parts = parts.map((p) => String(p).trim()).filter(Boolean);
  if (parts.length === 0) return '';
  // Quote identifiers deterministically
  return parts.map((p) => sanitizeIdent(p)).join(', ');
}
