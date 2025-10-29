/**
 * Standard SQL Sanitization using PostgreSQL built-ins and established libraries
 * 
 * MISSION: Use industry-standard approaches for SQL safety
 * APPROACH: 
 * - Parameterized queries for runtime operations (PREFERRED)
 * - PostgreSQL's built-in escaping for schema generation (FALLBACK)
 * - Validation for structure integrity (DEFENSE IN DEPTH)
 */

/**
 * Creates safe parameterized queries using PostgreSQL standard approach
 * This is the GOLD STANDARD for preventing SQL injection
 * 
 * @param {string} sql - SQL with $1, $2, etc. placeholders
 * @param {Array} params - Parameters to bind safely
 * @returns {Object} Query ready for execution
 */
export function createSafeQuery(sql, params = []) {
  // Validate parameter indices form a contiguous 1..N sequence and match params length
  const indices = new Set();
  const re = /\$([1-9]\d*)/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    indices.add(Number(m[1]));
  }
  const max = indices.size ? Math.max(...indices) : 0;
  // Build expected set 1..max and compare
  const contiguous = max === indices.size && Array.from({ length: max }, (_, i) => i + 1).every(n => indices.has(n));
  if (!contiguous || max !== params.length) {
    const placeholderCount = indices.size;
    throw new Error(`Parameter mismatch: ${placeholderCount} placeholders (expect 1..${max}), ${params.length} parameters`);
  }
  
  // Ensure no template literals (common injection vector)
  if (sql.includes('${') || sql.includes('`')) {
    throw new Error('SQL contains template literal syntax - security violation');
  }
  
  return { sql, params };
}

/**
 * PostgreSQL-compatible identifier quoting
 * Based on PostgreSQL's pg_escape_identifier() behavior
 * 
 * @param {string} identifier - Table/column name to quote
 * @returns {string} Safely quoted identifier
 */
export function quoteIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Identifier must be a non-empty string');
  }
  
  // PostgreSQL standard: double quotes, escape internal quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * PostgreSQL-compatible literal quoting
 * Based on PostgreSQL's pg_escape_literal() behavior
 * 
 * @param {*} value - Value to quote safely
 * @returns {string} Safely quoted literal
 */
export function quoteLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Cannot quote non-finite number');
    }
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value.toString();
  }
  
  if (typeof value === 'string') {
    // PostgreSQL standard: single quotes, escape internal quotes
    return `'${value.replace(/'/g, "''")}'`;
  }
  
  throw new Error(`Cannot quote value of type ${typeof value}`);
}

/**
 * Lightweight validation for PostgreSQL identifiers
 * Prevents obvious injection attacks while allowing valid names
 * 
 * @param {string} name - Identifier to validate
 * @param {string} context - Context for error messages
 */
export function validateIdentifier(name, context = 'identifier') {
  if (!name || typeof name !== 'string') {
    throw new Error(`${context} must be a non-empty string`);
  }
  
  // Length check (PostgreSQL limit)
  if (name.length > 63) {
    throw new Error(`${context} too long (max 63 characters)`);
  }
  
  // Block obvious injection patterns
  const dangerousPatterns = [
    /;/,                 // Semicolon
    /--/,                // SQL comments
    /\/\*/,              // Block comments  
    /\b(?:DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|GRANT|REVOKE)\b/i  // DDL/DML keywords
  ];
  if (String(name).includes('\0')) {
    throw new Error(`${context} contains null byte`);
  }
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      throw new Error(`${context} contains dangerous pattern: ${name}`);
    }
  }
}

/**
 * Standard approach: Build DDL using template + safe parameters
 * This mimics what ORMs like Prisma, TypeORM, etc. do internally
 * 
 * @param {string} template - DDL template with {table}, {column} placeholders  
 * @param {Object} values - Values to substitute safely
 * @returns {string} Safe DDL statement
 */
import { validateConstraintExpression as _validateConstraintExpression } from './InputValidator.mjs';
import { validatePostgreSQLType as _validatePostgreSQLType } from './InputValidator.mjs';

/**
 * Build DDL from a template using type-aware placeholder handling.
 * Recognized placeholder keys and their treatment:
 * - identifier: table, column, index, policy, schema → quoted identifiers
 * - ident list: columns, roles → each item validated + quoted (roles keeps PUBLIC unquoted)
 * - type: type → validated PostgreSQL type (not quoted)
 * - enum: operation → one of SELECT|INSERT|UPDATE|DELETE|ALL (uppercased)
 * - sql fragment: expression → validated constraint/expression (inserted as-is)
 *
 * Unknown placeholders will throw to avoid unsafe insertion.
 */
import { validateRLSExpression as _validateRLSExpression } from './InputValidator.mjs';

export function buildDDL(template, values = {}) {
  let sql = template;

  const isArray = (v) => Array.isArray(v);

  const sanitizeIdent = (name, ctx) => {
    validateIdentifier(name, ctx);
    return quoteIdentifier(name);
  };

  const sanitizeIdentList = (val, ctx) => {
    const items = isArray(val) ? val : String(val).split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) {
      throw new Error(`${ctx} must contain at least one identifier`);
    }
    return items.map(it => sanitizeIdent(it, `${ctx} item`)).join(', ');
  };

  const sanitizeRoles = (val) => {
    const items = isArray(val) ? val : String(val).split(',').map(s => s.trim()).filter(Boolean);
    const special = new Set(['PUBLIC', 'ANONYMOUS', 'AUTHENTICATED', 'CURRENT_ROLE', 'CURRENT_USER', 'SESSION_USER']);
    if (items.length === 0) throw new Error('roles must contain at least one role');
    return items.map(r => special.has(String(r).toUpperCase()) ? String(r).toUpperCase() : sanitizeIdent(r, 'role')).join(', ');
  };

  const sanitizeType = (t) => {
    _validatePostgreSQLType(String(t));
    return String(t);
  };

  const sanitizeOperation = (op) => {
    const allowed = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL']);
    const up = String(op).toUpperCase();
    if (!allowed.has(up)) {
      throw new Error(`operation must be one of ${[...allowed].join(', ')}`);
    }
    return up;
  };

  const sanitizeConstraintFragment = (expr) => {
    _validateConstraintExpression(String(expr));
    return String(expr);
  };

  // Split a comma-separated list at top-level (ignoring commas inside quotes/parentheses)
  const splitTopLevel = (input, delimiter = ',') => {
    const s = String(input ?? '');
    const parts = [];
    let buf = '';
    let depth = 0;
    let inSQ = false; // '
    let inDQ = false; // "
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const prev = s[i - 1];
      if (!inSQ && ch === '"') inDQ = !inDQ;
      else if (!inDQ && ch === '\'') inSQ = !inSQ;
      else if (!inSQ && !inDQ && ch === '(') depth++;
      else if (!inSQ && !inDQ && ch === ')') depth = Math.max(0, depth - 1);
      if (ch === delimiter && !inSQ && !inDQ && depth === 0) {
        parts.push(buf.trim());
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf.trim().length) parts.push(buf.trim());
    return parts;
  };

  // Tokenize a clause by whitespace while keeping parentheses and quoted strings intact
  const tokenize = (input) => {
    const s = String(input ?? '').trim();
    const tokens = [];
    let buf = '';
    let inSQ = false;
    let inDQ = false;
    let depth = 0;
    const flush = () => { if (buf.length) { tokens.push(buf); buf = ''; } };
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inSQ) {
        buf += ch;
        if (ch === '\'' && s[i - 1] !== '\\') inSQ = false;
        continue;
      }
      if (inDQ) {
        buf += ch;
        if (ch === '"' && s[i - 1] !== '\\') inDQ = false;
        continue;
      }
      if (ch === '\'') { inSQ = true; buf += ch; continue; }
      if (ch === '"') { inDQ = true; buf += ch; continue; }
      if (ch === '(') { depth++; buf += ch; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); buf += ch; continue; }
      if (/\s/.test(ch) && depth === 0) { flush(); continue; }
      buf += ch;
    }
    flush();
    return tokens;
  };

  // Find the longest prefix of tokens that forms a valid PostgreSQL type
  const extractTypePrefix = (rest) => {
    const toks = tokenize(rest);
    let bestIdx = 0;
    let best = '';
    for (let i = 1; i <= toks.length; i++) {
      const cand = toks.slice(0, i).join(' ');
      try {
        _validatePostgreSQLType(cand);
        bestIdx = i;
        best = cand;
      } catch (_) {
        // keep searching for longer valid prefix; validator throws on invalid
      }
    }
    if (bestIdx === 0) {
      throw new Error(`column_defs: could not parse PostgreSQL type from: ${rest}`);
    }
    return { type: best, remainderTokens: toks.slice(bestIdx) };
  };

  const upper = (s) => String(s).toUpperCase();
  const isWord = (tok, w) => upper(tok) === w;
  const nextIs = (tokens, i, ...words) => words.every((w, k) => upper(tokens[i + k]) === w);

  const sanitizeReferences = (tokens, startIdx) => {
    let i = startIdx;
    if (!isWord(tokens[i], 'REFERENCES')) return { consumed: 0, text: '' };
    i++;
    if (i >= tokens.length) throw new Error('REFERENCES requires table identifier');
    let tableTok = tokens[i++];
    // Allow schema.table or quoted identifiers
    const quoteStrip = (t) => t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/""/g, '"') : t;
    const parts = tableTok.split('.').map(quoteStrip);
    if (parts.length > 2) throw new Error('REFERENCES: invalid qualified name');
    const sanitizedTable = parts.map(p => sanitizeIdent(p, 'fk table')).join('.');
    let text = `REFERENCES ${sanitizedTable}`;
    // Optional column list
    if (i < tokens.length && /^\(/.test(tokens[i])) {
      const colTok = tokens[i++];
      const colMatch = colTok.match(/^\((.*)\)$/);
      if (!colMatch) throw new Error('REFERENCES: expected single column in parentheses');
      const colName = colMatch[1].trim();
      if (!colName) throw new Error('REFERENCES: empty column list');
      text += ` (${sanitizeIdent(colName, 'fk column')})`;
    }
    // Optional actions
    while (i < tokens.length) {
      if (nextIs(tokens, i, 'ON', 'DELETE') || nextIs(tokens, i, 'ON', 'UPDATE')) {
        const actionType = upper(tokens[i + 1]);
        i += 2;
        const actionTok = upper(tokens[i++] || '');
        const nextTok = upper(tokens[i] || '');
        const action = (actionTok === 'SET' && (nextTok === 'NULL' || nextTok === 'DEFAULT'))
          ? `SET ${nextTok}` && (i++, `SET ${nextTok}`)
          : (['NO', 'RESTRICT', 'CASCADE'].includes(actionTok) ? (actionTok === 'NO' ? (i++, 'NO ACTION') : actionTok) : null);
        const resolved = action || actionTok;
        const allowed = new Set(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']);
        if (!allowed.has(resolved)) throw new Error(`REFERENCES: invalid action ${actionTok}`);
        text += ` ON ${actionType} ${resolved}`;
        continue;
      }
      break; // stop on unknown sequence; rest processed by caller
    }
    return { consumed: i - startIdx, text };
  };

  const sanitizeConstraints = (tokens) => {
    const out = [];
    let i = 0;
    const emit = (s) => out.push(s);
    const restFrom = (j) => tokens.slice(j).join(' ');
    const findNextKeywordIdx = (j) => {
      const keywords = ['PRIMARY', 'NOT', 'NULL', 'UNIQUE', 'CHECK', 'REFERENCES', 'COLLATE', 'GENERATED'];
      for (let k = j; k < tokens.length; k++) {
        if (keywords.includes(upper(tokens[k]))) return k;
      }
      return tokens.length;
    };
    while (i < tokens.length) {
      const t = upper(tokens[i]);
      if (t === 'PRIMARY' && upper(tokens[i + 1]) === 'KEY') {
        emit('PRIMARY KEY'); i += 2; continue;
      }
      if (t === 'NOT' && upper(tokens[i + 1]) === 'NULL') { emit('NOT NULL'); i += 2; continue; }
      if (t === 'NULL') { emit('NULL'); i += 1; continue; }
      if (t === 'UNIQUE') { emit('UNIQUE'); i += 1; continue; }
      if (t === 'COLLATE') {
        const col = tokens[i + 1];
        if (!col) throw new Error('COLLATE requires a name');
        // Collation is an identifier
        const name = col.startsWith('"') && col.endsWith('"') ? col.slice(1, -1).replace(/""/g, '"') : col;
        emit(`COLLATE ${sanitizeIdent(name, 'collation')}`); i += 2; continue;
      }
      if (t === 'DEFAULT') {
        // Capture until next recognized keyword at top level
        const j = findNextKeywordIdx(i + 1);
        const expr = restFrom(i + 1).split(' ').slice(0, j - (i + 1)).join(' ');
        _validateConstraintExpression(expr);
        emit(`DEFAULT ${expr}`);
        i = j; continue;
      }
      if (t === 'CHECK') {
        const exprTok = tokens[i + 1] || '';
        const m = exprTok.match(/^\((.*)\)$/s);
        if (!m) throw new Error('CHECK requires (...) expression');
        _validateConstraintExpression(m[1]);
        emit(`CHECK (${m[1]})`);
        i += 2; continue;
      }
      if (t === 'REFERENCES') {
        const { consumed, text } = sanitizeReferences(tokens, i);
        if (!consumed) throw new Error('Invalid REFERENCES clause');
        emit(text);
        i += consumed; continue;
      }
      if (t === 'GENERATED') {
        // Accept common identity forms
        if (nextIs(tokens, i + 1, 'ALWAYS', 'AS', 'IDENTITY')) {
          emit('GENERATED ALWAYS AS IDENTITY'); i += 4; continue;
        }
        if (nextIs(tokens, i + 1, 'BY', 'DEFAULT', 'AS', 'IDENTITY')) {
          emit('GENERATED BY DEFAULT AS IDENTITY'); i += 5; continue;
        }
        throw new Error('Unsupported GENERATED clause');
      }
      throw new Error(`Unsupported or unsafe column constraint token: ${tokens[i]}`);
    }
    return out.join(' ');
  };

  const sanitizeColumnDef = (clause) => {
    const s = String(clause ?? '').trim();
    if (!s) throw new Error('column_defs clause cannot be empty');
    const m = s.match(/^\s*(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s+([\s\S]+)$/);
    if (!m) throw new Error(`column_defs clause must start with an identifier: ${s}`);
    const rawName = m[1] ?? m[2];
    const rest = m[3];
    const name = sanitizeIdent(rawName, 'column');
    const { type, remainderTokens } = extractTypePrefix(rest);
    // Validate type
    _validatePostgreSQLType(type);
    const constraints = remainderTokens.length ? sanitizeConstraints(remainderTokens) : '';
    return [name, type, constraints].filter(Boolean).join(' ');
  };

  const sanitizeColumnDefs = (val) => {
    const str = Array.isArray(val) ? val.map(String).join(', ') : String(val ?? '');
    // Split into clauses and sanitize each
    const clauses = splitTopLevel(str, ',');
    if (clauses.length === 0) throw new Error('column_defs must contain at least one column definition');
    return clauses.map(sanitizeColumnDef).join(', ');
  };

  const sanitizePolicyExpression = (expr) => {
    _validateRLSExpression(String(expr));
    return String(expr);
  };

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{${key}}`;
    if (!sql.includes(placeholder)) continue;

    let replacement;
    switch (key) {
      case 'table':
      case 'column':
      case 'index':
      case 'policy':
      case 'schema':
        replacement = sanitizeIdent(value, key);
        break;
      case 'columns':
        replacement = sanitizeIdentList(value, 'columns');
        break;
      case 'column_defs':
        replacement = sanitizeColumnDefs(value);
        break;
      case 'roles':
        replacement = sanitizeRoles(value);
        break;
      case 'type':
        replacement = sanitizeType(value);
        break;
      case 'operation':
        replacement = sanitizeOperation(value);
        break;
      case 'expression':
        replacement = sanitizePolicyExpression(value);
        break;
      case 'using':
        replacement = sanitizePolicyExpression(value);
        break;
      case 'check':
        replacement = sanitizePolicyExpression(value);
        break;
      default:
        throw new Error(`Unsupported placeholder: {${key}}`);
    }

    sql = sql.replace(new RegExp(`\\{${key}\\}`, 'g'), () => replacement);
  }

  // Final safety guard: no unresolved {placeholders} may remain
  const unresolved = sql.match(/\{[^}]+\}/g);
  if (unresolved && unresolved.length) {
    throw new Error(`Unresolved DDL placeholders: ${[...new Set(unresolved)].join(', ')}`);
  }

  return sql;
}

/**
 * Utility: format an array of column definitions as a comma+space separated list.
 * buildDDL already accepts arrays for {column_defs}, but this helper makes intent explicit
 * at call sites that want to pre-format the fragment.
 */
export function formatColumnDefs(items) {
  if (!Array.isArray(items)) return String(items ?? '');
  return items.map(String).join(', ');
}

/**
 * Safe DDL templates for common operations
 * These follow PostgreSQL best practices and can be safely parameterized
 */
export const DDL_TEMPLATES = {
  CREATE_TABLE: 'CREATE TABLE IF NOT EXISTS {table} ({column_defs})',
  ADD_COLUMN: 'ALTER TABLE {table} ADD COLUMN {column} {type}',
  DROP_COLUMN: 'ALTER TABLE {table} DROP COLUMN IF EXISTS {column}',
  CREATE_INDEX: 'CREATE INDEX IF NOT EXISTS {index} ON {table} ({columns})',
  DROP_INDEX: 'DROP INDEX IF EXISTS {index}',
  
  // RLS Templates (safer than string building)
  ENABLE_RLS: 'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY',
  // Create policy variants to cover USING / WITH CHECK forms
  CREATE_POLICY_USING: 'CREATE POLICY {policy} ON {table} FOR {operation} TO {roles} USING ({using})',
  CREATE_POLICY_WITH_CHECK: 'CREATE POLICY {policy} ON {table} FOR {operation} TO {roles} WITH CHECK ({check})',
  CREATE_POLICY_USING_WITH_CHECK: 'CREATE POLICY {policy} ON {table} FOR {operation} TO {roles} USING ({using}) WITH CHECK ({check})'
};

/**
 * Example usage for Wesley generators:
 * 
 * // GOOD: Using templates + validation
 * const sql = buildDDL(DDL_TEMPLATES.CREATE_TABLE, {
 *   table: tableName,              // identifier → quoted automatically
 *   column_defs: [                 // SQL fragments → validated
 *     '"id" uuid PRIMARY KEY',
 *     '"email" text NOT NULL'
 *   ]
 * });
 * 
 * // RLS: INSERT policy (WITH CHECK only)
 * const insertPolicy = buildDDL(DDL_TEMPLATES.CREATE_POLICY_WITH_CHECK, {
 *   policy: 'p_insert_owner',
 *   table: 'posts',
 *   operation: 'INSERT',
 *   roles: ['PUBLIC'],
 *   check: "auth.uid() = owner_id"
 * });
 * 
 * // RLS: UPDATE policy (USING + WITH CHECK)
 * const updatePolicy = buildDDL(DDL_TEMPLATES.CREATE_POLICY_USING_WITH_CHECK, {
 *   policy: 'p_update_owner',
 *   table: 'posts',
 *   operation: 'UPDATE',
 *   roles: ['authenticated'],
 *   using: "auth.uid() = owner_id",
 *   check: "auth.uid() = owner_id"
 * });
 * 
 * // GOOD: Using parameterized queries for runtime operations  
 * const query = createSafeQuery(
 *   'SELECT * FROM pg_indexes WHERE indexname = $1',
 *   [indexName]
 * );
 * 
 * // BAD: String interpolation (what we're replacing)
 * const sql = `CREATE TABLE ${tableName} (${columns})`;
 */
