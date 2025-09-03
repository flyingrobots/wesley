/**
 * SQL Injection Security Test Suite
 * 
 * MISSION: Detect and prevent SQL injection vulnerabilities across Wesley
 * SCOPE: All SQL-generating functions and execution paths
 * PRIORITY: CRITICAL - Production blocker
 */

import { describe, test, expect } from 'vitest';
import { PostgreSQLGenerator } from '../../src/domain/generators/PostgreSQLGenerator.mjs';
import { RLSPresets } from '../../src/domain/RLSPresets.mjs';
import { TriggerGenerator } from '../../src/domain/generators/TriggerGenerator.mjs';
import { RPCFunctionGeneratorV2 } from '../../src/domain/generators/RPCFunctionGeneratorV2.mjs';
import { PgTAPTestGeneratorV2 } from '../../src/domain/generators/PgTAPTestGeneratorV2.mjs';

describe('🛡️ SQL Injection Security Tests', () => {
  
  describe('PostgreSQL Generator Security', () => {
    test('should sanitize malicious table names', async () => {
      const generator = new PostgreSQLGenerator();
      
      // ATTACK VECTORS
      const maliciousInputs = [
        "users'; DROP TABLE users; --",
        "users\"; INSERT INTO admin VALUES ('hacker'); --",
        "users' UNION SELECT password FROM secrets --",
        "users'; CREATE USER hacker SUPERUSER; --",
        "users\\\"; DELETE FROM * --"
      ];
      
      for (const maliciousName of maliciousInputs) {
        const mockSchema = {
          getTables: () => [{
            name: maliciousName,
            directives: {},
            getFields: () => [{
              name: 'id',
              type: 'ID',
              isPrimaryKey: () => true,
              isVirtual: () => false,
              isUnique: () => false,
              isIndexed: () => false,
              getForeignKeyRef: () => null,
              getDefault: () => null,
              getCheckConstraint: () => null,
              list: false,
              nonNull: true
            }]
          }]
        };
        
        const sql = await generator.generate(mockSchema);
        
        // SECURITY ASSERTIONS
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toContain('DELETE FROM');
        expect(sql).not.toContain('INSERT INTO admin');
        expect(sql).not.toContain('CREATE USER');
        expect(sql).not.toContain('UNION SELECT');
        
        // Should properly quote table names
        expect(sql).toMatch(/"[^"]+"/); // Table names should be quoted
      });
    });
    
    test('should sanitize malicious field names', async () => {
      const generator = new PostgreSQLGenerator();
      
      const maliciousFields = [
        "id'; DROP SCHEMA public CASCADE; --",
        "password\"; GRANT ALL ON ALL TABLES TO PUBLIC; --",
        "email' OR 1=1 --"
      ];
      
      for (const maliciousField of maliciousFields) {
        const mockSchema = {
          getTables: () => [{
            name: 'users',
            directives: {},
            getFields: () => [{
              name: maliciousField,
              type: 'String',
              isPrimaryKey: () => false,
              isVirtual: () => false,
              isUnique: () => false,
              isIndexed: () => false,
              getForeignKeyRef: () => null,
              getDefault: () => null,
              getCheckConstraint: () => null,
              list: false,
              nonNull: true
            }]
          }]
        };
        
        const sql = await generator.generate(mockSchema);
        
        // SECURITY ASSERTIONS
        expect(sql).not.toContain('DROP SCHEMA');
        expect(sql).not.toContain('GRANT ALL');
        expect(sql).not.toContain('OR 1=1');
        
        // Field names should be properly quoted
        expect(sql).toMatch(/"[^"]+"/);
      });
    });
    
    test('should sanitize check constraint expressions', async () => {
      const generator = new PostgreSQLGenerator();
      
      const maliciousExpressions = [
        "age > 0'; DROP TABLE users; --",
        "status IN ('active') OR (SELECT COUNT(*) FROM pg_shadow) > 0 --",
        "price > 0; COPY users TO '/tmp/steal.csv'; --"
      ];
      
      for (const maliciousExpr of maliciousExpressions) {
        const mockSchema = {
          getTables: () => [{
            name: 'products',
            directives: {},
            getFields: () => [{
              name: 'price',
              type: 'Float',
              isPrimaryKey: () => false,
              isVirtual: () => false,
              isUnique: () => false,
              isIndexed: () => false,
              getForeignKeyRef: () => null,
              getDefault: () => null,
              getCheckConstraint: () => maliciousExpr,
              list: false,
              nonNull: true
            }]
          }]
        };
        
        const sql = await generator.generate(mockSchema);
        
        // SECURITY ASSERTIONS
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toContain('pg_shadow');
        expect(sql).not.toContain('COPY');
      });
    });
  });
  
  describe('RLS Presets Security', () => {
    test('should sanitize table names in RLS policies', () => {
      const rlsPresets = new RLSPresets();
      
      const maliciousTables = [
        "users'; DROP POLICY ON users; --",
        "posts\"; CREATE POLICY bypass ON users FOR ALL TO PUBLIC USING (true); --"
      ];
      
      for (const maliciousTable of maliciousTables) {
        expect(() => {
          rlsPresets.generateSQL('owner', maliciousTable, { owner_column: 'user_id' });
        }).not.toThrow();
        
        const sql = rlsPresets.generateSQL('owner', maliciousTable, { owner_column: 'user_id' });
        
        // SECURITY ASSERTIONS
        expect(sql).not.toContain('DROP POLICY');
        expect(sql).not.toContain('USING (true)');
        expect(sql).not.toContain('TO PUBLIC');
      });
    });
    
    test('should validate column names in RLS expressions', () => {
      const rlsPresets = new RLSPresets();
      
      const maliciousColumns = [
        "user_id'; DELETE FROM users; --",
        "owner_id OR true --"
      ];
      
      for (const maliciousColumn of maliciousColumns) {
        const sql = rlsPresets.generateSQL('owner', 'posts', { 
          owner_column: maliciousColumn 
        });
        
        // SECURITY ASSERTIONS
        expect(sql).not.toContain('DELETE FROM');
        expect(sql).not.toContain('OR true');
      });
    });
  });
  
  describe('Trigger Generator Security', () => {
    test('should sanitize trigger function names', () => {
      const generator = new TriggerGenerator();
      
      const maliciousNames = [
        "audit_trigger'; DROP FUNCTION audit_log(); --",
        "update_trigger\"; CREATE OR REPLACE FUNCTION backdoor() RETURNS TRIGGER AS $$ BEGIN RETURN NULL; END; $$ LANGUAGE plpgsql; --"
      ];
      
      for (const maliciousName of maliciousNames) {
        const trigger = {
          name: maliciousName,
          table: 'users',
          events: ['INSERT', 'UPDATE'],
          function: 'audit_changes'
        };
        
        const sql = generator.generateTrigger(trigger);
        
        // SECURITY ASSERTIONS  
        expect(sql).not.toContain('DROP FUNCTION');
        expect(sql).not.toContain('CREATE OR REPLACE FUNCTION backdoor');
        expect(sql).not.toContain('RETURN NULL');
      });
    });
  });
  
  describe('RPC Function Generator Security', () => {
    test('should sanitize function parameters', () => {
      const generator = new RPCFunctionGeneratorV2();
      
      const maliciousParams = [
        { name: "user_id'; DROP TABLE users; --", type: 'uuid' },
        { name: "email\"; GRANT SUPERUSER TO current_user; --", type: 'text' }
      ];
      
      for (const maliciousParam of maliciousParams) {
        const mockFunction = {
          name: 'get_user',
          parameters: [maliciousParam],
          returnType: 'users',
          body: 'SELECT * FROM users WHERE id = user_id'
        };
        
        const sql = generator.generateFunction(mockFunction);
        
        // SECURITY ASSERTIONS
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toContain('GRANT SUPERUSER');
      });
    });
  });
  
  describe('pgTAP Test Generator Security', () => {
    test('should sanitize test data', () => {
      const generator = new PgTAPTestGeneratorV2();
      
      const maliciousTestData = {
        table: "users'; DROP TABLE IF EXISTS users CASCADE; --",
        field: "email\"; DELETE FROM users; --"
      };
      
      const tests = generator.generateConstraintTests(maliciousTestData);
      
      // SECURITY ASSERTIONS
      expect(tests).not.toContain('DROP TABLE');
      expect(tests).not.toContain('DELETE FROM');
      expect(tests).not.toContain('CASCADE');
    });
  });
  
  describe('Input Validation Edge Cases', () => {
    test('should handle null bytes and special characters', async () => {
      const generator = new PostgreSQLGenerator();
      
      const edgeCases = [
        "table\x00name",     // Null byte
        "table\r\nname",     // CRLF injection
        "table\tname",       // Tab injection
        "table\\name",       // Backslash injection
        "table'name",        // Single quote
        'table"name',        // Double quote
        "table;name",        // Semicolon
        "table/*comment*/name" // Comment injection
      ];
      
      for (const edgeCase of edgeCases) {
        const mockSchema = {
          getTables: () => [{
            name: edgeCase,
            directives: {},
            getFields: () => []
          }]
        };
        
        const sql = await generator.generate(mockSchema);
        
        // Should handle edge cases gracefully
        expect(sql).toBeDefined();
        expect(typeof sql).toBe('string');
      });
    });
    
    test('should prevent second-order SQL injection', async () => {
      const generator = new PostgreSQLGenerator();
      
      // Data that looks safe but becomes dangerous when processed
      const secondOrderPayloads = [
        "safe_table_name_with_encoded_%27%3b_DROP_TABLE_users%3b--",
        "normal_name_but_then_\\'; DROP SCHEMA public; --"
      ];
      
      for (const payload of secondOrderPayloads) {
        const mockSchema = {
          getTables: () => [{
            name: payload,
            directives: {},
            getFields: () => []
          }]
        };
        
        const sql = await generator.generate(mockSchema);
        
        // Should not contain decoded malicious content
        expect(sql).not.toContain('DROP TABLE');
        expect(sql).not.toContain('DROP SCHEMA');
      });
    });
  });
  
  describe('Error Message Information Leakage', () => {
    test('should not leak sensitive information in error messages', async () => {
      const generator = new PostgreSQLGenerator();
      
      try {
        // Force an error condition
        const mockSchema = null;
        await generator.generate(mockSchema);
      } catch (error) {
        const errorMessage = error.message.toLowerCase();
        
        // Should not leak sensitive system information
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('secret');
        expect(errorMessage).not.toContain('token');
        expect(errorMessage).not.toContain('api_key');
        expect(errorMessage).not.toContain('/home/');
        expect(errorMessage).not.toContain('c:\\');
        expect(errorMessage).not.toContain('database_url');
      }
    });
  });
});