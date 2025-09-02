/**
 * Tests for MigrationExplainer domain component
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';

import { 
  MigrationExplainer,
  MigrationOperation,
  MigrationAnalysisSummary,
  PostgreSQLLockLevels,
  MigrationAnalysisStarted,
  MigrationAnalysisCompleted
} from '../src/domain/explainer/MigrationExplainer.mjs';

describe('MigrationOperation', () => {
  test('should determine operation type from SQL', () => {
    const testCases = [
      { sql: 'CREATE TABLE users (id INT);', expected: 'CREATE_TABLE' },
      { sql: 'DROP TABLE old_table;', expected: 'DROP_TABLE' },
      { sql: 'ALTER TABLE users ADD COLUMN email TEXT;', expected: 'ADD_COLUMN' },
      { sql: 'ALTER TABLE users DROP COLUMN name;', expected: 'DROP_COLUMN' },
      { sql: 'ALTER TABLE users ALTER COLUMN age TYPE BIGINT;', expected: 'ALTER_COLUMN' },
      { sql: 'CREATE INDEX CONCURRENTLY idx_email ON users (email);', expected: 'CREATE_INDEX_CONCURRENT' },
      { sql: 'CREATE INDEX idx_name ON users (name);', expected: 'CREATE_INDEX' },
      { sql: 'INSERT INTO users VALUES (1, \'test\');', expected: 'INSERT' },
      { sql: 'UPDATE users SET name = \'updated\';', expected: 'UPDATE' },
      { sql: 'DELETE FROM users WHERE id = 1;', expected: 'DELETE' }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new MigrationOperation(sql);
      assert.strictEqual(operation.operationType, expected, `Failed for SQL: ${sql}`);
    });
  });

  test('should extract affected tables', () => {
    const testCases = [
      { 
        sql: 'CREATE TABLE users (id INT);', 
        expected: ['users'] 
      },
      { 
        sql: 'ALTER TABLE public.orders ADD COLUMN total DECIMAL;', 
        expected: ['orders'] 
      },
      { 
        sql: 'INSERT INTO products SELECT * FROM temp_products;', 
        expected: ['products', 'temp_products'] 
      },
      { 
        sql: 'UPDATE users SET email = (SELECT email FROM profiles WHERE profiles.user_id = users.id);', 
        expected: ['users', 'profiles'] 
      }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new MigrationOperation(sql);
      expected.forEach(table => {
        assert.ok(operation.affectedTables.includes(table), 
          `Table '${table}' not found in ${operation.affectedTables} for SQL: ${sql}`);
      });
    });
  });

  test('should determine lock levels correctly', () => {
    const testCases = [
      { 
        sql: 'CREATE TABLE users (id INT);', 
        expected: PostgreSQLLockLevels.SHARE_UPDATE_EXCLUSIVE 
      },
      { 
        sql: 'DROP TABLE users;', 
        expected: PostgreSQLLockLevels.ACCESS_EXCLUSIVE 
      },
      { 
        sql: 'ALTER TABLE users ADD COLUMN email TEXT;', 
        expected: PostgreSQLLockLevels.SHARE_ROW_EXCLUSIVE 
      },
      { 
        sql: 'ALTER TABLE users ADD COLUMN age INT NOT NULL DEFAULT 0;', 
        expected: PostgreSQLLockLevels.ACCESS_EXCLUSIVE 
      },
      { 
        sql: 'CREATE INDEX CONCURRENTLY idx_email ON users (email);', 
        expected: PostgreSQLLockLevels.SHARE_UPDATE_EXCLUSIVE 
      },
      { 
        sql: 'CREATE INDEX idx_name ON users (name);', 
        expected: PostgreSQLLockLevels.SHARE 
      },
      { 
        sql: 'INSERT INTO users VALUES (1);', 
        expected: PostgreSQLLockLevels.ROW_EXCLUSIVE 
      }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new MigrationOperation(sql);
      assert.strictEqual(operation.lockLevel, expected, 
        `Wrong lock level for SQL: ${sql}`);
    });
  });

  test('should calculate risk levels', () => {
    const testCases = [
      { sql: 'DROP TABLE users;', expected: 'CRITICAL' },
      { sql: 'ALTER TABLE users ALTER COLUMN id TYPE BIGINT;', expected: 'CRITICAL' },
      { sql: 'REINDEX INDEX idx_users_email;', expected: 'CRITICAL' },
      { sql: 'CREATE INDEX idx_email ON users (email);', expected: 'HIGH' },
      { sql: 'ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT \'\';', expected: 'HIGH' },
      { sql: 'ALTER TABLE users ADD CONSTRAINT fk_user_org FOREIGN KEY (org_id) REFERENCES orgs(id);', expected: 'HIGH' },
      { sql: 'ALTER TABLE users ADD COLUMN phone TEXT;', expected: 'MEDIUM' },
      { sql: 'CREATE INDEX CONCURRENTLY idx_phone ON users (phone);', expected: 'MEDIUM' },
      { sql: 'INSERT INTO users VALUES (1);', expected: 'LOW' },
      { sql: 'SELECT * FROM users;', expected: 'LOW' }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new MigrationOperation(sql);
      assert.strictEqual(operation.riskLevel, expected, 
        `Wrong risk level for SQL: ${sql}`);
    });
  });

  test('should estimate durations based on operation type', () => {
    const createTable = new MigrationOperation('CREATE TABLE users (id INT);');
    const dropColumn = new MigrationOperation('ALTER TABLE users DROP COLUMN name;');
    const createIndex = new MigrationOperation('CREATE INDEX idx_email ON users (email);');
    const createConcurrentIndex = new MigrationOperation('CREATE INDEX CONCURRENTLY idx_phone ON users (phone);');
    
    assert.ok(createTable.estimatedDurationMs < dropColumn.estimatedDurationMs);
    assert.ok(createIndex.estimatedDurationMs < createConcurrentIndex.estimatedDurationMs);
    assert.ok(dropColumn.estimatedDurationMs > createTable.estimatedDurationMs);
  });

  test('should adjust duration estimates for table size', () => {
    const smallTableOp = new MigrationOperation('CREATE INDEX idx_email ON users (email);', {
      estimatedRows: 1000
    });
    
    const largeTableOp = new MigrationOperation('CREATE INDEX idx_email ON users (email);', {
      estimatedRows: 10000000
    });
    
    assert.ok(largeTableOp.estimatedDurationMs > smallTableOp.estimatedDurationMs);
  });

  test('should provide human-readable explanations', () => {
    const operation = new MigrationOperation('ALTER TABLE users DROP COLUMN deprecated_field;');
    const explanation = operation.getExplanation();
    
    assert.strictEqual(explanation.operation, 'drop column');
    assert.ok(explanation.tables.includes('users'));
    assert.strictEqual(explanation.lockLevel, 'ACCESS EXCLUSIVE');
    assert.strictEqual(explanation.blocksReads, true);
    assert.strictEqual(explanation.blocksWrites, true);
    assert.strictEqual(explanation.riskLevel, 'CRITICAL');
    assert.ok(explanation.impact.includes('BLOCKS ALL ACCESS'));
  });

  test('should format durations correctly', () => {
    const operation = new MigrationOperation('SELECT 1;');
    
    assert.strictEqual(operation.formatDuration(500), '500ms');
    assert.strictEqual(operation.formatDuration(1500), '1.5s');
    assert.strictEqual(operation.formatDuration(65000), '1.1m');
    assert.strictEqual(operation.formatDuration(3700000), '1.0h');
  });
});

describe('MigrationAnalysisSummary', () => {
  test('should calculate risk distribution', () => {
    const operations = [
      new MigrationOperation('DROP TABLE old_users;'), // CRITICAL
      new MigrationOperation('CREATE INDEX idx_email ON users (email);'), // HIGH
      new MigrationOperation('ALTER TABLE users ADD COLUMN phone TEXT;'), // MEDIUM
      new MigrationOperation('INSERT INTO users VALUES (1);'), // LOW
      new MigrationOperation('CREATE INDEX idx_name ON users (name);') // HIGH
    ];
    
    const summary = new MigrationAnalysisSummary(operations);
    
    assert.strictEqual(summary.riskDistribution.CRITICAL, 1);
    assert.strictEqual(summary.riskDistribution.HIGH, 2);
    assert.strictEqual(summary.riskDistribution.MEDIUM, 1);
    assert.strictEqual(summary.riskDistribution.LOW, 1);
  });

  test('should identify affected tables', () => {
    const operations = [
      new MigrationOperation('CREATE TABLE users (id INT);'),
      new MigrationOperation('ALTER TABLE profiles ADD COLUMN bio TEXT;'),
      new MigrationOperation('INSERT INTO users VALUES (1);'),
      new MigrationOperation('UPDATE profiles SET bio = \'\';')
    ];
    
    const summary = new MigrationAnalysisSummary(operations);
    
    assert.strictEqual(summary.affectedTables.length, 2);
    assert.ok(summary.affectedTables.includes('users'));
    assert.ok(summary.affectedTables.includes('profiles'));
  });

  test('should identify blocking operations', () => {
    const operations = [
      new MigrationOperation('INSERT INTO users VALUES (1);'), // Non-blocking
      new MigrationOperation('CREATE INDEX idx_email ON users (email);'), // Blocks writes
      new MigrationOperation('DROP TABLE old_data;'), // Blocks everything
      new MigrationOperation('SELECT * FROM users;') // Non-blocking
    ];
    
    const summary = new MigrationAnalysisSummary(operations);
    
    assert.strictEqual(summary.blockingOperations.length, 2);
    assert.ok(summary.blockingOperations.some(op => op.operationType === 'CREATE_INDEX'));
    assert.ok(summary.blockingOperations.some(op => op.operationType === 'DROP_TABLE'));
  });

  test('should calculate overall risk score', () => {
    const lowRiskOps = [
      new MigrationOperation('INSERT INTO users VALUES (1);'),
      new MigrationOperation('SELECT * FROM users;')
    ];
    const lowSummary = new MigrationAnalysisSummary(lowRiskOps);
    assert.strictEqual(lowSummary.overallRiskScore, 'LOW');
    
    const highRiskOps = [
      new MigrationOperation('DROP TABLE old_users;'),
      new MigrationOperation('REINDEX INDEX idx_users_email;')
    ];
    const highSummary = new MigrationAnalysisSummary(highRiskOps);
    assert.strictEqual(highSummary.overallRiskScore, 'CRITICAL');
  });

  test('should generate appropriate recommendations', () => {
    const operations = [
      new MigrationOperation('CREATE INDEX idx_email ON users (email);'), // Should suggest CONCURRENTLY
      new MigrationOperation('ALTER TABLE users ADD CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES orgs(id);'), // Should suggest NOT VALID
      new MigrationOperation('DROP TABLE huge_table;', { estimatedRows: 10000000 }) // Should suggest maintenance window
    ];
    
    const summary = new MigrationAnalysisSummary(operations);
    
    assert.ok(summary.recommendations.length > 0);
    
    const concurrencyRec = summary.recommendations.find(r => r.type === 'CONCURRENCY');
    assert.ok(concurrencyRec);
    assert.ok(concurrencyRec.message.includes('CREATE INDEX CONCURRENTLY'));
    
    const validationRec = summary.recommendations.find(r => r.type === 'VALIDATION');
    assert.ok(validationRec);
    assert.ok(validationRec.message.includes('NOT VALID'));
    
    const schedulingRec = summary.recommendations.find(r => r.type === 'SCHEDULING');
    assert.ok(schedulingRec);
    assert.ok(schedulingRec.message.includes('maintenance window'));
  });

  test('should calculate total duration', () => {
    const operations = [
      new MigrationOperation('CREATE TABLE users (id INT);'), // ~100ms
      new MigrationOperation('CREATE INDEX idx_email ON users (email);'), // ~60s
      new MigrationOperation('INSERT INTO users VALUES (1);') // ~10ms
    ];
    
    const summary = new MigrationAnalysisSummary(operations);
    
    assert.ok(summary.estimatedDurationMs > 0);
    assert.ok(summary.estimatedDurationMs > 60000); // Should be more than 1 minute due to index
  });
});

describe('MigrationExplainer', () => {
  let eventEmitter;
  let explainer;
  let events;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    events = [];
    eventEmitter.on('domain-event', (event) => events.push(event));
    explainer = new MigrationExplainer(eventEmitter);
  });

  test('should analyze migration and emit events', () => {
    const sqlOperations = [
      'CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL);',
      'CREATE INDEX CONCURRENTLY idx_users_email ON users (email);',
      'INSERT INTO users (email) VALUES (\'test@example.com\');'
    ];
    
    const analysis = explainer.analyzeMigration(sqlOperations);
    
    assert.strictEqual(events.length, 2);
    assert.ok(events[0] instanceof MigrationAnalysisStarted);
    assert.ok(events[1] instanceof MigrationAnalysisCompleted);
    
    assert.strictEqual(analysis.operations.length, 3);
    assert.ok(analysis.summary instanceof MigrationAnalysisSummary);
    assert.ok(analysis.timestamp);
  });

  test('should handle pre-built MigrationOperation objects', () => {
    const operations = [
      new MigrationOperation('CREATE TABLE test (id INT);'),
      'ALTER TABLE test ADD COLUMN name TEXT;'
    ];
    
    const analysis = explainer.analyzeMigration(operations);
    
    assert.strictEqual(analysis.operations.length, 2);
    assert.ok(analysis.operations[0] instanceof MigrationOperation);
    assert.ok(analysis.operations[1] instanceof MigrationOperation);
  });

  test('should generate comprehensive markdown report', () => {
    const sqlOperations = [
      'DROP TABLE deprecated_table;',
      'CREATE INDEX CONCURRENTLY idx_users_email ON users (email);',
      'ALTER TABLE users ADD COLUMN phone TEXT;',
      'INSERT INTO users (phone) VALUES (\'555-1234\');'
    ];
    
    const analysis = explainer.analyzeMigration(sqlOperations);
    const markdown = explainer.generateMarkdownReport(analysis);
    
    // Check report structure
    assert.ok(markdown.includes('# Migration Impact Analysis'));
    assert.ok(markdown.includes('## Risk Summary'));
    assert.ok(markdown.includes('## ⚠️ Blocking Operations'));
    assert.ok(markdown.includes('## 💡 Recommendations'));
    assert.ok(markdown.includes('## Detailed Operation Analysis'));
    
    // Check risk badges
    assert.ok(markdown.includes('🔴 CRITICAL'));
    assert.ok(markdown.includes('🟡 MEDIUM'));
    assert.ok(markdown.includes('🟢 LOW'));
    
    // Check operation details
    assert.ok(markdown.includes('DROP_TABLE'));
    assert.ok(markdown.includes('CREATE_INDEX_CONCURRENT'));
    assert.ok(markdown.includes('ADD_COLUMN'));
    
    // Check SQL blocks
    assert.ok(markdown.includes('```sql'));
    assert.ok(markdown.includes('DROP TABLE deprecated_table;'));
    
    // Check recommendations
    assert.ok(markdown.includes('maintenance window') || markdown.includes('blocking'));
  });

  test('should generate JSON report for programmatic use', () => {
    const sqlOperations = [
      'CREATE TABLE users (id INT);',
      'ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT \'\';'
    ];
    
    const analysis = explainer.analyzeMigration(sqlOperations);
    const jsonReport = explainer.generateJsonReport(analysis);
    
    assert.ok(jsonReport.timestamp);
    assert.ok(jsonReport.summary);
    assert.ok(jsonReport.operations);
    
    assert.strictEqual(jsonReport.summary.totalOperations, 2);
    assert.strictEqual(jsonReport.operations.length, 2);
    
    // Check operation structure
    const operation = jsonReport.operations[0];
    assert.ok(operation.sql);
    assert.ok(operation.operationType);
    assert.ok(operation.affectedTables);
    assert.ok(operation.lockLevel);
    assert.ok(operation.explanation);
  });

  test('should provide quick risk assessment', () => {
    const assessment = explainer.quickAssessment('DROP TABLE users;');
    
    assert.strictEqual(assessment.riskLevel, 'CRITICAL');
    assert.strictEqual(assessment.lockLevel, 'ACCESS EXCLUSIVE');
    assert.strictEqual(assessment.blocksReads, true);
    assert.strictEqual(assessment.blocksWrites, true);
    assert.ok(assessment.estimatedDuration);
    assert.ok(assessment.impact.includes('BLOCKS ALL ACCESS'));
    assert.ok(assessment.affectedTables.includes('users'));
  });

  test('should handle empty migration', () => {
    const analysis = explainer.analyzeMigration([]);
    
    assert.strictEqual(analysis.operations.length, 0);
    assert.strictEqual(analysis.summary.totalOperations, 0);
    assert.strictEqual(analysis.summary.overallRiskScore, 'LOW');
  });

  test('should handle complex migration scenario', () => {
    const complexMigration = [
      // Table restructuring
      'CREATE TABLE users_new (id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW());',
      'INSERT INTO users_new (id, email, created_at) SELECT id, email, created_at FROM users;',
      
      // Index creation
      'CREATE INDEX CONCURRENTLY idx_users_new_email ON users_new (email);',
      'CREATE INDEX CONCURRENTLY idx_users_new_created_at ON users_new (created_at);',
      
      // Constraint addition
      'ALTER TABLE users_new ADD CONSTRAINT uk_users_email UNIQUE (email);',
      
      // Table swap
      'DROP TABLE users;',
      'ALTER TABLE users_new RENAME TO users;',
      
      // Data cleanup
      'DELETE FROM users WHERE email IS NULL;'
    ];
    
    const analysis = explainer.analyzeMigration(complexMigration, {
      estimatedRows: 1000000 // 1M rows
    });
    
    assert.strictEqual(analysis.operations.length, 8);
    assert.ok(analysis.summary.estimatedDurationMs > 300000); // Should be > 5 minutes
    assert.ok(analysis.summary.blockingOperations.length > 0);
    assert.ok(analysis.summary.recommendations.length > 0);
    
    const markdown = explainer.generateMarkdownReport(analysis);
    assert.ok(markdown.includes('maintenance window'));
    
    // Should have critical risk due to DROP TABLE
    assert.strictEqual(analysis.summary.overallRiskScore, 'CRITICAL');
  });

  test('should correctly identify partial index operations', () => {
    const partialIndexSql = 'CREATE INDEX CONCURRENTLY idx_active_users ON users (email) WHERE active = true;';
    const operation = new MigrationOperation(partialIndexSql);
    
    assert.strictEqual(operation.operationType, 'CREATE_INDEX_CONCURRENT');
    assert.strictEqual(operation.isPartial, true);
    assert.strictEqual(operation.predicate, 'active = true');
    
    // Partial indexes should have slightly lower duration estimates
    const fullIndexSql = 'CREATE INDEX CONCURRENTLY idx_all_users ON users (email);';
    const fullOperation = new MigrationOperation(fullIndexSql);
    
    assert.ok(operation.estimatedDurationMs < fullOperation.estimatedDurationMs);
  });

  test('should handle constraint operations with validation strategies', () => {
    const notValidConstraint = 'ALTER TABLE users ADD CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES orgs(id) NOT VALID;';
    const regularConstraint = 'ALTER TABLE users ADD CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES orgs(id);';
    
    const notValidOp = new MigrationOperation(notValidConstraint);
    const regularOp = new MigrationOperation(regularConstraint);
    
    // NOT VALID constraints should have lower lock levels
    assert.strictEqual(notValidOp.lockLevel, PostgreSQLLockLevels.SHARE_ROW_EXCLUSIVE);
    assert.strictEqual(regularOp.lockLevel, PostgreSQLLockLevels.ACCESS_EXCLUSIVE);
    
    // Risk levels should reflect this difference
    assert.ok(notValidOp.riskLevel !== regularOp.riskLevel);
  });
});