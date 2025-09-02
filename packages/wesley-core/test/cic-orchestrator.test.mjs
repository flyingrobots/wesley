/**
 * Tests for CICOrchestrator domain component
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';

import { 
  CICOrchestrator,
  CICOperation,
  CICExecutionStrategy,
  CICProgressTracker,
  CICOperationResult,
  CICOrchestrationStarted,
  CICOperationStarted,
  CICOperationCompleted,
  CICOperationFailed,
  CICOrchestrationCompleted
} from '../src/domain/orchestrator/CICOrchestrator.mjs';

/**
 * Mock SQLExecutor for CIC testing
 */
class MockSQLExecutor {
  constructor() {
    this.operations = [];
    this.failures = new Map();
    this.delays = new Map();
    this.existingIndexes = new Set();
  }
  
  async executeOperation(operation) {
    this.operations.push(operation);
    
    const sql = operation.sql.trim();
    
    // Simulate delays
    if (this.delays.has(sql)) {
      await new Promise(resolve => setTimeout(resolve, this.delays.get(sql)));
    }
    
    // Simulate failures
    if (this.failures.has(sql)) {
      throw this.failures.get(sql);
    }
    
    // Simulate different responses based on SQL
    if (sql.includes('CREATE INDEX CONCURRENTLY')) {
      return 'CREATE INDEX\nWESLEY_OPERATION_COMPLETE';
    } else if (sql.includes('SELECT') && sql.includes('pg_indexes')) {
      const indexName = this.extractIndexNameFromQuery(sql);
      return this.existingIndexes.has(indexName) ? '1 row' : '0 rows';
    } else if (sql.includes('DROP INDEX CONCURRENTLY')) {
      return 'DROP INDEX\nWESLEY_OPERATION_COMPLETE';
    }
    
    return 'OK\nWESLEY_OPERATION_COMPLETE';
  }
  
  setFailure(sql, error) {
    this.failures.set(sql.trim(), error);
  }
  
  setDelay(sql, delayMs) {
    this.delays.set(sql.trim(), delayMs);
  }
  
  setIndexExists(indexName, exists = true) {
    if (exists) {
      this.existingIndexes.add(indexName);
    } else {
      this.existingIndexes.delete(indexName);
    }
  }
  
  extractIndexNameFromQuery(sql) {
    const match = sql.match(/indexname = '([^']+)'/);
    return match ? match[1] : 'unknown';
  }
  
  getExecutedOperations() {
    return [...this.operations];
  }
  
  reset() {
    this.operations = [];
    this.failures.clear();
    this.delays.clear();
    this.existingIndexes.clear();
  }
}

describe('CICOperation', () => {
  test('should extract index name from CREATE INDEX CONCURRENTLY statement', () => {
    const testCases = [
      { sql: 'CREATE INDEX CONCURRENTLY idx_users_email ON users (email);', expected: 'idx_users_email' },
      { sql: 'CREATE UNIQUE INDEX CONCURRENTLY "idx_users_phone" ON users (phone);', expected: 'idx_users_phone' },
      { sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_date ON orders (created_at);', expected: 'idx_orders_date' }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new CICOperation(sql);
      assert.strictEqual(operation.indexName, expected, `Failed for SQL: ${sql}`);
    });
  });

  test('should extract table name from CREATE INDEX statement', () => {
    const testCases = [
      { sql: 'CREATE INDEX CONCURRENTLY idx_users_email ON users (email);', expected: 'users' },
      { sql: 'CREATE INDEX CONCURRENTLY idx_orders ON public.orders (id);', expected: 'orders' },
      { sql: 'CREATE INDEX CONCURRENTLY idx_profiles ON "user_profiles" (user_id);', expected: 'user_profiles' }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new CICOperation(sql);
      assert.strictEqual(operation.tableName, expected, `Failed for SQL: ${sql}`);
    });
  });

  test('should extract column names', () => {
    const testCases = [
      { sql: 'CREATE INDEX CONCURRENTLY idx_email ON users (email);', expected: ['email'] },
      { sql: 'CREATE INDEX CONCURRENTLY idx_name_email ON users (last_name, first_name, email);', expected: ['last_name', 'first_name', 'email'] },
      { sql: 'CREATE INDEX CONCURRENTLY idx_json ON users ((profile->>"age"));', expected: ['(profile->>"age")'] }
    ];
    
    testCases.forEach(({ sql, expected }) => {
      const operation = new CICOperation(sql);
      assert.deepStrictEqual(operation.columns, expected, `Failed for SQL: ${sql}`);
    });
  });

  test('should detect unique and partial indexes', () => {
    const uniqueIndex = new CICOperation('CREATE UNIQUE INDEX CONCURRENTLY idx_users_email ON users (email);');
    assert.strictEqual(uniqueIndex.isUnique, true);
    
    const partialIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_active_users ON users (email) WHERE active = true;');
    assert.strictEqual(partialIndex.isPartial, true);
    assert.strictEqual(partialIndex.predicate, 'active = true');
    
    const regularIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_name ON users (name);');
    assert.strictEqual(regularIndex.isUnique, false);
    assert.strictEqual(regularIndex.isPartial, false);
  });

  test('should extract index method', () => {
    const btreeIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_name ON users USING btree (name);');
    assert.strictEqual(btreeIndex.method, 'btree');
    
    const ginIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_tags ON users USING gin (tags);');
    assert.strictEqual(ginIndex.method, 'gin');
    
    const defaultIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
    assert.strictEqual(defaultIndex.method, 'btree'); // Default
  });

  test('should calculate priority based on index characteristics', () => {
    const uniqueIndex = new CICOperation('CREATE UNIQUE INDEX CONCURRENTLY idx_users_email ON users (email);');
    assert.strictEqual(uniqueIndex.getPriority(), 'HIGH');
    
    const ginIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_tags ON users USING gin (tags);');
    assert.strictEqual(ginIndex.getPriority(), 'MEDIUM');
    
    const regularIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_name ON users (name);');
    assert.strictEqual(regularIndex.getPriority(), 'NORMAL');
  });

  test('should estimate duration based on complexity', () => {
    const simpleIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_id ON users (id);');
    const complexIndex = new CICOperation('CREATE INDEX CONCURRENTLY idx_complex ON users USING gin (tags, metadata) WHERE active = true;', {
      estimatedRows: 10000000
    });
    
    assert.ok(complexIndex.getEstimatedDuration() > simpleIndex.getEstimatedDuration());
  });

  test('should detect conflicts between operations', () => {
    const op1 = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
    const op2 = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_name ON users (name);');
    const op3 = new CICOperation('CREATE INDEX CONCURRENTLY idx_orders_date ON orders (created_at);');
    const op4 = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON profiles (email);'); // Same name, different table
    
    // Same table - should conflict
    assert.strictEqual(op1.conflictsWith(op2), true);
    
    // Different tables - should not conflict
    assert.strictEqual(op1.conflictsWith(op3), false);
    
    // Same index name - should conflict
    assert.strictEqual(op1.conflictsWith(op4), true);
  });

  test('should generate cleanup SQL for failed index', () => {
    const operation = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
    const cleanupSql = operation.getCleanupSql();
    
    assert.ok(cleanupSql.includes('DROP INDEX CONCURRENTLY'));
    assert.ok(cleanupSql.includes('IF EXISTS'));
    assert.ok(cleanupSql.includes('idx_users_email'));
  });
});

describe('CICExecutionStrategy', () => {
  test('should create different strategy types', () => {
    const sequential = new CICExecutionStrategy(CICExecutionStrategy.SEQUENTIAL);
    assert.strictEqual(sequential.type, 'SEQUENTIAL');
    
    const tableParallel = new CICExecutionStrategy(CICExecutionStrategy.TABLE_PARALLEL);
    assert.strictEqual(tableParallel.type, 'TABLE_PARALLEL');
    
    const priorityBased = new CICExecutionStrategy(CICExecutionStrategy.PRIORITY_BASED);
    assert.strictEqual(priorityBased.type, 'PRIORITY_BASED');
  });

  test('should have configurable parameters', () => {
    const strategy = new CICExecutionStrategy();
    
    assert.ok(strategy.maxParallelTables > 0);
    assert.ok(strategy.maxRetriesPerOperation >= 0);
    assert.ok(strategy.backoffMultiplier > 1.0);
    assert.ok(strategy.maxBackoffMs > 0);
  });
});

describe('CICProgressTracker', () => {
  test('should track progress correctly', () => {
    const tracker = new CICProgressTracker(5);
    
    let progress = tracker.getProgress();
    assert.strictEqual(progress.total, 5);
    assert.strictEqual(progress.processed, 0);
    assert.strictEqual(progress.percentage, 0);
    
    const operation = { indexName: 'idx_test' };
    tracker.startOperation(operation);
    assert.strictEqual(tracker.getProgress().inProgress, 1);
    
    tracker.completeOperation(operation, true);
    progress = tracker.getProgress();
    assert.strictEqual(progress.completed, 1);
    assert.strictEqual(progress.processed, 1);
    assert.strictEqual(progress.percentage, 20);
    assert.strictEqual(progress.inProgress, 0);
  });

  test('should track failed and skipped operations', () => {
    const tracker = new CICProgressTracker(3);
    
    const op1 = { indexName: 'idx1' };
    const op2 = { indexName: 'idx2' };
    const op3 = { indexName: 'idx3' };
    
    tracker.completeOperation(op1, true);  // Success
    tracker.completeOperation(op2, false); // Failure
    tracker.skipOperation(op3);            // Skipped
    
    const progress = tracker.getProgress();
    assert.strictEqual(progress.completed, 1);
    assert.strictEqual(progress.failed, 1);
    assert.strictEqual(progress.skipped, 1);
    assert.strictEqual(progress.processed, 3);
    assert.strictEqual(progress.percentage, 100);
  });
});

describe('CICOperationResult', () => {
  test('should create result with different statuses', () => {
    const operation = new CICOperation('CREATE INDEX CONCURRENTLY idx_test ON test (id);');
    
    const successResult = new CICOperationResult(operation, 'completed', 5000);
    assert.strictEqual(successResult.isSuccess(), true);
    assert.strictEqual(successResult.isFailure(), false);
    assert.strictEqual(successResult.wasSkipped(), false);
    assert.strictEqual(successResult.duration, 5000);
    
    const failureResult = new CICOperationResult(operation, 'failed', null, new Error('Test error'));
    assert.strictEqual(failureResult.isSuccess(), false);
    assert.strictEqual(failureResult.isFailure(), true);
    assert.ok(failureResult.error instanceof Error);
    
    const skippedResult = new CICOperationResult(operation, 'skipped');
    assert.strictEqual(skippedResult.wasSkipped(), true);
  });
});

describe('CICOrchestrator', () => {
  let mockExecutor;
  let eventEmitter;
  let orchestrator;
  let events;

  beforeEach(() => {
    mockExecutor = new MockSQLExecutor();
    eventEmitter = new EventEmitter();
    events = [];
    
    eventEmitter.on('domain-event', (event) => events.push(event));
    
    orchestrator = new CICOrchestrator(mockExecutor, eventEmitter);
  });

  test('should orchestrate simple sequential execution', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_phone ON users (phone);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_orders_date ON orders (created_at);')
    ];
    
    const strategy = new CICExecutionStrategy(CICExecutionStrategy.SEQUENTIAL);
    const results = await orchestrator.orchestrate(operations, strategy);
    
    assert.strictEqual(results.length, 3);
    assert.ok(results.every(r => r.isSuccess()));
    
    // Check events
    assert.ok(events.find(e => e instanceof CICOrchestrationStarted));
    assert.ok(events.find(e => e instanceof CICOrchestrationCompleted));
    assert.strictEqual(events.filter(e => e instanceof CICOperationStarted).length, 3);
    assert.strictEqual(events.filter(e => e instanceof CICOperationCompleted).length, 3);
  });

  test('should handle table-parallel execution', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_orders_date ON orders (created_at);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_products_name ON products (name);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_phone ON users (phone);') // Should wait for users table
    ];
    
    const strategy = new CICExecutionStrategy(CICExecutionStrategy.TABLE_PARALLEL);
    const results = await orchestrator.orchestrate(operations, strategy);
    
    assert.strictEqual(results.length, 4);
    assert.ok(results.every(r => r.isSuccess()));
    
    // The last operation (users table) should have been executed after the first one completed
    const executedOps = mockExecutor.getExecutedOperations();
    assert.strictEqual(executedOps.length, 4);
  });

  test('should execute operations by priority', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_name ON users (name);'), // NORMAL priority
      new CICOperation('CREATE UNIQUE INDEX CONCURRENTLY idx_users_email ON users (email);'), // HIGH priority
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_tags ON users USING gin (tags);') // MEDIUM priority
    ];
    
    const strategy = new CICExecutionStrategy(CICExecutionStrategy.PRIORITY_BASED);
    const results = await orchestrator.orchestrate(operations, strategy);
    
    assert.strictEqual(results.length, 3);
    
    // All should be on same table, so executed sequentially in priority order
    const executedOps = mockExecutor.getExecutedOperations();
    assert.ok(executedOps[0].sql.includes('UNIQUE')); // HIGH priority first
    assert.ok(executedOps[1].sql.includes('gin'));    // MEDIUM priority second
    assert.ok(executedOps[2].sql.includes('name'));   // NORMAL priority last
  });

  test('should skip duplicate index names', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON profiles (email);') // Same name
    ];
    
    const results = await orchestrator.orchestrate(operations);
    
    assert.strictEqual(results.length, 2);
    assert.ok(results.some(r => r.isSuccess()));
    assert.ok(results.some(r => r.wasSkipped()));
    
    const skippedEvent = events.find(e => e.type === 'CIC_OPERATION_SKIPPED');
    assert.ok(skippedEvent);
    assert.ok(skippedEvent.payload.reason.includes('Duplicate'));
  });

  test('should skip existing indexes', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);')
    ];
    
    // Mark index as already existing
    mockExecutor.setIndexExists('idx_users_email', true);
    
    const results = await orchestrator.orchestrate(operations);
    
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].wasSkipped());
    
    const skippedEvent = events.find(e => e.type === 'CIC_OPERATION_SKIPPED');
    assert.ok(skippedEvent);
    assert.ok(skippedEvent.payload.reason.includes('already exists'));
  });

  test('should retry failed operations', async () => {
    const operation = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
    
    // Set up to fail twice, then succeed
    let attemptCount = 0;
    mockExecutor.setFailure(operation.sql, new Error('Temporary failure'));
    
    // Override executeOperation to succeed on third attempt
    const originalExecuteOperation = mockExecutor.executeOperation.bind(mockExecutor);
    mockExecutor.executeOperation = async (op) => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error('Temporary failure');
      }
      return originalExecuteOperation(op);
    };
    
    const results = await orchestrator.orchestrate([operation]);
    
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].isSuccess());
    assert.strictEqual(results[0].retryCount, 2);
    
    // Should have failure events for retries
    const failureEvents = events.filter(e => e instanceof CICOperationFailed);
    assert.strictEqual(failureEvents.length, 2); // Two retries
    assert.ok(failureEvents[0].payload.willRetry);
    assert.ok(failureEvents[1].payload.willRetry);
  });

  test('should give up after max retries', async () => {
    const operation = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
    mockExecutor.setFailure(operation.sql, new Error('Persistent failure'));
    
    const results = await orchestrator.orchestrate([operation]);
    
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].isFailure());
    assert.ok(results[0].error.message.includes('Persistent failure'));
    
    const finalFailureEvent = events.filter(e => e instanceof CICOperationFailed).pop();
    assert.strictEqual(finalFailureEvent.payload.willRetry, false);
  });

  test('should clean up failed indexes', async () => {
    const operation = new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);');
    mockExecutor.setFailure(operation.sql, new Error('Index creation failed'));
    
    // Mock the index as existing but invalid (failed CIC leaves invalid index)
    const originalExecuteOperation = mockExecutor.executeOperation.bind(mockExecutor);
    mockExecutor.executeOperation = async (op) => {
      if (op.sql.includes('CREATE INDEX CONCURRENTLY')) {
        throw new Error('Index creation failed');
      } else if (op.sql.includes('NOT indisvalid')) {
        return 'idx_users_email'; // Simulate finding invalid index
      } else if (op.sql.includes('DROP INDEX CONCURRENTLY')) {
        return 'DROP INDEX\nWESLEY_OPERATION_COMPLETE';
      }
      return originalExecuteOperation(op);
    };
    
    const results = await orchestrator.orchestrate([operation]);
    
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].isFailure());
    
    // Should have executed cleanup
    const executedOps = mockExecutor.getExecutedOperations();
    const cleanupOp = executedOps.find(op => op.sql.includes('DROP INDEX CONCURRENTLY'));
    assert.ok(cleanupOp, 'Cleanup operation should have been executed');
  });

  test('should provide status during execution', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_orders_date ON orders (created_at);')
    ];
    
    // Add delay to first operation so we can check status
    mockExecutor.setDelay(operations[0].sql, 100);
    
    const orchestratePromise = orchestrator.orchestrate(operations);
    
    // Check status while running
    await new Promise(resolve => setTimeout(resolve, 50));
    const status = orchestrator.getStatus();
    
    assert.ok(['running', 'completed'].includes(status.status));
    assert.ok(status.progress);
    assert.strictEqual(status.strategy, 'TABLE_PARALLEL');
    
    await orchestratePromise;
    
    const finalStatus = orchestrator.getStatus();
    assert.strictEqual(finalStatus.status, 'completed');
    assert.strictEqual(finalStatus.progress.percentage, 100);
  });

  test('should handle cancellation gracefully', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_email ON users (email);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_phone ON users (phone);')
    ];
    
    // Start orchestration
    const orchestratePromise = orchestrator.orchestrate(operations);
    
    // Cancel immediately
    const cancelResult = await orchestrator.cancel();
    
    assert.ok(cancelResult.message.includes('cancelled'));
    
    // Wait for orchestration to complete naturally
    const results = await orchestratePromise;
    
    // Should complete running operations but not start new ones
    assert.ok(results.length <= 2);
  });

  test('should handle complex real-world scenario', async () => {
    const operations = [
      // High priority - unique constraints
      new CICOperation('CREATE UNIQUE INDEX CONCURRENTLY idx_users_email ON users (email);'),
      new CICOperation('CREATE UNIQUE INDEX CONCURRENTLY idx_orders_number ON orders (order_number);'),
      
      // Medium priority - specialized indexes
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_profile ON users USING gin (profile);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_orders_metadata ON orders USING gin (metadata);'),
      
      // Normal priority - regular indexes
      new CICOperation('CREATE INDEX CONCURRENTLY idx_users_name ON users (last_name, first_name);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_orders_date ON orders (created_at);'),
      
      // Partial indexes
      new CICOperation('CREATE INDEX CONCURRENTLY idx_active_users ON users (last_seen) WHERE active = true;'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_pending_orders ON orders (created_at) WHERE status = \'pending\';')
    ];
    
    // Simulate one failure and retry
    mockExecutor.setFailure(operations[2].sql, new Error('Temporary lock conflict'));
    let failureCount = 0;
    const originalExecuteOperation = mockExecutor.executeOperation.bind(mockExecutor);
    mockExecutor.executeOperation = async (op) => {
      if (op.sql === operations[2].sql && failureCount === 0) {
        failureCount++;
        throw new Error('Temporary lock conflict');
      }
      return originalExecuteOperation(op);
    };
    
    const strategy = new CICExecutionStrategy(CICExecutionStrategy.PRIORITY_BASED);
    strategy.maxParallelTables = 2; // Allow some parallelism
    
    const results = await orchestrator.orchestrate(operations, strategy);
    
    assert.strictEqual(results.length, 8);
    
    const successful = results.filter(r => r.isSuccess());
    const failed = results.filter(r => r.isFailure());
    
    assert.strictEqual(successful.length, 8);
    assert.strictEqual(failed.length, 0);
    
    // Check that high priority operations were executed first
    const executedOps = mockExecutor.getExecutedOperations();
    const firstTwo = executedOps.slice(0, 2);
    assert.ok(firstTwo.every(op => op.sql.includes('UNIQUE')));
    
    // Verify event sequence
    const completionEvent = events.find(e => e instanceof CICOrchestrationCompleted);
    assert.ok(completionEvent);
    assert.strictEqual(completionEvent.payload.totalOperations, 8);
    assert.strictEqual(completionEvent.payload.successful, 8);
    assert.strictEqual(completionEvent.payload.failed, 0);
  });
});

describe('CICOrchestrator Edge Cases', () => {
  let mockExecutor;
  let orchestrator;

  beforeEach(() => {
    mockExecutor = new MockSQLExecutor();
    orchestrator = new CICOrchestrator(mockExecutor);
  });

  test('should handle empty operation list', async () => {
    const results = await orchestrator.orchestrate([]);
    assert.strictEqual(results.length, 0);
    
    const status = orchestrator.getStatus();
    assert.strictEqual(status.status, 'completed');
    assert.strictEqual(status.progress.percentage, 0);
  });

  test('should handle operations with no table conflicts', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_table1 ON table1 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_table2 ON table2 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_table3 ON table3 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_table4 ON table4 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_table5 ON table5 (col1);')
    ];
    
    const strategy = new CICExecutionStrategy(CICExecutionStrategy.TABLE_PARALLEL);
    strategy.maxParallelTables = 3;
    
    const startTime = Date.now();
    const results = await orchestrator.orchestrate(operations, strategy);
    const duration = Date.now() - startTime;
    
    assert.strictEqual(results.length, 5);
    assert.ok(results.every(r => r.isSuccess()));
    
    // Should complete faster than sequential due to parallelization
    // (This is a rough check - actual timing depends on system)
    assert.ok(duration < 1000); // Should be very fast with mocks
  });

  test('should handle mixed success and failure scenarios', async () => {
    const operations = [
      new CICOperation('CREATE INDEX CONCURRENTLY idx_success1 ON table1 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_failure1 ON table2 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_success2 ON table3 (col1);'),
      new CICOperation('CREATE INDEX CONCURRENTLY idx_failure2 ON table4 (col1);')
    ];
    
    // Set failures for specific operations
    mockExecutor.setFailure(operations[1].sql, new Error('Disk full'));
    mockExecutor.setFailure(operations[3].sql, new Error('Lock timeout'));
    
    const results = await orchestrator.orchestrate(operations);
    
    assert.strictEqual(results.length, 4);
    assert.strictEqual(results.filter(r => r.isSuccess()).length, 2);
    assert.strictEqual(results.filter(r => r.isFailure()).length, 2);
    
    const status = orchestrator.getStatus();
    assert.strictEqual(status.status, 'completed');
    assert.strictEqual(status.results.length, 4);
  });

  test('should respect timeout constraints', async () => {
    const operation = new CICOperation('CREATE INDEX CONCURRENTLY idx_slow ON large_table (col);', {
      timeoutMs: 1000 // 1 second timeout
    });
    
    // Set a long delay that exceeds timeout
    mockExecutor.setDelay(operation.sql, 1500);
    
    const results = await orchestrator.orchestrate([operation]);
    
    // Operation should still complete (our mock doesn't actually respect timeouts)
    // but the timeout value should be passed to the executor
    assert.strictEqual(results.length, 1);
    
    const executedOps = mockExecutor.getExecutedOperations();
    assert.strictEqual(executedOps[0].metadata.timeoutMs, 1000);
  });
});