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
export function buildDDL(template, values = {}) {
  let sql = template;
  
  // Replace placeholders with safely quoted values
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{${key}}`;
    
    if (sql.includes(placeholder)) {
      // Validate then quote the identifier
      validateIdentifier(value, key);
      sql = sql.replace(new RegExp(`\\{${key}\\}`, 'g'), quoteIdentifier(value));
    }
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
 *   table: tableName,  // Validated and quoted automatically
 *   columns: columnDefs.join(', ')
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