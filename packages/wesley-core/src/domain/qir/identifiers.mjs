/**
 * Identifier validation and quoting utilities for QIR → SQL.
 *
 * Goals
 * - Provide a single source of truth for identifier rules
 * - Support both minimal (legacy) and strict policies
 * - Avoid surprises around reserved keywords and invalid characters
 */

// A pragmatic reserved keyword set covering common PostgreSQL 16 fully-reserved tokens.
// Not exhaustive; intended to catch obvious collisions.
export const RESERVED = new Set([
  'all','alter','analyze','and','any','as','asc','between','by','case','cast','check','collate',
  'column','constraint','create','cross','current_catalog','current_date','current_role',
  'current_schema','current_time','current_timestamp','default','delete','desc','distinct','do',
  'drop','else','end','except','exists','false','fetch','for','foreign','from','full','grant',
  'group','having','ilike','in','index','inner','insert','intersect','into','is','join','left',
  'like','limit','localtime','localtimestamp','natural','not','null','offset','on','or','order',
  'outer','primary','references','returning','revoke','right','select','session_user','set',
  'some','table','then','to','trigger','true','union','unique','update','user','using','values',
  'view','when','where','window','with'
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
 * - strict: validate allowed character pattern and always quote;
 *   reserved keywords are safely quoted (not rejected)
 */
export function renderIdent(ident, { policy = 'minimal' } = {}) {
  const s = String(ident);
  if (policy === 'strict') {
    if (!IDENT_SAFE_RE.test(s)) {
      throw new Error(`Invalid SQL identifier: ${s}`);
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
  const lower = String(s || '').toLowerCase();
  let out = '';
  let prevUnderscore = false;
  for (const ch of lower) {
    const isAlphaNum =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9');
    if (isAlphaNum) {
      out += ch;
      prevUnderscore = false;
      continue;
    }
    if (!prevUnderscore) {
      out += '_';
      prevUnderscore = true;
    }
  }
  while (out.startsWith('_')) out = out.slice(1);
  while (out.endsWith('_')) out = out.slice(0, -1);
  return out || fallback;
}
