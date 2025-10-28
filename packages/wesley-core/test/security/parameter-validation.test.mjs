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
        expect(() => validateSQLIdentifier(identifier)).not.toThrow(SecurityError);
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
        expect(() => validateSQLIdentifier(identifier)).toThrow(SecurityError);
      }
    });
  });
  
  describe('Schema Name Validation', () => {

    test('should accept valid schema names', () => {
      const validNames = ['public', 'app', 'user_data', 'v1_api'];
      
      for (const name of validNames) {
        expect(() => validateSchemaName(name)).not.toThrow(SecurityError);
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
        expect(() => validateSchemaName(name)).toThrow(SecurityError);
      }
    });
  });
  
  describe('Data Type Validation', () => {
    
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
        expect(() => validatePostgreSQLType(type)).toThrow(SecurityError);
      }
    });
  });
  
  describe('Constraint Expression Validation', () => {
    
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
        expect(() => validateConstraintExpression(expr)).not.toThrow(SecurityError);
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
        expect(() => validateConstraintExpression(expr)).toThrow(SecurityError);
      }
    });
  });
  
  describe('RLS Policy Expression Validation', () => {
    
    test('should accept safe RLS expressions', () => {
      const safeExpressions = [
        'auth.uid() = user_id',
        'user_id = current_user_id()',
        'org_id = current_setting(\'app.org_id\')::uuid',
        'created_by = auth.uid() OR role = \'admin\'',
      ];
      
      for (const expr of safeExpressions) {
        expect(() => validateRLSExpression(expr)).not.toThrow(SecurityError);
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
        expect(() => validateRLSExpression(expr)).toThrow(SecurityError);
      }
    });
  });
  
  describe('Input Sanitization Functions', () => {
    
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
      expect(() => escapeIdentifier('')).toThrow(SecurityError);
      expect(() => escapeIdentifier(null)).toThrow(SecurityError);
      expect(() => escapeIdentifier(undefined)).toThrow(SecurityError);
      expect(() => escapeIdentifier(123)).toThrow(SecurityError);
    });
  });
});