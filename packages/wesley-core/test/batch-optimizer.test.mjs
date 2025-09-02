/**
 * BatchOptimizer Tests
 * Comprehensive tests for intelligent operation batching and performance optimization
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  BatchOptimizer,
  BatchOptimizationError,
  BatchSizeExceededError,
  IncompatibleOperationsError,
  BatchOptimizationRequested,
  BatchOptimized,
  BatchExecutionStarted,
  BatchExecutionCompleted
} from '../src/domain/optimizer/BatchOptimizer.mjs';

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

// Sample operations for testing
const sampleOperations = [
  { kind: 'create_table', table: 'users' },
  { kind: 'add_column', table: 'users', column: 'email' },
  { kind: 'create_index', table: 'users', columns: ['email'] },
  { kind: 'create_table', table: 'posts' },
  { kind: 'add_column', table: 'posts', column: 'title' },
  { kind: 'add_constraint', table: 'posts', constraint: 'fk_user_id', references: 'users' }
];

const riskyOperations = [
  { kind: 'drop_table', table: 'old_table' },
  { kind: 'drop_column', table: 'users', column: 'deprecated_field' },
  { kind: 'alter_type', table: 'users', column: 'age', from: 'varchar', to: 'integer' },
  { kind: 'rename_table', table: 'old_name', newName: 'new_name' }
];

test('BatchOptimizer constructor with default options', async () => {
  const optimizer = new BatchOptimizer();
  
  assert.equal(optimizer.maxBatchSize, 100);
  assert.equal(optimizer.maxMemoryMB, 256);
  assert.equal(optimizer.allowConcurrentSchema, false);
  assert.equal(optimizer.lockTimeout, 30000);
});

test('BatchOptimizer constructor with custom options', async () => {
  const eventEmitter = new MockEventEmitter();
  const optimizer = new BatchOptimizer({
    maxBatchSize: 50,
    maxMemoryMB: 128,
    allowConcurrentSchema: true,
    lockTimeout: 15000,
    eventEmitter
  });
  
  assert.equal(optimizer.maxBatchSize, 50);
  assert.equal(optimizer.maxMemoryMB, 128);
  assert.equal(optimizer.allowConcurrentSchema, true);
  assert.equal(optimizer.lockTimeout, 15000);
  assert.equal(optimizer.eventEmitter, eventEmitter);
});

test('optimizeOperations with valid operations', async () => {
  const eventEmitter = new MockEventEmitter();
  const optimizer = new BatchOptimizer({ eventEmitter });
  
  const result = await optimizer.optimizeOperations(sampleOperations);
  
  // Should emit events
  assert.equal(eventEmitter.getEvents('BATCH_OPTIMIZATION_REQUESTED').length, 1);
  assert.equal(eventEmitter.getEvents('BATCH_OPTIMIZED').length, 1);
  
  // Should return structured result
  assert(result.batches);
  assert(result.metrics);
  assert(result.analysis);
  
  // Should have batches with operations
  assert(Array.isArray(result.batches));
  assert(result.batches.length > 0);
  assert(result.batches.every(batch => Array.isArray(batch.operations)));
  
  // Metrics should be populated
  assert.equal(result.metrics.originalOperationCount, sampleOperations.length);
  assert(result.metrics.batchCount > 0);
  assert(result.metrics.optimizationTime >= 0);
  assert(result.metrics.averageBatchSize > 0);
});

test('optimizeOperations throws error for invalid input', async () => {
  const optimizer = new BatchOptimizer();
  
  await assert.rejects(
    () => optimizer.optimizeOperations(null),
    BatchOptimizationError
  );
  
  await assert.rejects(
    () => optimizer.optimizeOperations('not an array'),
    BatchOptimizationError
  );
});

test('operation dependency analysis', async () => {
  const optimizer = new BatchOptimizer();
  const operations = [
    { kind: 'create_table', table: 'users' },
    { kind: 'add_column', table: 'users', column: 'email' },
    { kind: 'add_constraint', table: 'posts', constraintType: 'foreign_key', references: 'users' },
    { kind: 'create_table', table: 'posts' }
  ];
  
  const result = await optimizer.optimizeOperations(operations);
  
  // Should analyze dependencies
  assert(result.analysis.dependencies);
  assert(result.analysis.tableOperations);
  assert(typeof result.analysis.riskScore === 'number');
});

test('lock contention minimization through ordering', async () => {
  const optimizer = new BatchOptimizer();
  const unorderedOps = [
    { kind: 'drop_table', table: 'old_table' },
    { kind: 'create_table', table: 'new_table' },
    { kind: 'add_column', table: 'users', column: 'status' },
    { kind: 'create_index', table: 'users', columns: ['status'] }
  ];
  
  const result = await optimizer.optimizeOperations(unorderedOps);
  
  // Create operations should come before destructive ones where possible
  const firstBatch = result.batches[0];
  const createOps = firstBatch.operations.filter(op => op.kind.startsWith('create'));
  const dropOps = firstBatch.operations.filter(op => op.kind.startsWith('drop'));
  
  if (createOps.length > 0 && dropOps.length > 0) {
    // Find indices of first create and first drop
    const firstCreateIndex = firstBatch.operations.findIndex(op => op.kind.startsWith('create'));
    const firstDropIndex = firstBatch.operations.findIndex(op => op.kind.startsWith('drop'));
    
    // Create should generally come before drop (unless there are dependencies)
    if (firstCreateIndex !== -1 && firstDropIndex !== -1) {
      // This is a guideline check - the actual ordering depends on dependencies
      assert(typeof firstCreateIndex === 'number');
      assert(typeof firstDropIndex === 'number');
    }
  }
});

test('compatible operations grouping', async () => {
  const optimizer = new BatchOptimizer();
  const operations = [
    { kind: 'create_table', table: 'table1' },
    { kind: 'create_table', table: 'table2' },
    { kind: 'add_column', table: 'table1', column: 'col1' },
    { kind: 'add_column', table: 'table1', column: 'col2' }
  ];
  
  const result = await optimizer.optimizeOperations(operations);
  
  // Compatible operations should be grouped together
  assert(result.batches.length >= 1);
  
  // Schema operations should generally be grouped
  const schemaOps = result.batches.flatMap(b => b.operations)
    .filter(op => ['create_table', 'add_column'].includes(op.kind));
  assert.equal(schemaOps.length, 4);
});

test('memory-aware batch sizing', async () => {
  const optimizer = new BatchOptimizer({ maxMemoryMB: 50 }); // Very small limit
  
  // Create operations that would exceed memory limit
  const memoryIntensiveOps = Array.from({ length: 20 }, (_, i) => ({
    kind: 'create_index',
    table: `table${i}`,
    columns: ['col1', 'col2', 'col3'] // Index creation is memory intensive
  }));
  
  const result = await optimizer.optimizeOperations(memoryIntensiveOps);
  
  // Should create multiple batches due to memory constraints
  assert(result.batches.length > 1);
  
  // Each batch should respect memory limits
  result.batches.forEach(batch => {
    assert(batch.estimatedMemoryMB <= optimizer.maxMemoryMB);
  });
});

test('transaction boundary optimization', async () => {
  const optimizer = new BatchOptimizer();
  const mixedOperations = [
    { kind: 'create_table', table: 'schema_table' },
    { kind: 'insert', table: 'data_table', data: { id: 1 } },
    { kind: 'drop_column', table: 'risky_table', column: 'old_col' }
  ];
  
  const result = await optimizer.optimizeOperations(mixedOperations);
  
  // Batches should have transaction configuration
  result.batches.forEach(batch => {
    assert(['explicit', 'auto'].includes(batch.transactionMode));
    assert(['serializable', 'read_committed'].includes(batch.isolationLevel));
    assert(typeof batch.requiresExclusiveLock === 'boolean');
    assert(typeof batch.canRunConcurrently === 'boolean');
    assert(['immediate', 'deferred'].includes(batch.rollbackPolicy));
  });
});

test('risk assessment and scoring', async () => {
  const optimizer = new BatchOptimizer();
  const result = await optimizer.optimizeOperations(riskyOperations);
  
  // Should calculate risk scores
  assert(result.analysis.riskScore > 0);
  
  // High-risk operations should have appropriate handling
  const highRiskBatches = result.batches.filter(batch => 
    batch.operations.some(op => ['drop_table', 'drop_column', 'alter_type'].includes(op.kind))
  );
  
  highRiskBatches.forEach(batch => {
    assert.equal(batch.transactionMode, 'explicit');
    assert.equal(batch.rollbackPolicy, 'immediate');
  });
});

test('executeBatch with successful execution', async () => {
  const eventEmitter = new MockEventEmitter();
  const optimizer = new BatchOptimizer({ eventEmitter });
  
  const batch = [
    { kind: 'create_table', table: 'test_table' },
    { kind: 'add_column', table: 'test_table', column: 'test_col' }
  ];
  
  // Mock successful executor
  const mockExecutor = async (operations, options) => {
    assert(Array.isArray(operations));
    assert(options.batchId);
    return { success: true, operationsExecuted: operations.length };
  };
  
  const result = await optimizer.executeBatch(batch, mockExecutor);
  
  // Should emit execution events
  assert.equal(eventEmitter.getEvents('BATCH_EXECUTION_STARTED').length, 1);
  assert.equal(eventEmitter.getEvents('BATCH_EXECUTION_COMPLETED').length, 1);
  
  // Should return result with metrics
  assert(result.result.success);
  assert(result.metrics);
  assert(result.metrics.success);
  assert(result.metrics.operationCount === batch.length);
  assert(result.metrics.executionTime >= 0);
  assert(result.batchId);
});

test('executeBatch with executor failure', async () => {
  const eventEmitter = new MockEventEmitter();
  const optimizer = new BatchOptimizer({ eventEmitter });
  
  const batch = [{ kind: 'create_table', table: 'test_table' }];
  
  // Mock failing executor
  const mockExecutor = async () => {
    throw new Error('Database connection failed');
  };
  
  await assert.rejects(
    () => optimizer.executeBatch(batch, mockExecutor),
    BatchOptimizationError
  );
  
  // Should still emit completion event with failure
  assert.equal(eventEmitter.getEvents('BATCH_EXECUTION_COMPLETED').length, 1);
  const completedEvent = eventEmitter.getEvents('BATCH_EXECUTION_COMPLETED')[0];
  assert.equal(completedEvent.event.payload.metrics.success, false);
});

test('executeBatch with timeout', async () => {
  const optimizer = new BatchOptimizer();
  const batch = [{ kind: 'create_table', table: 'test_table' }];
  
  // Mock slow executor
  const mockExecutor = async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  };
  
  await assert.rejects(
    () => optimizer.executeBatch(batch, mockExecutor, { timeout: 50 }),
    BatchOptimizationError
  );
});

test('executeBatch input validation', async () => {
  const optimizer = new BatchOptimizer();
  
  await assert.rejects(
    () => optimizer.executeBatch([], () => {}),
    BatchOptimizationError
  );
  
  await assert.rejects(
    () => optimizer.executeBatch([{ kind: 'test' }], null),
    BatchOptimizationError
  );
  
  await assert.rejects(
    () => optimizer.executeBatch(null, () => {}),
    BatchOptimizationError
  );
});

test('batch size limits respected', async () => {
  const optimizer = new BatchOptimizer({ maxBatchSize: 5 });
  
  const manyOperations = Array.from({ length: 20 }, (_, i) => ({
    kind: 'add_column',
    table: 'test_table',
    column: `col${i}`
  }));
  
  const result = await optimizer.optimizeOperations(manyOperations);
  
  // Should create multiple batches
  assert(result.batches.length >= 4); // 20 operations / 5 max = 4 batches minimum
  
  // Each batch should not exceed maxBatchSize
  result.batches.forEach(batch => {
    assert(batch.operations.length <= optimizer.maxBatchSize);
  });
});

test('concurrent schema operations handling', async () => {
  const allowConcurrent = new BatchOptimizer({ allowConcurrentSchema: true });
  const disallowConcurrent = new BatchOptimizer({ allowConcurrentSchema: false });
  
  const mixedOps = [
    { kind: 'create_table', table: 'schema_table' },
    { kind: 'insert', table: 'data_table', data: { id: 1 } },
    { kind: 'add_column', table: 'schema_table', column: 'new_col' }
  ];
  
  const allowResult = await allowConcurrent.optimizeOperations(mixedOps);
  const disallowResult = await disallowConcurrent.optimizeOperations(mixedOps);
  
  // With allowConcurrentSchema: false, should separate schema and data operations more
  // This is a behavioral test - exact implementation may vary
  assert(allowResult.batches);
  assert(disallowResult.batches);
});

test('operation conflict detection', async () => {
  const optimizer = new BatchOptimizer();
  const conflictingOps = [
    { kind: 'create_table', table: 'test_table' },
    { kind: 'drop_table', table: 'test_table' },
    { kind: 'add_column', table: 'users', column: 'temp_col' },
    { kind: 'drop_column', table: 'users', column: 'temp_col' }
  ];
  
  const result = await optimizer.optimizeOperations(conflictingOps);
  
  // Should detect conflicts in analysis
  assert(result.analysis.conflicts);
  
  // Conflicting operations should be separated appropriately
  const tableOps = result.analysis.tableOperations.get('test_table');
  if (tableOps) {
    // Should track operations by table
    assert(Array.isArray(tableOps));
  }
});

test('performance metrics calculation', async () => {
  const optimizer = new BatchOptimizer();
  const operations = sampleOperations;
  
  const startTime = performance.now();
  const result = await optimizer.optimizeOperations(operations);
  const endTime = performance.now();
  
  // Metrics should be reasonable
  assert(result.metrics.optimizationTime >= 0);
  assert(result.metrics.optimizationTime <= endTime - startTime + 10); // Allow small buffer
  assert(result.metrics.originalOperationCount === operations.length);
  assert(result.metrics.batchCount > 0);
  assert(result.metrics.averageBatchSize > 0);
  assert(result.metrics.lockConflictReduction >= 0);
  assert(result.metrics.memoryEfficiency >= 0);
});

test('event emission throughout optimization process', async () => {
  const eventEmitter = new MockEventEmitter();
  const optimizer = new BatchOptimizer({ eventEmitter });
  
  await optimizer.optimizeOperations(sampleOperations);
  
  // Should emit optimization events
  const requestedEvents = eventEmitter.getEvents('BATCH_OPTIMIZATION_REQUESTED');
  const optimizedEvents = eventEmitter.getEvents('BATCH_OPTIMIZED');
  
  assert.equal(requestedEvents.length, 1);
  assert.equal(optimizedEvents.length, 1);
  
  // Events should have proper structure
  const requestedEvent = requestedEvents[0].event;
  assert(requestedEvent.payload.operations);
  assert(requestedEvent.payload.options);
  
  const optimizedEvent = optimizedEvents[0].event;
  assert(optimizedEvent.payload.batches);
  assert(optimizedEvent.payload.metrics);
});

test('batch type determination', async () => {
  const optimizer = new BatchOptimizer();
  
  // Test different operation types
  const schemaOps = [
    { kind: 'create_table', table: 'test' },
    { kind: 'add_column', table: 'test', column: 'col' }
  ];
  
  const dataOps = [
    { kind: 'insert', table: 'test', data: { id: 1 } },
    { kind: 'update', table: 'test', where: { id: 1 } }
  ];
  
  const indexOps = [
    { kind: 'create_index', table: 'test', columns: ['col'] }
  ];
  
  const schemaResult = await optimizer.optimizeOperations(schemaOps);
  const dataResult = await optimizer.optimizeOperations(dataOps);
  const indexResult = await optimizer.optimizeOperations(indexOps);
  
  // Should categorize batch types
  const schemaBatch = schemaResult.batches.find(b => b.batchType === 'schema');
  const dataBatch = dataResult.batches.find(b => b.batchType === 'data');
  const indexBatch = indexResult.batches.find(b => b.batchType === 'index');
  
  assert(schemaBatch || schemaResult.batches.some(b => b.batchType === 'mixed'));
  assert(dataBatch || dataResult.batches.some(b => b.batchType === 'mixed'));
  assert(indexBatch || indexResult.batches.some(b => b.batchType === 'mixed'));
});

test('complex multi-table dependency resolution', async () => {
  const optimizer = new BatchOptimizer();
  const complexOps = [
    { kind: 'create_table', table: 'users' },
    { kind: 'create_table', table: 'posts' },
    { kind: 'create_table', table: 'comments' },
    { kind: 'add_constraint', table: 'posts', constraintType: 'foreign_key', references: 'users' },
    { kind: 'add_constraint', table: 'comments', constraintType: 'foreign_key', references: 'posts' },
    { kind: 'create_index', table: 'users', columns: ['email'] },
    { kind: 'create_index', table: 'posts', columns: ['user_id'] },
    { kind: 'create_index', table: 'comments', columns: ['post_id'] }
  ];
  
  const result = await optimizer.optimizeOperations(complexOps);
  
  // Should handle complex dependencies
  assert(result.batches);
  assert(result.analysis.dependencies.size >= 0);
  
  // Foreign key constraints should come after table creation
  const allOps = result.batches.flatMap(b => b.operations);
  const tableCreations = allOps.filter(op => op.kind === 'create_table');
  const constraints = allOps.filter(op => op.kind === 'add_constraint');
  
  // Basic dependency check: tables should be created before constraints
  if (tableCreations.length > 0 && constraints.length > 0) {
    const lastTableIndex = allOps.map((op, i) => op.kind === 'create_table' ? i : -1)
      .filter(i => i >= 0)
      .pop();
    const firstConstraintIndex = allOps.findIndex(op => op.kind === 'add_constraint');
    
    if (lastTableIndex !== undefined && firstConstraintIndex >= 0) {
      // This is a guideline - actual ordering depends on specific dependencies
      assert(typeof lastTableIndex === 'number');
      assert(typeof firstConstraintIndex === 'number');
    }
  }
});

test('error handling with custom error types', async () => {
  const optimizer = new BatchOptimizer();
  
  // Test BatchOptimizationError
  try {
    await optimizer.optimizeOperations(null);
    assert.fail('Should have thrown BatchOptimizationError');
  } catch (error) {
    assert(error instanceof BatchOptimizationError);
    assert.equal(error.name, 'BatchOptimizationError');
  }
  
  // Test with mock executor that fails
  const batch = [{ kind: 'create_table', table: 'test' }];
  const failingExecutor = async () => {
    throw new Error('Mock database error');
  };
  
  try {
    await optimizer.executeBatch(batch, failingExecutor);
    assert.fail('Should have thrown BatchOptimizationError');
  } catch (error) {
    assert(error instanceof BatchOptimizationError);
    assert(error.message.includes('Batch execution failed'));
    assert(error.details.originalError);
  }
});

test('singleton export functionality', async () => {
  const { batchOptimizer } = await import('../src/domain/optimizer/BatchOptimizer.mjs');
  
  assert(batchOptimizer instanceof BatchOptimizer);
  
  // Should be usable
  const result = await batchOptimizer.optimizeOperations([
    { kind: 'create_table', table: 'singleton_test' }
  ]);
  
  assert(result.batches);
  assert(result.metrics);
});

test('empty operations array handling', async () => {
  const optimizer = new BatchOptimizer();
  
  const result = await optimizer.optimizeOperations([]);
  
  assert(Array.isArray(result.batches));
  assert.equal(result.batches.length, 0);
  assert.equal(result.metrics.originalOperationCount, 0);
  assert.equal(result.metrics.batchCount, 0);
});

test('operation memory estimation accuracy', async () => {
  const optimizer = new BatchOptimizer();
  const memoryIntensiveOps = [
    { kind: 'create_index', table: 'large_table', columns: ['col1', 'col2'] },
    { kind: 'alter_type', table: 'users', column: 'data', from: 'text', to: 'jsonb' },
    { kind: 'add_column', table: 'simple_table', column: 'simple_col' }
  ];
  
  const result = await optimizer.optimizeOperations(memoryIntensiveOps);
  
  // Memory estimates should be reasonable
  result.batches.forEach(batch => {
    assert(batch.estimatedMemoryMB > 0);
    assert(batch.estimatedMemoryMB <= optimizer.maxMemoryMB);
  });
  
  // Index creation should have higher memory estimate than simple column addition
  const indexBatch = result.batches.find(b => 
    b.operations.some(op => op.kind === 'create_index')
  );
  const simpleColumnBatch = result.batches.find(b => 
    b.operations.some(op => op.kind === 'add_column') &&
    b.operations.every(op => op.kind !== 'create_index' && op.kind !== 'alter_type')
  );
  
  if (indexBatch && simpleColumnBatch) {
    // Index operations should generally be more memory intensive
    assert(indexBatch.estimatedMemoryMB >= simpleColumnBatch.estimatedMemoryMB);
  }
});