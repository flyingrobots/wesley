/**
 * Input Validation and Sanitization Utilities
 * 
 * MISSION: Centralized security functions to prevent SQL injection and input attacks
 * SCOPE: All user input and external data processing in Wesley
 * PRIORITY: CRITICAL - Production security requirement
 * 
 * NOTE: For dynamic SQL queries, prefer parameterized queries over these escape functions.
 * These validators are primarily for schema definition generation where parameterization
 * isn't possible (table names, column names, constraint definitions).
 * 
 * BEST PRACTICES:
 * - Use parameterized queries for data operations: SELECT * FROM table WHERE id = $1
 * - Use validation + escaping for schema definitions: CREATE TABLE "tablename" (...)
 * - Never use string interpolation for user data in SQL
 */

/**
 * Validates PostgreSQL identifiers (table names, column names, etc.)
 * @param {string} identifier - The identifier to validate
 * @param {string} context - Context for error messages (e.g., 'table name', 'column name')
 * @throws {SecurityError} If identifier is invalid or dangerous
 * @returns {boolean} True if valid
 */
export function validateSQLIdentifier(identifier, context = 'identifier') {
  if (!identifier || typeof identifier !== 'string') {
    throw new SecurityError(`${context} must be a non-empty string`, 'INVALID_IDENTIFIER');
  }
  
  // Length check (PostgreSQL NAMEDATALEN - 1)
  if (identifier.length > 63) {
    throw new SecurityError(`${context} too long (max 63 characters)`, 'IDENTIFIER_TOO_LONG');
  }
  
  // Format validation: must start with letter or underscore, contain only safe characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier)) {
    throw new SecurityError(`${context} contains invalid characters`, 'INVALID_IDENTIFIER_FORMAT');
  }
  
  // Reserved keywords check
  const reservedWords = new Set([
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 
    'GRANT', 'REVOKE', 'UNION', 'WHERE', 'FROM', 'INTO', 'VALUES', 'SET',
    'TABLE', 'DATABASE', 'SCHEMA', 'INDEX', 'VIEW', 'FUNCTION', 'PROCEDURE',
    'TRIGGER', 'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'KEY', 'UNIQUE', 'CHECK',
    'NOT', 'NULL', 'DEFAULT', 'REFERENCES', 'CASCADE', 'RESTRICT', 'ACTION'
  ]);
  
  if (reservedWords.has(identifier.toUpperCase())) {
    throw new SecurityError(`${context} cannot be a reserved keyword: ${identifier}`, 'RESERVED_KEYWORD');
  }
  
  return true;
}

/**
 * Validates PostgreSQL schema names with additional restrictions
 * @param {string} name - The schema name to validate
 * @throws {SecurityError} If schema name is invalid or reserved
 * @returns {boolean} True if valid
 */
export function validateSchemaName(name) {
  validateSQLIdentifier(name, 'schema name');
  
  // Additional schema-specific restrictions
  const lowerName = name.toLowerCase();
  
  // Cannot start with pg_ (reserved for system schemas)
  if (lowerName.startsWith('pg_')) {
    throw new SecurityError('Schema names cannot start with pg_ (reserved prefix)', 'SYSTEM_SCHEMA_PREFIX');
  }
  
  // Cannot be system schema names
  const systemSchemas = new Set(['information_schema', 'pg_catalog', 'pg_temp', 'pg_toast']);
  if (systemSchemas.has(lowerName)) {
    throw new SecurityError(`Cannot use system schema name: ${name}`, 'SYSTEM_SCHEMA_NAME');
  }
  
  return true;
}

/**
 * Validates PostgreSQL data types
 * @param {string} type - The data type to validate
 * @throws {SecurityError} If type is invalid or dangerous
 * @returns {boolean} True if valid
 */
export function validatePostgreSQLType(type) {
  if (!type || typeof type !== 'string') {
    throw new SecurityError('Data type must be a non-empty string', 'INVALID_TYPE');
  }
  
  const normalizedType = type.toLowerCase().trim();
  
  // Check for array notation
  const arrayMatch = normalizedType.match(/^(.*)\[\]$/);
  if (arrayMatch) {
    return validatePostgreSQLType(arrayMatch[1]);
  }
  
  // Base type with optional precision and optional time zone qualifier
  const m = normalizedType.match(/^(\w+(?:\s+\w+)*?)(?:\((?:\d+)(?:\s*,\s*\d+)?\))?(?:\s+(with|without)\s+time\s+zone)?$/);
  const baseCore = m ? m[1] : normalizedType;
  const tzq = m && m[2] ? `${m[2]} time zone` : '';
  const baseType = tzq ? `${baseCore} ${tzq}` : baseCore;
  
  const validTypes = new Set([
    // Numeric types
    'smallint', 'integer', 'bigint', 'decimal', 'numeric', 
    'real', 'double precision', 'smallserial', 'serial', 'bigserial',
    
    // Character types
    'character varying', 'varchar', 'character', 'char', 'text',
    
    // Binary types
    'bytea',
    
    // Date/time types
    'timestamp', 'timestamp with time zone', 'timestamp without time zone',
    'date', 'time', 'time with time zone', 'time without time zone', 'interval',
    
    // Boolean
    'boolean',
    
    // Geometric types
    'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
    
    // Network types
    'cidr', 'inet', 'macaddr', 'macaddr8',
    
    // Bit string types
    'bit', 'bit varying',
    
    // Text search types
    'tsvector', 'tsquery',
    
    // UUID type
    'uuid',
    
    // XML type
    'xml',
    
    // JSON types
    'json', 'jsonb'
  ]);
  
  if (!validTypes.has(baseType)) {
    throw new SecurityError(`Invalid PostgreSQL data type: ${type}`, 'INVALID_DATA_TYPE');
  }
  
  return true;
}

/**
 * Validates CHECK constraint expressions for safety
 * @param {string} expression - The constraint expression to validate
 * @throws {SecurityError} If expression contains dangerous patterns
 * @returns {boolean} True if valid
 */
export function validateConstraintExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    throw new SecurityError('Constraint expression must be a non-empty string', 'INVALID_CONSTRAINT');
  }
  
  // Dangerous patterns that should never appear in constraints
  const dangerousPatterns = [
    { pattern: /DROP\s+/i, name: 'DROP statement' },
    { pattern: /DELETE\s+/i, name: 'DELETE statement' },
    { pattern: /INSERT\s+/i, name: 'INSERT statement' },
    { pattern: /UPDATE\s+SET/i, name: 'UPDATE statement' },
    { pattern: /CREATE\s+/i, name: 'CREATE statement' },
    { pattern: /ALTER\s+/i, name: 'ALTER statement' },
    { pattern: /GRANT\s+/i, name: 'GRANT statement' },
    { pattern: /REVOKE\s+/i, name: 'REVOKE statement' },
    { pattern: /COPY\s+/i, name: 'COPY statement' },
    { pattern: /TRUNCATE\s+/i, name: 'TRUNCATE statement' },
    { pattern: /SELECT\s+/i, name: 'SELECT statement (subquery injection)' },
    { pattern: /--.*$/m, name: 'SQL comment' },
    { pattern: /\/\*.*?\*\//gs, name: 'block comment' },
    { pattern: /;\s*\w+/, name: 'multiple statements' },
    { pattern: /\bEXECUTE\s+/i, name: 'dynamic SQL execution' },
    { pattern: /\bEVAL\s*\(/i, name: 'expression evaluation' }
  ];
  
  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(expression)) {
      throw new SecurityError(`Constraint expression contains dangerous pattern: ${name}`, 'DANGEROUS_CONSTRAINT');
    }
  }
  if (String(expression).includes('\0')) {
    throw new SecurityError('Constraint expression contains dangerous pattern: null byte', 'DANGEROUS_CONSTRAINT');
  }
  
  return true;
}

/**
 * Validates RLS policy expressions for safety
 * @param {string} expression - The RLS expression to validate
 * @throws {SecurityError} If expression contains dangerous patterns
 * @returns {boolean} True if valid
 */
export function validateRLSExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    throw new SecurityError('RLS expression must be a non-empty string', 'INVALID_RLS_EXPRESSION');
  }
  
  // First run general constraint validation
  validateConstraintExpression(expression);
  
  // RLS-specific dangerous patterns (narrowed to avoid false positives)
  // We intentionally DO NOT flag any occurrence of TRUE when used in
  // legitimate comparisons (e.g., approved = TRUE) or as a function
  // default (e.g., COALESCE(is_active, TRUE)). We only detect obvious
  // bypass constructs that make the predicate trivially TRUE.
  const rlsDangerousPatterns = [
    // Classic injection/bypass patterns
    { pattern: /\bor\s*1\s*=\s*1\b/i, name: 'OR 1=1 bypass' },
    // Entire expression is just TRUE/FALSE (optionally wrapped in parentheses) or numeric tautology
    { pattern: /^\s*\(*\s*true\s*\)*\s*$/i, name: 'predicate is always TRUE' },
    { pattern: /^\s*\(*\s*1\s*=\s*1\s*\)*\s*$/i, name: 'predicate is always TRUE (1=1)' },
    { pattern: /^\s*\(*\s*false\s+or\s+true\s*\)*\s*$/i, name: 'boolean tautology (false OR true)' },
    { pattern: /^\s*\(*\s*true\s+or\s+false\s*\)*\s*$/i, name: 'boolean tautology (true OR false)' },
    // DDL or RLS manipulation should never appear inside a USING/USING () clause
    { pattern: /DROP\s+POLICY/i, name: 'policy manipulation' },
    { pattern: /CREATE\s+POLICY/i, name: 'policy creation' },
    { pattern: /ALTER\s+TABLE.*RLS/i, name: 'RLS manipulation' },
    { pattern: /DISABLE\s+ROW\s+LEVEL/i, name: 'RLS disabling' },
    { pattern: /FORCE\s+ROW\s+LEVEL/i, name: 'RLS forcing' }
  ];
  
  for (const { pattern, name } of rlsDangerousPatterns) {
    if (pattern.test(expression)) {
      throw new SecurityError(`RLS expression contains dangerous pattern: ${name}`, 'DANGEROUS_RLS_PATTERN');
    }
  }
  
  return true;
}

/**
 * Escapes PostgreSQL identifiers (table names, column names, etc.)
 * @param {string} identifier - The identifier to escape
 * @returns {string} Properly quoted identifier
 */
export function escapeIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new SecurityError('Identifier must be a non-empty string', 'INVALID_IDENTIFIER');
  }
  
  // PostgreSQL identifier escaping: double quotes and escape internal quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Escapes PostgreSQL string literals
 * @param {*} literal - The literal value to escape
 * @returns {string} Properly escaped literal
 */
export function escapeLiteral(literal) {
  if (literal === null || literal === undefined) {
    return 'NULL';
  }
  
  if (typeof literal === 'number') {
    if (!Number.isFinite(literal)) {
      throw new SecurityError('Cannot escape non-finite number', 'INVALID_NUMBER');
    }
    return literal.toString();
  }
  
  if (typeof literal === 'boolean') {
    return literal.toString();
  }
  
  if (typeof literal === 'string') {
    // PostgreSQL string literal escaping: single quotes and escape internal quotes
    return `'${literal.replace(/'/g, "''")}'`;
  }
  
  throw new SecurityError(`Cannot escape literal of type ${typeof literal}`, 'UNSUPPORTED_LITERAL_TYPE');
}

/**
 * Creates a parameterized query with proper parameter binding
 * @param {string} sql - SQL template with $1, $2, etc. placeholders
 * @param {Array} params - Parameters to bind
 * @returns {Object} Query object with sql and params
 */
export function createParameterizedQuery(sql, params = []) {
  if (!sql || typeof sql !== 'string') {
    throw new SecurityError('SQL must be a non-empty string', 'INVALID_SQL');
  }
  
  if (!Array.isArray(params)) {
    throw new SecurityError('Parameters must be an array', 'INVALID_PARAMS');
  }
  
  // Validate that parameter count matches placeholders
  const placeholderCount = (sql.match(/\$\d+/g) || []).length;
  if (placeholderCount !== params.length) {
    throw new SecurityError(
      `Parameter count mismatch: ${placeholderCount} placeholders, ${params.length} parameters`,
      'PARAMETER_COUNT_MISMATCH'
    );
  }
  
  // Validate that SQL doesn't contain dangerous string interpolation
  if (sql.includes('${') || sql.includes('`')) {
    throw new SecurityError('SQL contains template literal syntax - use parameterized queries', 'TEMPLATE_LITERAL_DETECTED');
  }
  
  return { sql, params };
}

/**
 * Custom error class for security-related errors
 */
export class SecurityError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    // Ensure stack trace points to caller, not this constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SecurityError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}
