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
  // Validate parameter count matches placeholders
  const placeholderCount = (sql.match(/\$\d+/g) || []).length;
  if (placeholderCount !== params.length) {
    throw new Error(
      `Parameter mismatch: ${placeholderCount} placeholders, ${params.length} parameters`
    );
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
    /[;\x00]/,           // Semicolon or null byte
    /--/,                // SQL comments
    /\/\*/,              // Block comments  
    /DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|GRANT|REVOKE/i  // DDL/DML keywords
  ];
  
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
    const special = new Set(['PUBLIC', 'CURRENT_ROLE', 'CURRENT_USER', 'SESSION_USER']);
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

  const sanitizeExpression = (expr) => {
    _validateConstraintExpression(String(expr));
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
        replacement = sanitizeExpression(value);
        break;
      default:
        throw new Error(`Unsupported placeholder: {${key}}`);
    }

    sql = sql.replace(new RegExp(`\\{${key}\\}`, 'g'), replacement);
  }

  return sql;
}

/**
 * Safe DDL templates for common operations
 * These follow PostgreSQL best practices and can be safely parameterized
 */
export const DDL_TEMPLATES = {
  CREATE_TABLE: 'CREATE TABLE IF NOT EXISTS {table} ({columns})',
  ADD_COLUMN: 'ALTER TABLE {table} ADD COLUMN {column} {type}',
  DROP_COLUMN: 'ALTER TABLE {table} DROP COLUMN IF EXISTS {column}',
  CREATE_INDEX: 'CREATE INDEX IF NOT EXISTS {index} ON {table} ({columns})',
  DROP_INDEX: 'DROP INDEX IF EXISTS {index}',
  
  // RLS Templates (safer than string building)
  ENABLE_RLS: 'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY',
  CREATE_POLICY: 'CREATE POLICY {policy} ON {table} FOR {operation} TO {roles} USING ({expression})'
};

/**
 * Example usage for Wesley generators:
 * 
 * // GOOD: Using templates + validation
 * const sql = buildDDL(DDL_TEMPLATES.CREATE_TABLE, {
 *   table: tableName,              // identifier → quoted automatically
 *   columns: ['id', 'email']       // identifiers → quoted and joined
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
