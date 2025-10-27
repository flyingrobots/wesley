/**
 * Identifier validation and quoting utilities for QIR → SQL.
 *
 * Goals
 * - Provide a single source of truth for identifier rules
 * - Support both minimal (legacy) and strict policies
 * - Avoid surprises around reserved keywords and invalid characters
 */

// A pragmatic reserved keyword set covering common PostgreSQL tokens.
// Not exhaustive; intended to catch obvious collisions.
export const RESERVED = new Set([
  'all','analyze','and','as','asc','between','by','case','check','collate','column','constraint',
  'create','cross','current_catalog','current_date','current_role','current_schema','current_time',
  'current_timestamp','default','delete','desc','distinct','do','else','end','except','exists',
  'false','fetch','for','foreign','from','full','group','having','ilike','in','inner','insert','intersect',
  'into','is','join','left','like','limit','localtime','localtimestamp','natural','not','null','offset',
  'on','or','order','outer','primary','references','returning','right','select','session_user',
  'some','table','then','to','true','union','unique','update','user','using','values','view','when','where',
]);

const IDENT_SAFE_RE = /^[a-z_][a-z0-9_]*$/; // canonical unquoted identifier

export function needsQuoting(ident) {
  const s = String(ident);
  return !IDENT_SAFE_RE.test(s) || RESERVED.has(s.toLowerCase());
}

export function quoteIdent(ident) {
  const s = String(ident);
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Validate identifier per policy and return the SQL-safe rendering.
 *
 * Policies:
 * - minimal (default): quote only if necessary (legacy behavior)
 * - strict: validate allowed pattern and always quote; throw on RESERVED
 */
export function renderIdent(ident, { policy = 'minimal' } = {}) {
  const s = String(ident);
  if (policy === 'strict') {
    if (!IDENT_SAFE_RE.test(s)) {
      throw new Error(`Invalid SQL identifier: ${s}`);
    }
    if (RESERVED.has(s.toLowerCase())) {
      throw new Error(`Identifier collides with reserved keyword: ${s}`);
    }
    return quoteIdent(s);
  }
  // minimal
  return needsQuoting(s) ? quoteIdent(s) : s;
}

/**
 * Sanitize display/base names for generated idents (lowercased, underscores,
 * trimmed). Used for op names and parameter bases. Length limit enforced by caller.
 */
export function sanitizeIdentBase(s, fallback = 'unnamed') {
  const base = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || fallback;
}

