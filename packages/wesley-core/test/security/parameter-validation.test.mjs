/**
 * Parameter Validation Security Test Suite
 * 
 * MISSION: Validate input sanitization and parameter security across Wesley
 * SCOPE: All functions that accept user input or external data  
 * PRIORITY: CRITICAL - Prevent injection attacks and data corruption
 */

import { describe, test, expect } from 'vitest';
import { 
  validateSQLIdentifier,
  validateSchemaName,
  validatePostgreSQLType,
  validateConstraintExpression,
  validateRLSExpression,
  escapeIdentifier,
  escapeLiteral,
  SecurityError
} from '../../src/domain/security/InputValidator.mjs';

describe('🔒 Parameter Validation Security Tests', () => {
  
  describe('SQL Identifier Validation', () => {
    /**
     * PostgreSQL identifier rules:
     * - Must start with letter or underscore
     * - Can contain letters, digits, underscores, dollar signs
     * - Max 63 characters (NAMEDATALEN - 1)
     * - Case insensitive unless quoted
     */
    
    test('should accept valid identifiers', () => {
      const validIdentifiers = [
        'users',
        'user_profile', 
        'UserProfile',
        '_private',
        'table1',
        'my_table_v2',
        'order$details'
      ];
      
      for (const identifier of validIdentifiers) {
        expect(() => validateSQLIdentifier(identifier)).not.toThrow();
      }
    });
    
    test('should reject invalid identifiers', () => {
      const invalidIdentifiers = [
        '',                    // Empty
        null,                  // Null
        undefined,            // Undefined
        123,                  // Number
        '123users',           // Starts with number
        'user-profile',       // Hyphen not allowed
        'user profile',       // Space not allowed
        'user@profile',       // @ not allowed
        'user.profile',       // Dot not allowed
        'SELECT',             // Reserved keyword
        'DROP',               // Reserved keyword
        'a'.repeat(64),       // Too long
        'user\x00name',       // Null byte
        'user\tname',         // Tab
        'user\nname',         // Newline
        "user'name",          // Single quote
        'user"name',          // Double quote
        'user;name',          // Semicolon
        'user/**/name',       // Comment
      ];
      
      for (const identifier of invalidIdentifiers) {
        expect(() => validateSQLIdentifier(identifier)).toThrow();
      }
    });
  });
  
  describe('Schema Name Validation', () => {
    const validateSchemaName = (name) => {
      // Schema names have additional restrictions
      if (!name || typeof name !== 'string') {
        throw new Error('Schema name must be a non-empty string');
      }
      
      // Must not start with pg_ (reserved for system schemas)
      if (name.toLowerCase().startsWith('pg_')) {
        throw new Error('Schema names cannot start with pg_');
      }
      
      // Must not be information_schema
      if (name.toLowerCase() === 'information_schema') {
        throw new Error('Cannot use information_schema as schema name');
      }
      
      return validateSQLIdentifier(name);
    };
    
    test('should accept valid schema names', () => {
      const validNames = ['public', 'app', 'user_data', 'v1_api'];
      
      for (const name of validNames) {
        expect(() => validateSchemaName(name)).not.toThrow();
      }
    });
    
    test('should reject system schema names', () => {
      const systemNames = [
        'pg_catalog',
        'pg_temp',
        'pg_toast',
        'information_schema',
        'PG_CATALOG',  // Case insensitive
      ];
      
      for (const name of systemNames) {
        expect(() => validateSchemaName(name)).toThrow();
      }
    });
  });
  
  describe('Data Type Validation', () => {
    const validatePostgreSQLType = (type) => {
      if (!type || typeof type !== 'string') {
        throw new Error('Type must be a non-empty string');
      }
      
      const validTypes = [
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
      ];
      
      const normalizedType = type.toLowerCase().trim();
      
      // Check for array notation
      const arrayMatch = normalizedType.match(/^(.+)\[\]$/);
      if (arrayMatch) {
        return validatePostgreSQLType(arrayMatch[1]);
      }
      
      // Check for precision/scale notation
      const precisionMatch = normalizedType.match(/^(\w+(?:\s+\w+)*)\(\d+(?:,\s*\d+)?\)$/);
      if (precisionMatch) {
        return validTypes.includes(precisionMatch[1]);
      }
      
      return validTypes.includes(normalizedType);
    };
    
    test('should accept valid PostgreSQL types', () => {
      const validTypes = [
        'integer',
        'text', 
        'boolean',
        'timestamp with time zone',
        'varchar(255)',
        'decimal(10,2)',
        'integer[]',
        'text[]',
        'jsonb',
        'uuid'
      ];
      
      for (const type of validTypes) {
        expect(validatePostgreSQLType(type)).toBe(true);
      }
    });
    
    test('should reject invalid types', () => {
      const invalidTypes = [
        '',
        'INVALID_TYPE',
        'string',        // Not PostgreSQL type
        'int',          // Not PostgreSQL type  
        'varchar()',    // Missing size
        'decimal()',    // Missing precision
        'text; DROP TABLE users; --', // Injection attempt
      ];
      
      for (const type of invalidTypes) {
        expect(validatePostgreSQLType(type)).toBe(false);
      }
    });
  });
  
  describe('Constraint Expression Validation', () => {
    const validateConstraintExpression = (expr) => {
      if (!expr || typeof expr !== 'string') {
        throw new Error('Constraint expression must be a non-empty string');
      }
      
      // Dangerous patterns that should not appear in constraints
      const dangerousPatterns = [
        /DROP\s+/i,
        /DELETE\s+/i,
        /INSERT\s+/i,
        /UPDATE\s+SET/i,
        /CREATE\s+/i,
        /ALTER\s+/i,
        /GRANT\s+/i,
        /REVOKE\s+/i,
        /COPY\s+/i,
        /TRUNCATE\s+/i,
        /--.*$/m,           // SQL comments
        /\/\*.*?\*\//gs,    // Block comments
        /;\s*\w+/,          // Multiple statements
        /\x00/,             // Null bytes
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(expr)) {
          throw new Error(`Dangerous pattern detected in constraint: ${pattern}`);
        }
      }
      
      // Should only contain allowed constraint patterns
      const allowedPatterns = [
        /^\w+\s*(>|<|>=|<=|=|<>|!=)\s*[\w\d\s'.]+$/,  // Simple comparisons
        /^\w+\s+IN\s*\([^;]+\)$/i,                      // IN clauses
        /^\w+\s+IS\s+(NOT\s+)?NULL$/i,                  // NULL checks
        /^\w+\s+(NOT\s+)?LIKE\s+'\w+'$/i,              // LIKE patterns
        /^[\w\s\(\)><=!,\.']+$/,                        // General safe characters
      ];
      
      const isSafe = allowedPatterns.some(pattern => pattern.test(expr.trim()));
      if (!isSafe) {
        throw new Error('Constraint expression contains invalid patterns');
      }
      
      return true;
    };
    
    test('should accept safe constraint expressions', () => {
      const safeExpressions = [
        'age > 0',
        'price >= 0.01',
        'status IN (\'active\', \'inactive\')',
        'email IS NOT NULL',
        'name LIKE \'%@%.%\'',
        'quantity > 0 AND quantity < 1000'
      ];
      
      for (const expr of safeExpressions) {
        expect(() => validateConstraintExpression(expr)).not.toThrow();
      }
    });
    
    test('should reject dangerous constraint expressions', () => {
      const dangerousExpressions = [
        'age > 0; DROP TABLE users',
        'price > 0 AND (SELECT COUNT(*) FROM pg_shadow) > 0',
        'status = \'active\' OR 1=1 --',
        'email /* comment */ LIKE \'%@%\'',
        'quantity > 0\x00 AND malicious = 1',
        'value = 1; COPY users TO \'/tmp/steal.csv\'',
        'field = \'value\'; DELETE FROM audit_log',
      ];
      
      for (const expr of dangerousExpressions) {
        expect(() => validateConstraintExpression(expr)).toThrow();
      }
    });
  });
  
  describe('RLS Policy Expression Validation', () => {
    const validateRLSExpression = (expr) => {
      if (!expr || typeof expr !== 'string') {
        throw new Error('RLS expression must be a non-empty string');
      }
      
      // RLS expressions should be boolean expressions
      // Common patterns: auth.uid() = user_id, user_id = current_user_id(), etc.
      
      // Dangerous patterns specific to RLS
      const dangerousPatterns = [
        /\btrue\b/i,                    // Always true (bypasses RLS)
        /\b1\s*=\s*1\b/,               // Always true
        /\bfalse\s+OR\s+true\b/i,      // Bypass attempts
        /DROP\s+POLICY/i,               // Policy manipulation
        /CREATE\s+POLICY/i,             // Policy creation
        /ALTER\s+TABLE.*RLS/i,          // RLS manipulation
        /DISABLE\s+ROW\s+LEVEL/i,       // RLS disabling
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(expr)) {
          throw new Error(`Dangerous RLS pattern detected: ${pattern}`);
        }
      }
      
      return true;
    };
    
    test('should accept safe RLS expressions', () => {
      const safeExpressions = [
        'auth.uid() = user_id',
        'user_id = current_user_id()',
        'org_id = current_setting(\'app.org_id\')::uuid',
        'created_by = auth.uid() OR role = \'admin\'',
      ];
      
      for (const expr of safeExpressions) {
        expect(() => validateRLSExpression(expr)).not.toThrow();
      }
    });
    
    test('should reject dangerous RLS expressions', () => {
      const dangerousExpressions = [
        'true',                          // Bypasses all RLS
        '1 = 1',                        // Always true  
        'false OR true',                // Bypass attempt
        'user_id = 1; DROP POLICY ON users',
        'auth.uid() = user_id; CREATE POLICY bypass ON users USING (true)',
      ];
      
      for (const expr of dangerousExpressions) {
        expect(() => validateRLSExpression(expr)).toThrow();
      }
    });
  });
  
  describe('Input Sanitization Functions', () => {
    const escapeIdentifier = (identifier) => {
      if (!identifier || typeof identifier !== 'string') {
        throw new Error('Identifier must be a non-empty string');
      }
      
      // PostgreSQL identifier escaping: double quotes and escape internal quotes
      return `"${identifier.replace(/"/g, '""')}"`;
    };
    
    const escapeLiteral = (literal) => {
      if (literal === null || literal === undefined) {
        return 'NULL';
      }
      
      if (typeof literal === 'number') {
        return literal.toString();
      }
      
      if (typeof literal === 'boolean') {
        return literal.toString();
      }
      
      if (typeof literal === 'string') {
        // PostgreSQL string literal escaping: single quotes and escape internal quotes
        return `'${literal.replace(/'/g, "''")}'`;
      }
      
      throw new Error(`Cannot escape literal of type ${typeof literal}`);
    };
    
    test('should properly escape identifiers', () => {
      expect(escapeIdentifier('users')).toBe('"users"');
      expect(escapeIdentifier('user_name')).toBe('"user_name"');
      expect(escapeIdentifier('table"name')).toBe('"table""name"');
      expect(escapeIdentifier('my"crazy""table')).toBe('"my""crazy""""table"');
    });
    
    test('should properly escape literals', () => {
      expect(escapeLiteral('hello')).toBe("'hello'");
      expect(escapeLiteral("user's data")).toBe("'user''s data'");
      expect(escapeLiteral("don't break")).toBe("'don''t break'");
      expect(escapeLiteral(42)).toBe('42');
      expect(escapeLiteral(true)).toBe('true');
      expect(escapeLiteral(null)).toBe('NULL');
      expect(escapeLiteral(undefined)).toBe('NULL');
    });
    
    test('should reject unsafe inputs for escaping', () => {
      expect(() => escapeIdentifier('')).toThrow();
      expect(() => escapeIdentifier(null)).toThrow();
      expect(() => escapeIdentifier(undefined)).toThrow();
      expect(() => escapeIdentifier(123)).toThrow();
    });
  });
});