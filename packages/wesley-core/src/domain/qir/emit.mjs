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

const DEFAULT_SCHEMA = 'wes_ops';

// Minimal reserved keyword list (PostgreSQL core). Not exhaustive; used to avoid
// accidental collisions for unquoted identifiers (e.g., parameter names).
const RESERVED = new Set([
  'select','insert','update','delete','from','where','group','order','by','limit','offset','join','left','right','on','and','or','not','null','true','false','table','view','function','schema','user'
]);

export function emitView(opName, plan, { schema = DEFAULT_SCHEMA, identPolicy = 'strict' } = {}) {
  const name = qualifiedOpName(schema, opName);
  const selectSql = lowerToSQL(plan, null, { identPolicy });
  return `CREATE OR REPLACE VIEW ${name} AS\n${selectSql};`;
}

export function emitFunction(opName, plan, { schema = DEFAULT_SCHEMA, identPolicy = 'strict' } = {}) {
  const name = qualifiedOpName(schema, opName);
  const { ordered } = collectParams(plan);
  const params = uniqueParamNames(ordered).map(({ display, type }) => `${display} ${type || 'text'}`).join(', ');
  const selectSql = lowerToSQL(plan, null, { identPolicy });
  const body = `SELECT to_jsonb(q.*) FROM (\n${selectSql}\n) AS q`;
  return [
    `CREATE OR REPLACE FUNCTION ${name}(${params})`,
    `RETURNS SETOF jsonb`,
    `LANGUAGE sql`,
    `STABLE`,
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
 * - Lowercases, replaces non-alphanumerics with underscores, trims leading/trailing underscores.
 * - Returns `fallback` if the normalized base is empty.
 * - Validates length per PostgreSQL's 63-character identifier limit.
 *
 * Note: Callers that add prefixes (e.g., `op_`, `p_`) should ensure the final
 * identifier including the prefix also satisfies the length limit.
 *
 * @param {string} s input string to normalize
 * @param {string} fallback fallback value if result is empty
 * @returns {string} normalized identifier base (not quoted)
 * @throws {Error} if normalized identifier exceeds 63 characters
 */
function sanitizeIdentBase(s, fallback) {
  const base = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const result = base || fallback;
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
