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

export function emitView(opName, plan, { schema = DEFAULT_SCHEMA } = {}) {
  const name = qualifiedOpName(schema, opName);
  const selectSql = lowerToSQL(plan);
  return `CREATE OR REPLACE VIEW ${name} AS\n${selectSql};`;
}

export function emitFunction(opName, plan, { schema = DEFAULT_SCHEMA } = {}) {
  const name = qualifiedOpName(schema, opName);
  const { ordered } = collectParams(plan);
  const params = uniqueParamNames(ordered).map(({ display, type }) => `${display} ${type || 'text'}`).join(', ');
  const selectSql = lowerToSQL(plan);
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

function sanitizeOpName(s) {
  // prefix for ops; keep deterministic; strip non-word to underscores, lowercase
  const base = String(s || 'op').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `op_${base || 'unnamed'}`;
}

function sanitizeIdent(s) {
  // conservative: allow letters, digits, underscore
  const v = String(s || '').replace(/[^a-zA-Z0-9_]/g, '');
  return v || 'public';
}

function uniqueParamNames(ordered) {
  const seen = new Map();
  const out = [];
  for (const p of ordered) {
    const base = `p_${String(p.name || 'arg')}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    const display = n === 0 ? base : `${base}_${n+1}`;
    out.push({ display, type: p.typeHint || 'text' });
  }
  return out;
}

