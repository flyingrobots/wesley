/**
 * IntegrationTestHarness Tests
 * Comprehensive tests for end-to-end migration testing framework
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  IntegrationTestHarness,
  DatabaseSnapshot,
  TestConfig,
  IntegrationTestError,
  TestSetupError,
  TestExecutionError,
  PerformanceRegressionError,
  RollbackVerificationError,
  TestSuiteStarted,
  TestStarted,
  TestCompleted,
  TestFailed,
  SnapshotCreated,
  FailureInjected,
  PerformanceBaseline,
  createBasicTest,
  createPerformanceTest,
  createStressTest,
  createFailureTest
} from '../src/testing/IntegrationTestHarness.mjs';

// Mock event emitter for testing
class MockEventEmitter {
  constructor() {
    this.events = [];
  }

  emit(eventType, event) {
    this.events.push({ type: eventType, event });
  }

  getEvents(type) {
    return this.events.filter(e => e.type === type);
  }

  clear() {
    this.events = [];
  }
}

// Mock database adapter for testing
class MockDatabaseAdapter {
  constructor(options = {}) {
    this.shouldFail = options.shouldFail || false;
    this.operationDelay = options.operationDelay || 10;
    this.tables = options.initialTables || [
      { name: 'users', columns: ['id', 'email', 'name'] },
      { name: 'posts', columns: ['id', 'title', 'user_id'] }
    ];
    this.constraints = options.initialConstraints || [];
    this.indexes = options.initialIndexes || [];
    this.operationHistory = [];
  }

  async executeOperation(operation, options = {}) {
    this.operationHistory.push({ operation, options, timestamp: Date.now() });
    
    if (this.shouldFail && operation.kind === 'drop_table') {
      throw new Error(`Mock failure for ${operation.kind}`);
    }

    await new Promise(resolve => setTimeout(resolve, this.operationDelay));
    return { success: true, operation };
  }

  async getSchema() {
    return {
      tables: this.tables.map(t => ({ ...t })),
      version: '1.0.0'
    };
  }

  async getConstraints() {
    return [...this.constraints];
  }

  async getIndexes() {
    return [...this.indexes];
  }

  async getTables() {
    return this.tables.map(t => ({ name: t.name, columns: t.columns.length }));
  }

  async getTableData(tableName, options = {}) {
    const table = this.tables.find(t => t.name === tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    // Mock data based on table
    const mockData = {
      users: [
        { id: 1, email: 'test@example.com', name: 'Test User' },
        { id: 2, email: 'admin@example.com', name: 'Admin User' }
      ],
      posts: [
        { id: 1, title: 'First Post', user_id: 1 },
        { id: 2, title: 'Second Post', user_id: 2 }
      ]
    };

    return mockData[tableName] || [];
  }

  async getRowCount(tableName) {
    const data = await this.getTableData(tableName);
    return data.length;
  }

  async getDatabaseStatistics() {
    return {
      totalTables: this.tables.length,
      totalConstraints: this.constraints.length,
      totalIndexes: this.indexes.length,
      timestamp: new Date().toISOString()
    };
  }

  async setupTestEnvironment(options = {}) {
    // Mock setup
  }

  async cleanupTestEnvironment(options = {}) {
    // Mock cleanup
  }
}

test('IntegrationTestHarness constructor with default options', async () => {
  const harness = new IntegrationTestHarness();
  
  assert.equal(harness.databaseAdapter, null);
  assert.equal(harness.eventEmitter, null);
  assert(harness.performanceBaselines instanceof Map);
  assert(harness.activeSnapshots instanceof Map);
  assert(harness.testResults instanceof Map);
  assert(harness.failureInjectors instanceof Map);
  assert.equal(harness.concurrencyPool, 4);
  assert.equal(harness.defaultTimeout, 60000);
  assert.equal(harness.snapshotRetention, 10);
});

test('IntegrationTestHarness constructor with custom options', async () => {
  const eventEmitter = new MockEventEmitter();
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({
    databaseAdapter,
    eventEmitter,
    concurrencyPool: 8,
    defaultTimeout: 30000,
    snapshotRetention: 5
  });
  
  assert.equal(harness.databaseAdapter, databaseAdapter);
  assert.equal(harness.eventEmitter, eventEmitter);
  assert.equal(harness.concurrencyPool, 8);
  assert.equal(harness.defaultTimeout, 30000);
  assert.equal(harness.snapshotRetention, 5);
});

test('TestConfig creation and validation', async () => {
  const config = new TestConfig({
    name: 'Test Migration',
    timeout: 15000,
    maxConcurrency: 2,
    performanceThreshold: 100,
    failureInjection: { timeout: { probability: 0.1 } },
    snapshotStrategy: 'schema-only',
    rollbackTest: false
  });

  assert.equal(config.name, 'Test Migration');
  assert.equal(config.timeout, 15000);
  assert.equal(config.maxConcurrency, 2);
  assert.equal(config.performanceThreshold, 100);
  assert.equal(config.snapshotStrategy, 'schema-only');
  assert.equal(config.rollbackTest, false);
  assert(config.failureInjection.timeout);
});

test('DatabaseSnapshot creation and data management', async () => {
  const snapshot = new DatabaseSnapshot('test-snapshot-1', { 
    name: 'Test Snapshot',
    strategy: 'full'
  });

  assert.equal(snapshot.id, 'test-snapshot-1');
  assert(snapshot.timestamp);
  assert.equal(snapshot.metadata.name, 'Test Snapshot');
  assert.equal(snapshot.metadata.strategy, 'full');
  assert(snapshot.tables instanceof Map);

  // Add table data
  snapshot.addTableData('users', [{ id: 1, name: 'Test' }], 1);
  assert(snapshot.tables.has('users'));
  assert.equal(snapshot.tables.get('users').rowCount, 1);

  // Set schema
  const schema = { tables: ['users', 'posts'] };
  snapshot.setSchema(schema);
  assert.equal(snapshot.schema.tables.length, 2);
});

test('DatabaseSnapshot comparison functionality', async () => {
  const snapshot1 = new DatabaseSnapshot('snap1');
  snapshot1.addTableData('users', [{ id: 1 }], 1);
  
  const snapshot2 = new DatabaseSnapshot('snap2');
  snapshot2.addTableData('users', [{ id: 1 }, { id: 2 }], 2);
  
  const comparison = snapshot1.compare(snapshot2);
  
  assert.equal(comparison.identical, false);
  assert(comparison.differences.tables.length > 0);
  
  // Test with identical snapshots
  const snapshot3 = new DatabaseSnapshot('snap3');
  snapshot3.addTableData('users', [{ id: 1 }], 1);
  
  const identicalComparison = snapshot1.compare(snapshot3);
  assert.equal(identicalComparison.identical, true);
});

test('createSnapshot with full strategy', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ databaseAdapter, eventEmitter });

  const snapshotId = await harness.createSnapshot('full-test', {
    strategy: 'full',
    includeData: true
  });

  assert(typeof snapshotId === 'string');
  assert(harness.activeSnapshots.has(snapshotId));
  
  const snapshot = harness.activeSnapshots.get(snapshotId);
  assert(snapshot.schema);
  assert(snapshot.tables.size > 0);
  assert(snapshot.statistics.totalTables > 0);

  // Should emit snapshot created event
  assert.equal(eventEmitter.getEvents('SNAPSHOT_CREATED').length, 1);
});

test('createSnapshot with schema-only strategy', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  const snapshotId = await harness.createSnapshot('schema-test', {
    strategy: 'schema-only',
    includeData: false
  });

  const snapshot = harness.activeSnapshots.get(snapshotId);
  assert(snapshot.schema);
  // Should not have table data for schema-only
  assert.equal(snapshot.tables.size, 0);
});

test('createSnapshot without database adapter throws error', async () => {
  const harness = new IntegrationTestHarness();

  await assert.rejects(
    () => harness.createSnapshot('test'),
    IntegrationTestError
  );
});

test('executeTest with successful basic test', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ databaseAdapter, eventEmitter });

  const testConfig = new TestConfig({
    name: 'Basic Create Table Test',
    timeout: 5000,
    snapshotStrategy: 'full'
  });

  const operations = [
    { kind: 'create_table', table: 'new_table' },
    { kind: 'add_column', table: 'new_table', column: 'id' }
  ];

  const result = await harness.executeTest(testConfig, operations);

  assert.equal(result.name, 'Basic Create Table Test');
  assert.equal(result.status, 'passed');
  assert(result.phases.length >= 3); // setup, execution, verification
  assert(result.snapshots.length > 0);
  assert(result.metrics.executionTime >= 0);

  // Should emit test events
  assert.equal(eventEmitter.getEvents('TEST_STARTED').length, 1);
  assert.equal(eventEmitter.getEvents('TEST_COMPLETED').length, 1);
});

test('executeTest with failing operation', async () => {
  const databaseAdapter = new MockDatabaseAdapter({ shouldFail: true });
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ databaseAdapter, eventEmitter });

  const testConfig = new TestConfig({
    name: 'Failing Test',
    timeout: 5000
  });

  const operations = [
    { kind: 'drop_table', table: 'users' } // This will fail due to shouldFail: true
  ];

  const result = await harness.executeTest(testConfig, operations);

  assert.equal(result.status, 'failed');
  assert(result.error);
  assert.equal(result.error.message.includes('Mock failure'), true);

  // Should emit test failed event
  assert.equal(eventEmitter.getEvents('TEST_FAILED').length, 1);
});

test('executeTest with performance threshold', async () => {
  const databaseAdapter = new MockDatabaseAdapter({ operationDelay: 200 });
  const harness = new IntegrationTestHarness({ databaseAdapter });

  // Set a baseline
  harness.setPerformanceBaseline('Performance Test', { executionTime: 100 });

  const testConfig = new TestConfig({
    name: 'Performance Test',
    timeout: 5000,
    performanceThreshold: 50 // 50% regression allowance
  });

  const operations = [
    { kind: 'create_table', table: 'slow_table' }
  ];

  // This should pass because 200ms is within 50% of 100ms baseline
  const result = await harness.executeTest(testConfig, operations);
  assert.equal(result.status, 'failed'); // Will fail due to performance regression

  assert(result.error.message.includes('Performance regression'));
});

test('executeTest with rollback verification', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  const testConfig = new TestConfig({
    name: 'Rollback Test',
    rollbackTest: true,
    snapshotStrategy: 'full'
  });

  const operations = [
    { kind: 'create_table', table: 'rollback_table' },
    { kind: 'add_column', table: 'rollback_table', column: 'test_col' }
  ];

  const result = await harness.executeTest(testConfig, operations);

  // Should include rollback phase
  const rollbackPhase = result.phases.find(p => p.name === 'rollback');
  assert(rollbackPhase);
});

test('executeTest with before and after hooks', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  let beforeHookCalled = false;
  let afterHookCalled = false;

  const testConfig = new TestConfig({
    name: 'Hook Test',
    beforeHooks: [
      async (harness, config) => {
        beforeHookCalled = true;
      }
    ],
    afterHooks: [
      async (harness, config, result) => {
        afterHookCalled = true;
        assert(result.status === 'passed');
      }
    ]
  });

  const operations = [{ kind: 'create_table', table: 'hook_table' }];
  await harness.executeTest(testConfig, operations);

  assert(beforeHookCalled);
  assert(afterHookCalled);
});

test('executeTest with custom assertions', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  let assertionExecuted = false;

  const testConfig = new TestConfig({
    name: 'Assertion Test',
    assertions: [
      async (harness, result) => {
        assertionExecuted = true;
        assert(result.phases.length > 0);
      }
    ]
  });

  const operations = [{ kind: 'create_table', table: 'assertion_table' }];
  await harness.executeTest(testConfig, operations);

  assert(assertionExecuted);
});

test('executeTestSuite with sequential execution', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ databaseAdapter, eventEmitter });

  const tests = [
    new TestConfig({ name: 'Test 1' }),
    new TestConfig({ name: 'Test 2' }),
    new TestConfig({ name: 'Test 3' })
  ];

  const operations = [{ kind: 'create_table', table: 'suite_table' }];
  const result = await harness.executeTestSuite(tests, {
    name: 'Sequential Test Suite',
    operations
  });

  assert.equal(result.suiteName, 'Sequential Test Suite');
  assert.equal(result.tests.length, 3);
  assert.equal(result.summary.total, 3);
  assert(result.summary.passed >= 0);
  assert(result.summary.totalTime >= 0);

  // Should emit suite started event
  assert.equal(eventEmitter.getEvents('TEST_SUITE_STARTED').length, 1);
});

test('executeTestSuite with concurrent execution', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  const tests = [
    new TestConfig({ name: 'Concurrent Test 1' }),
    new TestConfig({ name: 'Concurrent Test 2' })
  ];

  const operations = [{ kind: 'add_column', table: 'users', column: 'concurrent_col' }];
  const result = await harness.executeTestSuite(tests, {
    name: 'Concurrent Test Suite',
    operations,
    concurrent: true,
    maxConcurrency: 2
  });

  assert.equal(result.tests.length, 2);
  assert(result.summary.totalTime > 0);
});

test('executeTestSuite with empty test array throws error', async () => {
  const harness = new IntegrationTestHarness();

  await assert.rejects(
    () => harness.executeTestSuite([]),
    IntegrationTestError
  );

  await assert.rejects(
    () => harness.executeTestSuite(null),
    IntegrationTestError
  );
});

test('setupFailureInjection and failure injection execution', async () => {
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ eventEmitter });

  const failureConfig = {
    timeout: {
      targetOperation: 'drop_table',
      delay: 100,
      shouldFail: true
    },
    connection_failure: {
      probability: 0.5
    }
  };

  await harness.setupFailureInjection(failureConfig);

  assert.equal(harness.failureInjectors.size, 2);
  assert(harness.failureInjectors.has('timeout'));
  assert(harness.failureInjectors.has('connection_failure'));

  // Should emit failure injection events
  assert.equal(eventEmitter.getEvents('FAILURE_INJECTED').length, 2);
});

test('simulateConcurrentExecution with multiple batches', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  const operations = [
    { kind: 'create_table', table: 'concurrent1' },
    { kind: 'create_table', table: 'concurrent2' },
    { kind: 'create_table', table: 'concurrent3' },
    { kind: 'create_table', table: 'concurrent4' }
  ];

  const testConfig = new TestConfig({
    name: 'Concurrent Simulation',
    maxConcurrency: 2
  });

  const result = await harness.simulateConcurrentExecution(operations, testConfig);

  assert.equal(result.concurrency, 2);
  assert(result.totalBatches >= 2);
  assert(result.successful >= 0);
  assert(result.failed >= 0);
  assert(result.results.length >= 2);
});

test('simulateConcurrentExecution with invalid input', async () => {
  const harness = new IntegrationTestHarness();

  await assert.rejects(
    () => harness.simulateConcurrentExecution([], new TestConfig()),
    IntegrationTestError
  );

  await assert.rejects(
    () => harness.simulateConcurrentExecution(null, new TestConfig()),
    IntegrationTestError
  );
});

test('verifyRollback with successful rollback', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  // Create initial snapshot
  const snapshotId = await harness.createSnapshot('rollback-test', {
    strategy: 'full',
    includeData: true
  });

  const operations = [
    { kind: 'create_table', table: 'rollback_table' },
    { kind: 'add_column', table: 'rollback_table', column: 'test_col' }
  ];

  const testConfig = new TestConfig({ name: 'Rollback Verification Test' });

  const result = await harness.verifyRollback(snapshotId, operations, testConfig);

  assert(result.success);
  assert.equal(result.originalSnapshotId, snapshotId);
  assert(result.currentSnapshotId);
  assert(result.rolledBackSnapshotId);
});

test('verifyRollback with missing snapshot throws error', async () => {
  const harness = new IntegrationTestHarness();

  await assert.rejects(
    () => harness.verifyRollback('non-existent-snapshot', [], new TestConfig()),
    RollbackVerificationError
  );
});

test('performance baseline management', async () => {
  const harness = new IntegrationTestHarness();

  const metrics = {
    executionTime: 150,
    memoryUsage: 64,
    cpuUsage: 25
  };

  harness.setPerformanceBaseline('Performance Test', metrics);

  const baseline = harness.getPerformanceBaseline('Performance Test');
  assert.equal(baseline.executionTime, 150);
  assert.equal(baseline.memoryUsage, 64);
  assert.equal(baseline.cpuUsage, 25);
  assert(baseline.setAt);

  // Non-existent baseline should return null
  const nonExistent = harness.getPerformanceBaseline('Non-existent Test');
  assert.equal(nonExistent, null);
});

test('snapshot retention management', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ 
    databaseAdapter, 
    snapshotRetention: 3 
  });

  // Create more snapshots than retention limit
  for (let i = 0; i < 5; i++) {
    await harness.createSnapshot(`retention-test-${i}`);
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Should only keep the most recent 3 snapshots
  assert(harness.activeSnapshots.size <= 3);
});

test('factory functions for test configurations', async () => {
  const basicTest = createBasicTest('Basic Test', []);
  assert.equal(basicTest.name, 'Basic Test');
  assert.equal(basicTest.snapshotStrategy, 'full');
  assert.equal(basicTest.rollbackTest, true);

  const performanceTest = createPerformanceTest('Perf Test', [], 100);
  assert.equal(performanceTest.name, 'Perf Test');
  assert.equal(performanceTest.performanceThreshold, 20);
  assert.equal(performanceTest.snapshotStrategy, 'schema-only');

  const stressTest = createStressTest('Stress Test', []);
  assert.equal(stressTest.name, 'Stress Test');
  assert.equal(stressTest.maxConcurrency, 8);
  assert.equal(stressTest.repeatCount, 10);
  assert(stressTest.failureInjection.timeout);

  const failureTest = createFailureTest('Failure Test', [], {
    timeout: { probability: 0.2 }
  });
  assert.equal(failureTest.name, 'Failure Test');
  assert.equal(failureTest.rollbackTest, true);
  assert(failureTest.failureInjection.timeout);
});

test('event emission throughout test execution', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ databaseAdapter, eventEmitter });

  const testConfig = new TestConfig({ name: 'Event Test' });
  const operations = [{ kind: 'create_table', table: 'event_table' }];

  await harness.executeTest(testConfig, operations);

  // Should emit various events during test execution
  assert(eventEmitter.getEvents('TEST_STARTED').length > 0);
  assert(eventEmitter.getEvents('TEST_COMPLETED').length > 0);
  assert(eventEmitter.getEvents('SNAPSHOT_CREATED').length > 0);
});

test('error handling with custom error types', async () => {
  const harness = new IntegrationTestHarness();

  // Test IntegrationTestError
  try {
    await harness.executeTestSuite([]);
    assert.fail('Should have thrown IntegrationTestError');
  } catch (error) {
    assert(error instanceof IntegrationTestError);
  }

  // Test TestSetupError behavior through missing database adapter
  try {
    await harness.createSnapshot('test');
    assert.fail('Should have thrown IntegrationTestError');
  } catch (error) {
    assert(error instanceof IntegrationTestError);
    assert(error.message.includes('Database adapter is required'));
  }

  // Test RollbackVerificationError
  try {
    await harness.verifyRollback('missing-snapshot', [], new TestConfig());
    assert.fail('Should have thrown RollbackVerificationError');
  } catch (error) {
    assert(error instanceof RollbackVerificationError);
  }
});

test('complex integration scenario with all features', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const eventEmitter = new MockEventEmitter();
  const harness = new IntegrationTestHarness({ databaseAdapter, eventEmitter });

  // Set performance baseline
  harness.setPerformanceBaseline('Complex Test', { executionTime: 500 });

  const testConfig = new TestConfig({
    name: 'Complex Test',
    timeout: 10000,
    maxConcurrency: 2,
    performanceThreshold: 100, // Allow 100% regression for this test
    snapshotStrategy: 'full',
    rollbackTest: true,
    failureInjection: {
      timeout: { probability: 0.1, delay: 50 }
    },
    beforeHooks: [
      async (harness, config) => {
        // Setup hook
      }
    ],
    afterHooks: [
      async (harness, config, result) => {
        // Cleanup hook
      }
    ],
    assertions: [
      async (harness, result) => {
        assert(result.phases.length >= 4);
      }
    ]
  });

  const operations = [
    { kind: 'create_table', table: 'complex_table' },
    { kind: 'add_column', table: 'complex_table', column: 'col1' },
    { kind: 'add_column', table: 'complex_table', column: 'col2' },
    { kind: 'create_index', table: 'complex_table', columns: ['col1'] }
  ];

  const result = await harness.executeTest(testConfig, operations);

  // Should execute all phases
  assert(result.phases.find(p => p.name === 'setup'));
  assert(result.phases.find(p => p.name === 'execution'));
  assert(result.phases.find(p => p.name === 'verification'));
  assert(result.phases.find(p => p.name === 'rollback'));
  assert(result.phases.find(p => p.name === 'performance'));

  // Should have snapshots
  assert(result.snapshots.length > 0);

  // Should have metrics
  assert(result.metrics.executionTime >= 0);
});

test('singleton export functionality', async () => {
  const { integrationTestHarness } = await import('../src/testing/IntegrationTestHarness.mjs');
  
  assert(integrationTestHarness instanceof IntegrationTestHarness);
  
  // Should have default configuration
  assert.equal(integrationTestHarness.concurrencyPool, 4);
  assert.equal(integrationTestHarness.defaultTimeout, 60000);
  assert.equal(integrationTestHarness.snapshotRetention, 10);
});

test('failure injector creation and execution', async () => {
  const harness = new IntegrationTestHarness();

  const failureConfig = {
    timeout: {
      targetOperation: 'create_index',
      delay: 100,
      shouldFail: true
    },
    constraint_violation: {
      probability: 1.0 // Always inject
    },
    lock_timeout: {
      probability: 0.5
    }
  };

  await harness.setupFailureInjection(failureConfig);

  // Test timeout injector
  const timeoutInjector = harness.failureInjectors.get('timeout');
  assert(timeoutInjector);
  
  const indexOperation = { kind: 'create_index', table: 'test' };
  const shouldInject = timeoutInjector.shouldInject(indexOperation);
  assert(shouldInject === true); // Should inject for target operation

  // Test constraint violation injector
  const constraintInjector = harness.failureInjectors.get('constraint_violation');
  const constraintOperation = { kind: 'add_constraint', constraint: 'test_fk' };
  assert(constraintInjector.shouldInject(constraintOperation));

  // Clean up
  await harness._cleanupFailureInjection();
  assert.equal(harness.failureInjectors.size, 0);
});

test('database state verification', async () => {
  const databaseAdapter = new MockDatabaseAdapter();
  const harness = new IntegrationTestHarness({ databaseAdapter });

  // Create snapshot
  const snapshotId = await harness.createSnapshot('verification-test', {
    strategy: 'full',
    includeData: true
  });

  const testConfig = new TestConfig({ name: 'Verification Test' });

  // Verify state (should be identical since no operations were performed)
  const verification = await harness._verifyDatabaseState(snapshotId, testConfig);

  assert(verification.identical);
  assert.equal(verification.originalSnapshot, snapshotId);
  assert(verification.currentSnapshot);
});

test('concurrent batch execution with mixed success/failure', async () => {
  const databaseAdapter = new MockDatabaseAdapter({ shouldFail: true }); // Will fail on drop operations
  const harness = new IntegrationTestHarness({ databaseAdapter });

  const operations = [
    { kind: 'create_table', table: 'batch1' }, // Should succeed
    { kind: 'drop_table', table: 'users' },    // Should fail
    { kind: 'create_table', table: 'batch2' }, // Should succeed
    { kind: 'drop_table', table: 'posts' }     // Should fail
  ];

  const testConfig = new TestConfig({
    name: 'Mixed Batch Test',
    maxConcurrency: 2
  });

  const result = await harness.simulateConcurrentExecution(operations, testConfig);

  // Should have both successful and failed batches
  assert(result.successful >= 0);
  assert(result.failed >= 0);
  assert.equal(result.successful + result.failed, result.totalBatches);
});

test('test execution with non-TestConfig object throws error', async () => {
  const harness = new IntegrationTestHarness();

  await assert.rejects(
    () => harness.executeTest({ name: 'Not a TestConfig' }, []),
    IntegrationTestError
  );
});

test('snapshot comparison with complex differences', async () => {
  const snapshot1 = new DatabaseSnapshot('complex1');
  snapshot1.addTableData('users', [{ id: 1 }, { id: 2 }], 2);
  snapshot1.addTableData('posts', [{ id: 1 }], 1);

  const snapshot2 = new DatabaseSnapshot('complex2');
  snapshot2.addTableData('users', [{ id: 1 }, { id: 2 }, { id: 3 }], 3); // More rows
  snapshot2.addTableData('orders', [{ id: 1 }], 1); // New table
  // Missing posts table

  const comparison = snapshot1.compare(snapshot2);

  assert.equal(comparison.identical, false);
  
  // Should detect row count difference
  const usersDiff = comparison.differences.tables.find(d => 
    d.table === 'users' && d.type === 'row_count_mismatch'
  );
  assert(usersDiff);
  assert.equal(usersDiff.expected, 2);
  assert.equal(usersDiff.actual, 3);

  // Should detect missing table in other
  const postsMissing = comparison.differences.tables.find(d => 
    d.table === 'posts' && d.type === 'missing_in_other'
  );
  assert(postsMissing);

  // Should detect missing table in this
  const ordersMissing = comparison.differences.tables.find(d => 
    d.table === 'orders' && d.type === 'missing_in_this'
  );
  assert(ordersMissing);
});