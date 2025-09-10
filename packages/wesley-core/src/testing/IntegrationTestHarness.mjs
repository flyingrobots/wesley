/**
 * IntegrationTestHarness - Testing Component
 * 
 * End-to-end migration testing framework with:
 * - Concurrent execution simulation
 * - Failure injection capabilities  
 * - Performance regression detection
 * - Database state snapshots
 * - Rollback verification
 * 
 * Licensed under Apache-2.0
 */

import { DomainEvent } from '../domain/Events.mjs';

/**
 * Custom error types for integration testing
 */
export class IntegrationTestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'IntegrationTestError';
    this.details = details;
  }
}

export class TestSetupError extends IntegrationTestError {
  constructor(message, testName) {
    super(`Test setup failed for '${testName}': ${message}`);
    this.testName = testName;
  }
}

export class TestExecutionError extends IntegrationTestError {
  constructor(message, testName, phase) {
    super(`Test execution failed for '${testName}' in phase '${phase}': ${message}`);
    this.testName = testName;
    this.phase = phase;
  }
}

export class PerformanceRegressionError extends IntegrationTestError {
  constructor(testName, expected, actual) {
    super(`Performance regression in '${testName}': expected ${expected}ms, got ${actual}ms`);
    this.testName = testName;
    this.expectedTime = expected;
    this.actualTime = actual;
  }
}

export class RollbackVerificationError extends IntegrationTestError {
  constructor(message, snapshotId) {
    super(`Rollback verification failed: ${message}`);
    this.snapshotId = snapshotId;
  }
}

/**
 * Domain events for integration testing
 */
export class TestSuiteStarted extends DomainEvent {
  constructor(suiteName, testCount) {
    super('TEST_SUITE_STARTED', { suiteName, testCount });
  }
}

export class TestStarted extends DomainEvent {
  constructor(testName, config) {
    super('TEST_STARTED', { testName, config });
  }
}

export class TestCompleted extends DomainEvent {
  constructor(testName, result, metrics) {
    super('TEST_COMPLETED', { testName, result, metrics });
  }
}

export class TestFailed extends DomainEvent {
  constructor(testName, error, phase) {
    super('TEST_FAILED', { testName, error: error.message, phase });
  }
}

export class SnapshotCreated extends DomainEvent {
  constructor(snapshotId, metadata) {
    super('SNAPSHOT_CREATED', { snapshotId, metadata });
  }
}

export class FailureInjected extends DomainEvent {
  constructor(failureType, targetOperation, config) {
    super('FAILURE_INJECTED', { failureType, targetOperation, config });
  }
}

export class PerformanceBaseline extends DomainEvent {
  constructor(testName, metrics) {
    super('PERFORMANCE_BASELINE', { testName, metrics });
  }
}

/**
 * Database snapshot for state verification
 */
export class DatabaseSnapshot {
  constructor(id, metadata = {}) {
    this.id = id;
    this.timestamp = new Date().toISOString();
    this.metadata = metadata;
    this.tables = new Map();
    this.schema = null;
    this.constraints = [];
    this.indexes = [];
    this.statistics = {};
  }

  addTableData(tableName, data, rowCount) {
    this.tables.set(tableName, {
      data: data,
      rowCount: rowCount,
      capturedAt: new Date().toISOString()
    });
  }

  setSchema(schema) {
    this.schema = schema;
  }

  addConstraints(constraints) {
    this.constraints = constraints;
  }

  addIndexes(indexes) {
    this.indexes = indexes;
  }

  setStatistics(stats) {
    this.statistics = stats;
  }

  compare(otherSnapshot) {
    const differences = {
      tables: [],
      schema: [],
      constraints: [],
      indexes: [],
      statistics: []
    };

    // Compare tables
    for (const [tableName, tableData] of this.tables) {
      const otherTable = otherSnapshot.tables.get(tableName);
      
      if (!otherTable) {
        differences.tables.push({
          table: tableName,
          type: 'missing_in_other',
          details: `Table ${tableName} exists in this snapshot but not in other`
        });
        continue;
      }

      if (tableData.rowCount !== otherTable.rowCount) {
        differences.tables.push({
          table: tableName,
          type: 'row_count_mismatch',
          expected: tableData.rowCount,
          actual: otherTable.rowCount
        });
      }
    }

    // Check for tables only in other snapshot
    for (const [tableName] of otherSnapshot.tables) {
      if (!this.tables.has(tableName)) {
        differences.tables.push({
          table: tableName,
          type: 'missing_in_this',
          details: `Table ${tableName} exists in other snapshot but not in this`
        });
      }
    }

    return {
      identical: Object.values(differences).every(arr => arr.length === 0),
      differences
    };
  }
}

/**
 * Test configuration for different test scenarios
 */
export class TestConfig {
  constructor(options = {}) {
    this.name = options.name || 'Unnamed Test';
    this.timeout = options.timeout || 30000; // 30 seconds
    this.maxConcurrency = options.maxConcurrency || 4;
    this.performanceThreshold = options.performanceThreshold || null; // ms
    this.failureInjection = options.failureInjection || {};
    this.snapshotStrategy = options.snapshotStrategy || 'full'; // 'full', 'schema-only', 'none'
    this.rollbackTest = options.rollbackTest ?? true;
    this.repeatCount = options.repeatCount || 1;
    this.warmupRuns = options.warmupRuns || 0;
    this.isolation = options.isolation || 'read_committed';
    this.beforeHooks = options.beforeHooks || [];
    this.afterHooks = options.afterHooks || [];
    this.assertions = options.assertions || [];
  }
}

/**
 * IntegrationTestHarness - End-to-end migration testing framework
 */
export class IntegrationTestHarness {
  constructor(options = {}) {
    this.databaseAdapter = options.databaseAdapter || null;
    this.eventEmitter = options.eventEmitter || null;
    this.performanceBaselines = new Map();
    this.activeSnapshots = new Map();
    this.testResults = new Map();
    this.failureInjectors = new Map();
    this.concurrencyPool = options.concurrencyPool || 4;
    this.defaultTimeout = options.defaultTimeout || 60000; // 1 minute
    this.snapshotRetention = options.snapshotRetention || 10; // Keep 10 snapshots max
  }

  /**
   * Execute a complete integration test suite
   * @param {Array} tests - Array of test configurations
   * @param {Object} options - Suite options
   * @returns {Object} Test suite results
   */
  async executeTestSuite(tests, options = {}) {
    if (!Array.isArray(tests) || tests.length === 0) {
      throw new IntegrationTestError('Test suite must contain at least one test');
    }

    const suiteName = options.name || 'Integration Test Suite';
    const suiteStartTime = performance.now();

    this._emit(new TestSuiteStarted(suiteName, tests.length));

    const results = {
      suiteName,
      startTime: new Date().toISOString(),
      tests: [],
      summary: {
        total: tests.length,
        passed: 0,
        failed: 0,
        skipped: 0,
        totalTime: 0
      }
    };

    try {
      // Setup test environment
      await this._setupTestEnvironment(options);

      // Execute tests with concurrency control
      if (options.concurrent && tests.length > 1) {
        results.tests = await this._executeConcurrentTests(tests, options);
      } else {
        results.tests = await this._executeSequentialTests(tests, options);
      }

      // Calculate summary
      results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
      results.summary.failed = results.tests.filter(t => t.status === 'failed').length;
      results.summary.skipped = results.tests.filter(t => t.status === 'skipped').length;
      results.summary.totalTime = performance.now() - suiteStartTime;

    } catch (error) {
      throw new IntegrationTestError(`Test suite execution failed: ${error.message}`, {
        suiteName,
        originalError: error
      });
    } finally {
      // Cleanup test environment
      await this._cleanupTestEnvironment(options);
    }

    return results;
  }

  /**
   * Execute a single integration test
   * @param {TestConfig} testConfig - Test configuration
   * @param {Object} operations - Migration operations to test
   * @param {Object} options - Execution options
   * @returns {Object} Test result
   */
  async executeTest(testConfig, operations, options = {}) {
    if (!(testConfig instanceof TestConfig)) {
      throw new IntegrationTestError('testConfig must be an instance of TestConfig');
    }

    const testStartTime = performance.now();
    this._emit(new TestStarted(testConfig.name, testConfig));

    const result = {
      name: testConfig.name,
      startTime: new Date().toISOString(),
      status: 'running',
      phases: [],
      snapshots: [],
      metrics: {},
      error: null
    };

    try {
      // Phase 1: Setup and snapshot
      await this._executeTestPhase(result, 'setup', async () => {
        if (testConfig.snapshotStrategy !== 'none') {
          const snapshotId = await this.createSnapshot(testConfig.name, {
            strategy: testConfig.snapshotStrategy,
            includeData: testConfig.snapshotStrategy === 'full'
          });
          result.snapshots.push(snapshotId);
        }

        // Run before hooks
        for (const hook of testConfig.beforeHooks) {
          await hook(this, testConfig);
        }
      });

      // Phase 2: Execute operations with potential failure injection
      await this._executeTestPhase(result, 'execution', async () => {
        if (Object.keys(testConfig.failureInjection).length > 0) {
          await this._setupFailureInjection(testConfig.failureInjection);
        }

        // Execute with concurrency simulation if configured
        if (testConfig.maxConcurrency > 1) {
          await this._executeConcurrentOperations(operations, testConfig);
        } else {
          await this._executeSequentialOperations(operations, testConfig);
        }
      });

      // Phase 3: Verification
      await this._executeTestPhase(result, 'verification', async () => {
        // Run custom assertions
        for (const assertion of testConfig.assertions) {
          await assertion(this, result);
        }

        // Verify database state if snapshot exists
        if (result.snapshots.length > 0) {
          await this._verifyDatabaseState(result.snapshots[0], testConfig);
        }
      });

      // Phase 4: Rollback testing (if enabled)
      if (testConfig.rollbackTest) {
        await this._executeTestPhase(result, 'rollback', async () => {
          await this._testRollbackCapability(result.snapshots[0], operations, testConfig);
        });
      }

      // Phase 5: Performance analysis
      await this._executeTestPhase(result, 'performance', async () => {
        const executionTime = performance.now() - testStartTime;
        result.metrics.executionTime = executionTime;

        await this._analyzePerformance(testConfig, executionTime);
      });

      result.status = 'passed';

    } catch (error) {
      result.status = 'failed';
      result.error = {
        message: error.message,
        type: error.constructor.name,
        details: error.details || {}
      };

      this._emit(new TestFailed(testConfig.name, error, result.phases[result.phases.length - 1]?.name || 'unknown'));

    } finally {
      // Run after hooks
      try {
        for (const hook of testConfig.afterHooks) {
          await hook(this, testConfig, result);
        }
      } catch (hookError) {
        console.warn(`After hook failed for test ${testConfig.name}:`, hookError);
      }

      // Cleanup failure injections
      await this._cleanupFailureInjection();

      result.endTime = new Date().toISOString();
      result.duration = performance.now() - testStartTime;
    }

    this._emit(new TestCompleted(testConfig.name, result, result.metrics));
    return result;
  }

  /**
   * Create a database snapshot for state verification
   * @param {string} name - Snapshot name
   * @param {Object} options - Snapshot options
   * @returns {string} Snapshot ID
   */
  async createSnapshot(name, options = {}) {
    if (!this.databaseAdapter) {
      throw new IntegrationTestError('Database adapter is required for snapshots');
    }

    const snapshotId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const snapshot = new DatabaseSnapshot(snapshotId, {
      name,
      strategy: options.strategy || 'full',
      createdBy: 'IntegrationTestHarness'
    });

    try {
      // Capture schema information
      if (options.strategy === 'full' || options.strategy === 'schema-only') {
        const schema = await this.databaseAdapter.getSchema();
        snapshot.setSchema(schema);

        const constraints = await this.databaseAdapter.getConstraints();
        snapshot.addConstraints(constraints);

        const indexes = await this.databaseAdapter.getIndexes();
        snapshot.addIndexes(indexes);
      }

      // Capture data if full snapshot
      if (options.strategy === 'full' && options.includeData) {
        const tables = await this.databaseAdapter.getTables();
        
        for (const table of tables) {
          const data = await this.databaseAdapter.getTableData(table.name, {
            limit: 1000, // Reasonable limit for testing
            includeSchema: true
          });
          
          const rowCount = await this.databaseAdapter.getRowCount(table.name);
          snapshot.addTableData(table.name, data, rowCount);
        }
      }

      // Capture database statistics
      const stats = await this.databaseAdapter.getDatabaseStatistics();
      snapshot.setStatistics(stats);

      // Store snapshot
      this.activeSnapshots.set(snapshotId, snapshot);

      // Manage snapshot retention
      await this._manageSnapshotRetention();

      this._emit(new SnapshotCreated(snapshotId, snapshot.metadata));

      return snapshotId;

    } catch (error) {
      throw new IntegrationTestError(`Failed to create snapshot ${snapshotId}: ${error.message}`, {
        snapshotId,
        originalError: error
      });
    }
  }

  /**
   * Setup failure injection for testing error scenarios
   * @param {Object} failureConfig - Failure injection configuration
   */
  async setupFailureInjection(failureConfig) {
    const injectors = {
      timeout: this._createTimeoutInjector,
      connection_failure: this._createConnectionFailureInjector,
      constraint_violation: this._createConstraintViolationInjector,
      lock_timeout: this._createLockTimeoutInjector,
      disk_full: this._createDiskFullInjector,
      memory_pressure: this._createMemoryPressureInjector
    };

    for (const [failureType, config] of Object.entries(failureConfig)) {
      if (injectors[failureType]) {
        const injector = injectors[failureType].call(this, config);
        this.failureInjectors.set(failureType, injector);
        
        this._emit(new FailureInjected(failureType, config.targetOperation, config));
      }
    }
  }

  /**
   * Simulate concurrent execution scenarios
   * @param {Array} operations - Operations to execute concurrently
   * @param {TestConfig} testConfig - Test configuration
   */
  async simulateConcurrentExecution(operations, testConfig) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new IntegrationTestError('Operations array is required for concurrent simulation');
    }

    const concurrency = Math.min(testConfig.maxConcurrency, operations.length);
    const batches = this._createConcurrentBatches(operations, concurrency);
    
    const results = await Promise.allSettled(
      batches.map(async (batch, batchIndex) => {
        return this._executeConcurrentBatch(batch, batchIndex, testConfig);
      })
    );

    // Analyze concurrent execution results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      totalBatches: batches.length,
      successful,
      failed,
      concurrency,
      results
    };
  }

  /**
   * Verify rollback capability
   * @param {string} snapshotId - Snapshot to rollback to
   * @param {Array} operations - Operations that were executed
   * @param {TestConfig} testConfig - Test configuration
   */
  async verifyRollback(snapshotId, operations, testConfig) {
    if (!this.activeSnapshots.has(snapshotId)) {
      throw new RollbackVerificationError('Snapshot not found', snapshotId);
    }

    if (!this.databaseAdapter) {
      throw new IntegrationTestError('Database adapter is required for rollback verification');
    }

    const originalSnapshot = this.activeSnapshots.get(snapshotId);
    
    try {
      // Create current state snapshot
      const currentSnapshotId = await this.createSnapshot(`${testConfig.name}_before_rollback`);
      
      // Execute rollback operations (reverse of original operations)
      const rollbackOperations = this._generateRollbackOperations(operations);
      await this._executeSequentialOperations(rollbackOperations, testConfig);
      
      // Create post-rollback snapshot
      const rolledBackSnapshotId = await this.createSnapshot(`${testConfig.name}_after_rollback`);
      const rolledBackSnapshot = this.activeSnapshots.get(rolledBackSnapshotId);
      
      // Compare with original snapshot
      const comparison = originalSnapshot.compare(rolledBackSnapshot);
      
      if (!comparison.identical) {
        throw new RollbackVerificationError(
          `Rollback verification failed: ${JSON.stringify(comparison.differences)}`,
          snapshotId
        );
      }

      return {
        success: true,
        originalSnapshotId: snapshotId,
        currentSnapshotId,
        rolledBackSnapshotId,
        differences: comparison.differences
      };

    } catch (error) {
      throw new RollbackVerificationError(
        `Rollback verification process failed: ${error.message}`,
        snapshotId
      );
    }
  }

  /**
   * Set performance baseline for regression testing
   * @param {string} testName - Test name
   * @param {Object} metrics - Performance metrics
   */
  setPerformanceBaseline(testName, metrics) {
    this.performanceBaselines.set(testName, {
      ...metrics,
      setAt: new Date().toISOString()
    });

    this._emit(new PerformanceBaseline(testName, metrics));
  }

  /**
   * Get performance baseline for a test
   * @param {string} testName - Test name
   * @returns {Object|null} Baseline metrics or null if not set
   */
  getPerformanceBaseline(testName) {
    return this.performanceBaselines.get(testName) || null;
  }

  /**
   * Execute test phase with error handling
   * @private
   */
  async _executeTestPhase(result, phaseName, phaseFunction) {
    const phaseStartTime = performance.now();
    const phase = {
      name: phaseName,
      startTime: new Date().toISOString(),
      status: 'running'
    };

    result.phases.push(phase);

    try {
      await phaseFunction();
      phase.status = 'completed';
    } catch (error) {
      phase.status = 'failed';
      phase.error = error.message;
      throw new TestExecutionError(error.message, result.name, phaseName);
    } finally {
      phase.endTime = new Date().toISOString();
      phase.duration = performance.now() - phaseStartTime;
    }
  }

  /**
   * Execute operations sequentially
   * @private
   */
  async _executeSequentialOperations(operations, testConfig) {
    for (const operation of operations) {
      if (this.failureInjectors.size > 0) {
        await this._checkFailureInjection(operation);
      }

      await this.databaseAdapter.executeOperation(operation, {
        timeout: testConfig.timeout,
        isolation: testConfig.isolation
      });
    }
  }

  /**
   * Execute operations with concurrency simulation
   * @private
   */
  async _executeConcurrentOperations(operations, testConfig) {
    const result = await this.simulateConcurrentExecution(operations, testConfig);
    
    if (result.failed > 0) {
      throw new TestExecutionError(
        `${result.failed} concurrent batches failed`,
        testConfig.name,
        'execution'
      );
    }

    return result;
  }

  /**
   * Analyze performance and check for regressions
   * @private
   */
  async _analyzePerformance(testConfig, executionTime) {
    const baseline = this.getPerformanceBaseline(testConfig.name);
    
    if (baseline && testConfig.performanceThreshold) {
      const threshold = testConfig.performanceThreshold;
      const regressionLimit = baseline.executionTime * (1 + threshold / 100);
      
      if (executionTime > regressionLimit) {
        throw new PerformanceRegressionError(
          testConfig.name,
          regressionLimit,
          executionTime
        );
      }
    }
  }

  /**
   * Generate rollback operations
   * @private
   */
  _generateRollbackOperations(operations) {
    return operations.slice().reverse().map(op => {
      const rollbackMap = {
        'create_table': { kind: 'drop_table', table: op.table },
        'drop_table': { kind: 'create_table', ...op },
        'add_column': { kind: 'drop_column', table: op.table, column: op.column },
        'drop_column': { kind: 'add_column', ...op },
        'add_constraint': { kind: 'drop_constraint', table: op.table, constraint: op.constraint },
        'drop_constraint': { kind: 'add_constraint', ...op }
      };

      return rollbackMap[op.kind] || op;
    });
  }

  /**
   * Create concurrent batches for parallel execution
   * @private
   */
  _createConcurrentBatches(operations, concurrency) {
    const batches = [];
    const batchSize = Math.ceil(operations.length / concurrency);
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Execute a concurrent batch
   * @private
   */
  async _executeConcurrentBatch(batch, batchIndex, testConfig) {
    const batchStartTime = performance.now();
    
    try {
      for (const operation of batch) {
        await this.databaseAdapter.executeOperation(operation, {
          timeout: testConfig.timeout / 2, // Shorter timeout for concurrent operations
          isolation: 'read_committed'
        });
      }

      return {
        batchIndex,
        operations: batch.length,
        executionTime: performance.now() - batchStartTime,
        success: true
      };

    } catch (error) {
      return {
        batchIndex,
        operations: batch.length,
        executionTime: performance.now() - batchStartTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Setup test environment
   * @private
   */
  async _setupTestEnvironment(options) {
    if (this.databaseAdapter && typeof this.databaseAdapter.setupTestEnvironment === 'function') {
      await this.databaseAdapter.setupTestEnvironment(options);
    }
  }

  /**
   * Cleanup test environment
   * @private
   */
  async _cleanupTestEnvironment(options) {
    if (this.databaseAdapter && typeof this.databaseAdapter.cleanupTestEnvironment === 'function') {
      await this.databaseAdapter.cleanupTestEnvironment(options);
    }
  }

  /**
   * Execute tests sequentially
   * @private
   */
  async _executeSequentialTests(tests, options) {
    const results = [];
    
    for (const testConfig of tests) {
      const result = await this.executeTest(testConfig, options.operations || [], options);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Execute tests concurrently
   * @private
   */
  async _executeConcurrentTests(tests, options) {
    const concurrency = Math.min(options.maxConcurrency || this.concurrencyPool, tests.length);
    const results = [];
    
    for (let i = 0; i < tests.length; i += concurrency) {
      const batch = tests.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(testConfig => 
          this.executeTest(testConfig, options.operations || [], options)
        )
      );
      
      results.push(...batchResults.map(r => 
        r.status === 'fulfilled' ? r.value : { 
          status: 'failed', 
          error: r.reason?.message || 'Unknown error' 
        }
      ));
    }
    
    return results;
  }

  /**
   * Manage snapshot retention
   * @private
   */
  async _manageSnapshotRetention() {
    if (this.activeSnapshots.size > this.snapshotRetention) {
      const snapshots = Array.from(this.activeSnapshots.entries())
        .sort(([, a], [, b]) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const toDelete = snapshots.slice(0, snapshots.length - this.snapshotRetention);
      
      for (const [snapshotId] of toDelete) {
        this.activeSnapshots.delete(snapshotId);
      }
    }
  }

  /**
   * Setup failure injection for testing
   * @private
   */
  async _setupFailureInjection(failureConfig) {
    await this.setupFailureInjection(failureConfig);
  }

  /**
   * Cleanup failure injections
   * @private
   */
  async _cleanupFailureInjection() {
    this.failureInjectors.clear();
  }

  /**
   * Check if failure should be injected
   * @private
   */
  async _checkFailureInjection(operation) {
    for (const [failureType, injector] of this.failureInjectors) {
      if (injector.shouldInject(operation)) {
        await injector.inject(operation);
      }
    }
  }

  /**
   * Create timeout failure injector
   * @private
   */
  _createTimeoutInjector(config) {
    return {
      shouldInject: (operation) => {
        return config.targetOperation ? 
          operation.kind === config.targetOperation :
          Math.random() < (config.probability || 0.1);
      },
      inject: async (operation) => {
        await new Promise(resolve => setTimeout(resolve, config.delay || 5000));
        if (config.shouldFail) {
          throw new Error(`Simulated timeout for operation ${operation.kind}`);
        }
      }
    };
  }

  /**
   * Create connection failure injector
   * @private
   */
  _createConnectionFailureInjector(config) {
    return {
      shouldInject: (operation) => {
        return Math.random() < (config.probability || 0.05);
      },
      inject: async (operation) => {
        throw new Error(`Simulated connection failure during ${operation.kind}`);
      }
    };
  }

  /**
   * Create constraint violation injector
   * @private
   */
  _createConstraintViolationInjector(config) {
    return {
      shouldInject: (operation) => {
        return operation.kind === 'add_constraint' && 
               Math.random() < (config.probability || 0.1);
      },
      inject: async (operation) => {
        throw new Error(`Simulated constraint violation for ${operation.constraint}`);
      }
    };
  }

  /**
   * Create lock timeout injector
   * @private
   */
  _createLockTimeoutInjector(config) {
    return {
      shouldInject: (operation) => {
        return ['drop_table', 'alter_type'].includes(operation.kind) &&
               Math.random() < (config.probability || 0.05);
      },
      inject: async (operation) => {
        throw new Error(`Simulated lock timeout for ${operation.kind} on ${operation.table}`);
      }
    };
  }

  /**
   * Create disk full injector
   * @private
   */
  _createDiskFullInjector(config) {
    return {
      shouldInject: (operation) => {
        return ['create_table', 'add_column'].includes(operation.kind) &&
               Math.random() < (config.probability || 0.02);
      },
      inject: async (operation) => {
        throw new Error(`Simulated disk full error during ${operation.kind}`);
      }
    };
  }

  /**
   * Create memory pressure injector
   * @private
   */
  _createMemoryPressureInjector(config) {
    return {
      shouldInject: (operation) => {
        return operation.kind === 'create_index' &&
               Math.random() < (config.probability || 0.05);
      },
      inject: async (operation) => {
        throw new Error(`Simulated out of memory error during index creation`);
      }
    };
  }

  /**
   * Verify database state against snapshot
   * @private
   */
  async _verifyDatabaseState(snapshotId, testConfig) {
    const snapshot = this.activeSnapshots.get(snapshotId);
    if (!snapshot) {
      throw new IntegrationTestError(`Snapshot ${snapshotId} not found`);
    }

    // Create current state snapshot and compare
    const currentSnapshotId = await this.createSnapshot(`${testConfig.name}_verification`, {
      strategy: snapshot.metadata.strategy,
      includeData: snapshot.metadata.strategy === 'full'
    });

    const currentSnapshot = this.activeSnapshots.get(currentSnapshotId);
    const comparison = snapshot.compare(currentSnapshot);

    return {
      identical: comparison.identical,
      differences: comparison.differences,
      originalSnapshot: snapshotId,
      currentSnapshot: currentSnapshotId
    };
  }

  /**
   * Test rollback capability
   * @private
   */
  async _testRollbackCapability(snapshotId, operations, testConfig) {
    return await this.verifyRollback(snapshotId, operations, testConfig);
  }

  /**
   * Emit event if emitter is configured
   * @private
   */
  _emit(event) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit(event.type, event);
    }
  }
}

// Export factory functions for common test configurations
export function createBasicTest(name, operations, options = {}) {
  return new TestConfig({
    name,
    timeout: 30000,
    snapshotStrategy: 'full',
    rollbackTest: true,
    ...options
  });
}

export function createPerformanceTest(name, operations, baselineMs, options = {}) {
  return new TestConfig({
    name,
    timeout: 60000,
    performanceThreshold: 20, // 20% regression allowance
    snapshotStrategy: 'schema-only',
    rollbackTest: false,
    ...options
  });
}

export function createStressTest(name, operations, options = {}) {
  return new TestConfig({
    name,
    timeout: 120000,
    maxConcurrency: 8,
    repeatCount: 10,
    snapshotStrategy: 'schema-only',
    failureInjection: {
      timeout: { probability: 0.1, delay: 1000 },
      connection_failure: { probability: 0.05 }
    },
    ...options
  });
}

export function createFailureTest(name, operations, failureConfig, options = {}) {
  return new TestConfig({
    name,
    timeout: 45000,
    snapshotStrategy: 'full',
    rollbackTest: true,
    failureInjection: failureConfig,
    ...options
  });
}

// Export singleton with default configuration
export const integrationTestHarness = new IntegrationTestHarness();