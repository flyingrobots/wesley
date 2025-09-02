/**
 * Database Test Helpers
 * Utilities for setting up test databases and connections
 */

import { createHash } from 'node:crypto';

/**
 * Test database connection configuration
 */
export const testDatabaseConfig = {
  // Use a test-specific database URL or in-memory DB
  url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/wesley_test',
  
  // Connection pool settings for tests
  pool: {
    min: 1,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000
  },
  
  // Test-specific settings
  schema: 'test_schema',
  isolationLevel: 'READ_COMMITTED',
  autoRollback: true // Automatically rollback transactions in tests
};

/**
 * Creates an isolated test schema for each test
 * @param {string} testName - Name of the test for schema isolation
 * @returns {string} Unique schema name
 */
export function createTestSchema(testName) {
  const hash = createHash('md5')
    .update(testName + Date.now() + Math.random())
    .digest('hex')
    .substring(0, 8);
  
  return `test_${hash}`;
}

/**
 * SQL utilities for test setup/teardown
 */
export const testSQL = {
  /**
   * Creates a test schema
   */
  createSchema: (schemaName) => `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
  
  /**
   * Drops a test schema
   */
  dropSchema: (schemaName) => `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
  
  /**
   * Sets search path for test isolation
   */
  setSearchPath: (schemaName) => `SET search_path TO "${schemaName}", public`,
  
  /**
   * Enables RLS for testing
   */
  enableRLS: (tableName) => `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY`,
  
  /**
   * Creates a test role
   */
  createRole: (roleName) => `CREATE ROLE "${roleName}" NOINHERIT`,
  
  /**
   * Drops a test role
   */
  dropRole: (roleName) => `DROP ROLE IF EXISTS "${roleName}"`
};

/**
 * Mock database connection for unit tests
 * Implements the same interface as real database connections
 */
export class MockDatabase {
  constructor() {
    this.queries = [];
    this.results = new Map();
    this.transactionDepth = 0;
    this.shouldError = false;
    this.errorMessage = 'Mock database error';
  }
  
  /**
   * Mock query execution
   */
  async query(sql, params = []) {
    this.queries.push({ sql, params, timestamp: new Date() });
    
    if (this.shouldError) {
      throw new Error(this.errorMessage);
    }
    
    // Return pre-configured result or empty result
    const key = this.normalizeSQL(sql);
    return this.results.get(key) || { rows: [], rowCount: 0 };
  }
  
  /**
   * Mock transaction begin
   */
  async begin() {
    this.transactionDepth++;
    await this.query('BEGIN');
  }
  
  /**
   * Mock transaction commit
   */
  async commit() {
    if (this.transactionDepth > 0) {
      this.transactionDepth--;
      await this.query('COMMIT');
    }
  }
  
  /**
   * Mock transaction rollback
   */
  async rollback() {
    if (this.transactionDepth > 0) {
      this.transactionDepth--;
      await this.query('ROLLBACK');
    }
  }
  
  /**
   * Configure mock to return specific result for a query
   */
  mockResult(sql, result) {
    const key = this.normalizeSQL(sql);
    this.results.set(key, result);
  }
  
  /**
   * Configure mock to throw error on next query
   */
  mockError(message = 'Mock database error') {
    this.shouldError = true;
    this.errorMessage = message;
  }
  
  /**
   * Reset mock state
   */
  reset() {
    this.queries = [];
    this.results.clear();
    this.transactionDepth = 0;
    this.shouldError = false;
  }
  
  /**
   * Get all executed queries
   */
  getQueries() {
    return [...this.queries];
  }
  
  /**
   * Get queries matching pattern
   */
  getQueriesMatching(pattern) {
    return this.queries.filter(q => pattern.test(q.sql));
  }
  
  /**
   * Normalize SQL for consistent matching
   */
  normalizeSQL(sql) {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase();
  }
}

/**
 * Test fixtures for common schema patterns
 */
export const testFixtures = {
  /**
   * Simple user table schema
   */
  userTable: {
    name: 'users',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'email', type: 'text', unique: true, nonNull: true },
      { name: 'name', type: 'text', nonNull: true },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
      { name: 'updated_at', type: 'timestamptz', default: 'now()' }
    ],
    policies: [
      { name: 'users_select', operation: 'SELECT', using: 'auth.uid() = id' },
      { name: 'users_insert', operation: 'INSERT', check: 'auth.uid() = id' }
    ]
  },
  
  /**
   * Multi-tenant organization table
   */
  orgTable: {
    name: 'organizations',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'name', type: 'text', nonNull: true },
      { name: 'owner_id', type: 'uuid', nonNull: true },
      { name: 'created_at', type: 'timestamptz', default: 'now()' }
    ],
    foreignKeys: [
      { columns: ['owner_id'], references: { table: 'users', columns: ['id'] } }
    ],
    policies: [
      { name: 'org_owner_all', operation: 'ALL', using: 'owner_id = auth.uid()' }
    ]
  },
  
  /**
   * Complex table with various field types
   */
  complexTable: {
    name: 'products',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'name', type: 'text', nonNull: true },
      { name: 'price', type: 'decimal(10,2)', nonNull: true },
      { name: 'tags', type: 'text[]', default: '{}' },
      { name: 'metadata', type: 'jsonb', default: '{}' },
      { name: 'status', type: 'text', nonNull: true, default: "'draft'" },
      { name: 'published_at', type: 'timestamptz' },
      { name: 'org_id', type: 'uuid', nonNull: true }
    ],
    indexes: [
      { columns: ['name'] },
      { columns: ['org_id', 'status'] },
      { columns: ['published_at'], where: 'published_at IS NOT NULL' }
    ],
    constraints: [
      { type: 'check', name: 'price_positive', expression: 'price > 0' },
      { type: 'check', name: 'valid_status', expression: "status IN ('draft', 'published', 'archived')" }
    ]
  }
};

/**
 * Assertion helpers for database testing
 */
export const dbAssert = {
  /**
   * Assert that a table exists in the schema
   */
  async tableExists(db, tableName, schemaName = 'public') {
    const result = await db.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = $2
    `, [schemaName, tableName]);
    
    if (result.rows.length === 0) {
      throw new Error(`Table ${schemaName}.${tableName} does not exist`);
    }
  },
  
  /**
   * Assert that a column exists with expected properties
   */
  async columnExists(db, tableName, columnName, expectedType, schemaName = 'public') {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
    `, [schemaName, tableName, columnName]);
    
    if (result.rows.length === 0) {
      throw new Error(`Column ${tableName}.${columnName} does not exist`);
    }
    
    if (expectedType && !result.rows[0].data_type.includes(expectedType)) {
      throw new Error(
        `Column ${tableName}.${columnName} has type ${result.rows[0].data_type}, expected ${expectedType}`
      );
    }
  },
  
  /**
   * Assert that an index exists
   */
  async indexExists(db, indexName, schemaName = 'public') {
    const result = await db.query(`
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = $1 AND indexname = $2
    `, [schemaName, indexName]);
    
    if (result.rows.length === 0) {
      throw new Error(`Index ${indexName} does not exist in schema ${schemaName}`);
    }
  },
  
  /**
   * Assert that a policy exists
   */
  async policyExists(db, tableName, policyName, schemaName = 'public') {
    const result = await db.query(`
      SELECT 1 FROM pg_policies 
      WHERE schemaname = $1 AND tablename = $2 AND policyname = $3
    `, [schemaName, tableName, policyName]);
    
    if (result.rows.length === 0) {
      throw new Error(`Policy ${policyName} does not exist on table ${schemaName}.${tableName}`);
    }
  }
};