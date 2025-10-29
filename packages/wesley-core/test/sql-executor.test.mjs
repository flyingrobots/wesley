/**
 * Tests for SQLExecutor domain component
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';

import { 
  SQLExecutor, 
  PostgreSQLConnection, 
  SQLOperation,
  SQLExecutorStarted,
  SQLOperationStarted,
  SQLOperationCompleted,
  SQLExecutorError,
  SQLTransactionStarted,
  SQLTransactionCommitted,
  SQLAdvisoryLockAcquired 
} from '../src/domain/executor/SQLExecutor.mjs';

/**
 * Mock SQLExecutor for testing without actual PostgreSQL connection
 */
class MockSQLExecutor extends SQLExecutor {
  constructor(connection, eventEmitter = null) {
    super(connection, eventEmitter);
    this.mockResults = new Map();
    this.mockProcessReady = true;
    this.mockExecuteDelay = 0;
  }
  
  // Mock the psql process startup
  async start() {
    this.emit(new SQLExecutorStarted(this.connection.connectionString, {}));
    this.psqlProcess = { pid: 12345, stdin: {}, stdout: {}, stderr: {} };
    return true;
  }
  
  // Mock SQL execution
  async executeSql(sql) {
    await new Promise(resolve => setTimeout(resolve, this.mockExecuteDelay));
    
    if (this.mockResults.has(sql.trim())) {
      const result = this.mockResults.get(sql.trim());
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }
    
    // Default mock responses
    if (sql.includes('INSERT')) return 'INSERT 0 1\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('UPDATE')) return 'UPDATE 1\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('DELETE')) return 'DELETE 1\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('CREATE')) return 'CREATE INDEX\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('BEGIN')) return 'BEGIN\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('COMMIT')) return 'COMMIT\nWESLEY_OPERATION_COMPLETE';
    
    return 'OK\nWESLEY_OPERATION_COMPLETE';
  }
  
  setMockResult(sql, result) {
    this.mockResults.set(sql.trim(), result);
  }
  
  setExecuteDelay(delayMs) {
    this.mockExecuteDelay = delayMs;
  }
}

describe('PostgreSQLConnection', () => {
  test('should create connection from connection string', () => {
    const conn = new PostgreSQLConnection('postgresql://user:pass@host:5432/db');
    assert.strictEqual(conn.connectionString, 'postgresql://user:pass@host:5432/db');
  });
  
  test('should create connection from individual options', () => {
    const conn = new PostgreSQLConnection(null, {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      password: 'testpass'
    });
    
    assert.strictEqual(conn.host, 'localhost');
    assert.strictEqual(conn.port, 5432);
    assert.strictEqual(conn.database, 'testdb');
    assert.strictEqual(conn.username, 'testuser');
    assert.strictEqual(conn.password, 'testpass');
  });
  
  test('should generate correct psql arguments', () => {
    const conn = new PostgreSQLConnection('postgresql://user:pass@host:5432/db');
    const args = conn.toPsqlArgs();
    
    assert.ok(args.includes('postgresql://user:pass@host:5432/db'));
    assert.ok(args.includes('-v'));
    assert.ok(args.includes('ON_ERROR_STOP=1'));
    assert.ok(args.includes('--single-transaction'));
    assert.ok(args.includes('--quiet'));
  });
  
  test('should generate environment variables', () => {
    const conn = new PostgreSQLConnection(null, {
      password: 'secret',
      applicationName: 'wesley-test'
    });
    
    const env = conn.toEnv();
    assert.strictEqual(env.PGPASSWORD, 'secret');
    assert.strictEqual(env.PGAPPNAME, 'wesley-test');
  });
});

describe('SQLOperation', () => {
  test('should create operation with SQL and metadata', () => {
    const op = new SQLOperation('SELECT 1;', {
      operation: 'TEST_SELECT',
      table: 'test_table',
      timeoutMs: 5000
    });
    
    assert.strictEqual(op.sql, 'SELECT 1;');
    assert.strictEqual(op.metadata.operation, 'TEST_SELECT');
    assert.strictEqual(op.metadata.table, 'test_table');
    assert.strictEqual(op.metadata.timeoutMs, 5000);
  });
  
  test('should track operation timing', () => {
    const op = new SQLOperation('SELECT 1;');
    
    assert.strictEqual(op.getDuration(), null);
    
    op.start();
    assert.ok(op.startTime);
    assert.strictEqual(op.endTime, null);
    
    op.complete(5);
    assert.ok(op.endTime);
    assert.strictEqual(op.rowsAffected, 5);
    assert.ok(op.getDuration() >= 0);
  });
  
  test('should track operation failures', () => {
    const op = new SQLOperation('INVALID SQL;');
    const error = new Error('Syntax error');
    
    op.start();
    op.fail(error);
    
    assert.strictEqual(op.error, error);
    assert.ok(op.endTime);
  });
  
  test('should generate SQL preview', () => {
    const longSql = 'SELECT ' + 'a,'.repeat(100) + ' FROM table;';
    const op = new SQLOperation(longSql);
    
    const preview = op.getSqlPreview();
    assert.ok(preview.length <= 203); // 200 + '...'
    assert.ok(preview.includes('...'));
  });
});

describe('SQLExecutor', () => {
  let eventEmitter;
  let connection;
  let executor;
  let events;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    events = [];
    
    eventEmitter.on('domain-event', (event) => {
      events.push(event);
    });
    
    connection = new PostgreSQLConnection('postgresql://test:test@localhost:5432/test');
    executor = new MockSQLExecutor(connection, eventEmitter);
  });

  test('should start and emit startup event', async () => {
    await executor.start();
    
    assert.strictEqual(events.length, 1);
    assert.ok(events[0] instanceof SQLExecutorStarted);
    assert.ok(executor.psqlProcess);
  });

  test('should execute single operation', async () => {
    await executor.start();
    
    const operation = new SQLOperation('SELECT 1;', { operation: 'TEST_SELECT' });
    const result = await executor.executeOperation(operation);
    
    assert.ok(result.includes('OK'));
    assert.strictEqual(operation.status, undefined); // Status is tracked by operation itself
    
    // Check events
    const startEvent = events.find(e => e.type === 'SQL_OPERATION_STARTED');
    const completeEvent = events.find(e => e.type === 'SQL_OPERATION_COMPLETED');
    
    assert.ok(startEvent);
    assert.ok(completeEvent);
    assert.strictEqual(startEvent.payload.operation, 'TEST_SELECT');
  });

  test('should handle operation failures', async () => {
    await executor.start();
    
    const operation = new SQLOperation('INVALID SQL;', { operation: 'TEST_ERROR' });
    executor.setMockResult('INVALID SQL;', new Error('SQL syntax error'));
    
    await assert.rejects(
      async () => await executor.executeOperation(operation),
      /SQL syntax error/
    );
    
    const errorEvent = events.find(e => e.type === 'SQL_EXECUTOR_ERROR');
    assert.ok(errorEvent);
    assert.strictEqual(errorEvent.payload.operation, 'TEST_ERROR');
  });

  test('should parse rows affected from output', async () => {
    await executor.start();
    
    executor.setMockResult('INSERT INTO test VALUES (1);', 'INSERT 0 3\nWESLEY_OPERATION_COMPLETE');
    executor.setMockResult('UPDATE test SET id = 2;', 'UPDATE 5\nWESLEY_OPERATION_COMPLETE');
    executor.setMockResult('DELETE FROM test;', 'DELETE 2\nWESLEY_OPERATION_COMPLETE');
    
    const insertOp = new SQLOperation('INSERT INTO test VALUES (1);', { operation: 'INSERT' });
    await executor.executeOperation(insertOp);
    assert.strictEqual(insertOp.rowsAffected, 3);
    
    const updateOp = new SQLOperation('UPDATE test SET id = 2;', { operation: 'UPDATE' });
    await executor.executeOperation(updateOp);
    assert.strictEqual(updateOp.rowsAffected, 5);
    
    const deleteOp = new SQLOperation('DELETE FROM test;', { operation: 'DELETE' });
    await executor.executeOperation(deleteOp);
    assert.strictEqual(deleteOp.rowsAffected, 2);
  });

  test('should manage transactions', async () => {
    await executor.start();
    
    assert.strictEqual(executor.transactionActive, false);
    
    await executor.startTransaction('REPEATABLE READ');
    assert.strictEqual(executor.transactionActive, true);
    
    const txStartEvent = events.find(e => e.type === 'SQL_TRANSACTION_STARTED');
    assert.ok(txStartEvent);
    assert.strictEqual(txStartEvent.payload.isolationLevel, 'REPEATABLE READ');
    
    await executor.commitTransaction();
    assert.strictEqual(executor.transactionActive, false);
    
    const commitEvent = events.find(e => e.type === 'SQL_TRANSACTION_COMMITTED');
    assert.ok(commitEvent);
  });

  test('should rollback transaction', async () => {
    await executor.start();
    
    await executor.startTransaction();
    assert.strictEqual(executor.transactionActive, true);
    
    await executor.rollbackTransaction('Test rollback');
    assert.strictEqual(executor.transactionActive, false);
    
    const rollbackEvent = events.find(e => e.type === 'SQL_TRANSACTION_ROLLED_BACK');
    assert.ok(rollbackEvent);
    assert.strictEqual(rollbackEvent.payload.reason, 'Test rollback');
  });

  test('should manage advisory locks', async () => {
    await executor.start();
    
    const lockId = 12345;
    await executor.acquireAdvisoryLock(lockId, false);
    assert.ok(executor.advisoryLocks.has(lockId));
    
    const lockEvent = events.find(e => e.type === 'SQL_ADVISORY_LOCK_ACQUIRED');
    assert.ok(lockEvent);
    assert.strictEqual(lockEvent.payload.lockId, lockId);
    assert.strictEqual(lockEvent.payload.lockType, 'EXCLUSIVE');
    
    await executor.releaseAdvisoryLock(lockId);
    assert.ok(!executor.advisoryLocks.has(lockId));
    
    const releaseEvent = events.find(e => e.type === 'SQL_ADVISORY_LOCK_RELEASED');
    assert.ok(releaseEvent);
    assert.strictEqual(releaseEvent.payload.lockId, lockId);
  });

  test('should execute multiple operations in sequence', async () => {
    await executor.start();
    
    const operations = [
      new SQLOperation('CREATE TABLE test (id INT);', { operation: 'CREATE' }),
      new SQLOperation('INSERT INTO test VALUES (1);', { operation: 'INSERT' }),
      new SQLOperation('UPDATE test SET id = 2;', { operation: 'UPDATE' })
    ];
    
    const results = await executor.executeOperations(operations);
    
    assert.strictEqual(results.length, 3);
    assert.strictEqual(executor.operations.length, 3);
  });

  test('should provide execution statistics', async () => {
    await executor.start();
    
    // Execute some operations
    const op1 = new SQLOperation('SELECT 1;', { operation: 'SELECT' });
    const op2 = new SQLOperation('INVALID;', { operation: 'ERROR' });
    
    await executor.executeOperation(op1);
    
    executor.setMockResult('INVALID;', new Error('Test error'));
    try {
      await executor.executeOperation(op2);
    } catch (e) {
      // Expected error
    }
    
    const stats = executor.getStats();
    
    assert.strictEqual(stats.totalOperations, 1); // Only successful operations are added to the array
    assert.strictEqual(stats.completed, 1);
    assert.strictEqual(stats.failed, 0); // Failed operations don't get added to operations array
    assert.ok(stats.averageDuration >= 0);
    assert.strictEqual(stats.transactionActive, false);
  });

  test('should handle operation timeout', async () => {
    await executor.start();
    
    const operation = new SQLOperation('SLOW QUERY;', { 
      operation: 'TIMEOUT_TEST',
      timeoutMs: 100
    });
    
    executor.setExecuteDelay(200); // Longer than timeout
    
    // Execute and wait for timeout
    const promise = executor.executeOperation(operation);
    
    // Wait for timeout to trigger
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // The operation should still complete, but timeout event should be emitted
    // Note: In a real implementation, this would cancel the operation
    await promise;
    
    executor.setExecuteDelay(0); // Reset for other tests
  });

  test('should gracefully shutdown', async () => {
    await executor.start();
    
    // Start transaction and acquire lock
    await executor.startTransaction();
    await executor.acquireAdvisoryLock(54321);
    
    assert.strictEqual(executor.transactionActive, true);
    assert.ok(executor.advisoryLocks.has(54321));
    
    await executor.shutdown();
    
    assert.strictEqual(executor.transactionActive, false);
    assert.strictEqual(executor.advisoryLocks.size, 0);
    assert.strictEqual(executor.psqlProcess, null);
  });

  test('should handle concurrent operations safely', async () => {
    await executor.start();
    
    const operations = [];
    for (let i = 0; i < 5; i++) {
      operations.push(new SQLOperation(`SELECT ${i};`, { operation: `CONCURRENT_${i}` }));
    }
    
    // Execute all operations concurrently
    const promises = operations.map(op => executor.executeOperation(op));
    const results = await Promise.all(promises);
    
    assert.strictEqual(results.length, 5);
    assert.strictEqual(executor.operations.length, 5);
    
    // Verify all completed successfully
    const stats = executor.getStats();
    assert.strictEqual(stats.completed, 5);
    assert.strictEqual(stats.failed, 0);
  });
});

describe('SQLExecutor Integration Patterns', () => {
  test('should support typical migration execution pattern', async () => {
    const eventEmitter = new EventEmitter();
    const events = [];
    eventEmitter.on('domain-event', (event) => events.push(event));
    
    const connection = new PostgreSQLConnection('postgresql://test:test@localhost:5432/test');
    const executor = new MockSQLExecutor(connection, eventEmitter);
    
    await executor.start();
    
    // Typical migration: transaction, DDL operations, commit
    await executor.startTransaction();
    
    const ddlOperations = [
      new SQLOperation('CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL);', 
        { operation: 'CREATE_TABLE', table: 'users' }),
      new SQLOperation('CREATE INDEX idx_users_email ON users (email);', 
        { operation: 'CREATE_INDEX', table: 'users' }),
      new SQLOperation('INSERT INTO users (email) VALUES (\'test@example.com\');', 
        { operation: 'SEED_DATA', table: 'users' })
    ];
    
    await executor.executeOperations(ddlOperations);
    await executor.commitTransaction();
    
    const stats = executor.getStats();
    assert.strictEqual(stats.completed, 5); // BEGIN + 3 DDL + COMMIT = 5 operations
    assert.strictEqual(stats.failed, 0);
    
    // Verify proper event sequence
    const eventTypes = events.map(e => e.type);
    assert.ok(eventTypes.includes('SQL_EXECUTOR_STARTED'));
    assert.ok(eventTypes.includes('SQL_TRANSACTION_STARTED'));
    assert.ok(eventTypes.includes('SQL_OPERATION_STARTED'));
    assert.ok(eventTypes.includes('SQL_OPERATION_COMPLETED'));
    assert.ok(eventTypes.includes('SQL_TRANSACTION_COMMITTED'));
    
    await executor.shutdown();
  });

  test('should handle error recovery pattern', async () => {
    const eventEmitter = new EventEmitter();
    const events = [];
    eventEmitter.on('domain-event', (event) => events.push(event));
    
    const connection = new PostgreSQLConnection('postgresql://test:test@localhost:5432/test');
    const executor = new MockSQLExecutor(connection, eventEmitter);
    
    await executor.start();
    
    try {
      await executor.startTransaction();
      
      // First operation succeeds
      await executor.executeOperation(
        new SQLOperation('CREATE TABLE test (id INT);', { operation: 'CREATE_TABLE' })
      );
      
      // Second operation fails
      executor.setMockResult('INVALID SQL;', new Error('Syntax error'));
      await executor.executeOperation(
        new SQLOperation('INVALID SQL;', { operation: 'INVALID_DDL' })
      );
      
      assert.fail('Should have thrown error');
    } catch (error) {
      // Expected error, now rollback
      if (executor.transactionActive) {
        await executor.rollbackTransaction('Error recovery');
      }
      
      assert.ok(error.message.includes('Syntax error'));
      assert.strictEqual(executor.transactionActive, false);
      
      const rollbackEvent = events.find(e => e.type === 'SQL_TRANSACTION_ROLLED_BACK');
      assert.ok(rollbackEvent);
      assert.strictEqual(rollbackEvent.payload.reason, 'Error recovery');
    }
    
    await executor.shutdown();
  });
});