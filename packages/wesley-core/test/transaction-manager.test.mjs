/**
 * TransactionManager Tests
 * Comprehensive tests for transaction management, savepoints, and deadlock handling
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  TransactionManager, 
  TransactionError, 
  DeadlockError, 
  SavepointError,
  IsolationLevel,
  TransactionStarted,
  TransactionCommitted,
  TransactionRolledBack,
  SavepointCreated,
  DeadlockDetected
} from '../src/domain/transaction/TransactionManager.mjs';

// Mock database client
class MockClient {
  constructor() {
    this.queries = [];
    this.shouldFailAt = null;
    this.shouldDeadlock = false;
    this.deadlockCount = 0;
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });

    if (this.shouldFailAt && this.queries.length >= this.shouldFailAt) {
      throw new Error('Mock database error');
    }

    if (this.shouldDeadlock && sql.includes('SELECT') && this.deadlockCount < 2) {
      this.deadlockCount++;
      const error = new Error('deadlock detected');
      error.code = '40P01';
      throw error;
    }

    // Return appropriate responses for different queries
    if (sql.includes('BEGIN')) {
      return { rows: [] };
    } else if (sql.includes('COMMIT')) {
      return { rows: [] };
    } else if (sql.includes('ROLLBACK')) {
      return { rows: [] };
    } else if (sql.includes('SAVEPOINT')) {
      return { rows: [] };
    } else if (sql.includes('SET TRANSACTION ISOLATION LEVEL')) {
      return { rows: [] };
    }

    return { rows: [{ result: true }] };
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1];
  }

  getQueries() {
    return [...this.queries];
  }

  reset() {
    this.queries = [];
    this.shouldFailAt = null;
    this.shouldDeadlock = false;
    this.deadlockCount = 0;
  }
}

// Mock event emitter
class MockEventEmitter {
  constructor() {
    this.events = [];
  }

  emit(eventType, event) {
    this.events.push({ eventType, event });
  }

  getEvents() {
    return [...this.events];
  }

  reset() {
    this.events = [];
  }
}

test('TransactionManager - basic transaction lifecycle', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const manager = new TransactionManager({ eventEmitter });

  // Begin transaction
  const transactionId = await manager.beginTransaction(client);
  
  assert(typeof transactionId === 'string');
  assert(transactionId.startsWith('tx_'));
  
  // Check BEGIN query was executed
  const queries = client.getQueries();
  assert(queries.some(q => q.sql === 'BEGIN'));
  
  // Check transaction started event
  const events = eventEmitter.getEvents();
  assert(events.some(e => e.event instanceof TransactionStarted));
  
  // Get transaction info
  const info = manager.getTransactionInfo(transactionId);
  assert.equal(info.id, transactionId);
  assert.equal(info.status, 'active');
  assert.equal(info.isolationLevel, IsolationLevel.READ_COMMITTED);

  // Commit transaction
  const duration = await manager.commitTransaction(transactionId);
  assert(typeof duration === 'number');
  assert(duration >= 0);
  
  // Check COMMIT query was executed
  const finalQueries = client.getQueries();
  assert(finalQueries.some(q => q.sql === 'COMMIT'));
  
  // Check transaction committed event
  const finalEvents = eventEmitter.getEvents();
  assert(finalEvents.some(e => e.event instanceof TransactionCommitted));
  
  // Transaction should be removed from active transactions
  assert.equal(manager.getTransactionInfo(transactionId), null);
});

test('TransactionManager - custom isolation level', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const transactionId = await manager.beginTransaction(client, {
    isolationLevel: IsolationLevel.SERIALIZABLE
  });

  const queries = client.getQueries();
  assert(queries.some(q => q.sql === 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'));
  
  const info = manager.getTransactionInfo(transactionId);
  assert.equal(info.isolationLevel, IsolationLevel.SERIALIZABLE);

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - transaction rollback', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const manager = new TransactionManager({ eventEmitter });

  const transactionId = await manager.beginTransaction(client);
  await manager.rollbackTransaction(transactionId, 'Test rollback');

  const queries = client.getQueries();
  assert(queries.some(q => q.sql === 'ROLLBACK'));
  
  const events = eventEmitter.getEvents();
  assert(events.some(e => e.event instanceof TransactionRolledBack));
  
  // Transaction should be removed
  assert.equal(manager.getTransactionInfo(transactionId), null);
});

test('TransactionManager - savepoint creation and rollback', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const manager = new TransactionManager({ eventEmitter });

  const transactionId = await manager.beginTransaction(client);
  
  // Create savepoint
  const savepointName = await manager.createSavepoint(transactionId);
  assert(typeof savepointName === 'string');
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql.startsWith('SAVEPOINT')));
  
  const events = eventEmitter.getEvents();
  assert(events.some(e => e.event instanceof SavepointCreated));
  
  // Check transaction info includes savepoint
  const info = manager.getTransactionInfo(transactionId);
  assert.equal(info.savepointCount, 1);
  assert.equal(info.savepoints[0].name, savepointName);
  
  // Rollback to savepoint
  await manager.rollbackToSavepoint(transactionId, savepointName);
  
  const rollbackQueries = client.getQueries();
  assert(rollbackQueries.some(q => q.sql.startsWith('ROLLBACK TO SAVEPOINT')));

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - named savepoint', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const transactionId = await manager.beginTransaction(client);
  const customName = 'my_savepoint';
  const savepointName = await manager.createSavepoint(transactionId, customName);
  
  assert.equal(savepointName, customName);
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql === `SAVEPOINT ${customName}`));

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - release savepoint', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const transactionId = await manager.beginTransaction(client);
  const savepointName = await manager.createSavepoint(transactionId);
  
  // Release savepoint
  await manager.releaseSavepoint(transactionId, savepointName);
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql === `RELEASE SAVEPOINT ${savepointName}`));
  
  // Savepoint should be removed from transaction info
  const info = manager.getTransactionInfo(transactionId);
  assert.equal(info.savepointCount, 0);

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - nested savepoints', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const transactionId = await manager.beginTransaction(client);
  
  // Create multiple savepoints
  const sp1 = await manager.createSavepoint(transactionId, 'sp1');
  const sp2 = await manager.createSavepoint(transactionId, 'sp2');
  const sp3 = await manager.createSavepoint(transactionId, 'sp3');
  
  const info = manager.getTransactionInfo(transactionId);
  assert.equal(info.savepointCount, 3);
  
  // Rollback to middle savepoint should remove newer savepoints
  await manager.rollbackToSavepoint(transactionId, sp2);
  
  const updatedInfo = manager.getTransactionInfo(transactionId);
  assert.equal(updatedInfo.savepointCount, 2);
  assert(updatedInfo.savepoints.some(sp => sp.name === sp1));
  assert(updatedInfo.savepoints.some(sp => sp.name === sp2));
  assert(!updatedInfo.savepoints.some(sp => sp.name === sp3));

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - max savepoints limit', async () => {
  const client = new MockClient();
  const manager = new TransactionManager({ maxSavepoints: 2 });

  const transactionId = await manager.beginTransaction(client);
  
  // Create maximum allowed savepoints
  await manager.createSavepoint(transactionId);
  await manager.createSavepoint(transactionId);
  
  // Third savepoint should fail
  await assert.rejects(
    manager.createSavepoint(transactionId),
    SavepointError
  );

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - deadlock detection and retry', async () => {
  const client = new MockClient();
  client.shouldDeadlock = true;
  const eventEmitter = new MockEventEmitter();
  const manager = new TransactionManager({ maxRetries: 2, retryDelay: 10, eventEmitter });

  const transactionId = await manager.beginTransaction(client);
  
  let attempts = 0;
  const operation = async () => {
    attempts++;
    return await client.query('SELECT * FROM test_table');
  };

  // Should retry on deadlock
  const result = await manager.executeWithDeadlockRetry(transactionId, operation);
  assert(result);
  assert(attempts >= 2); // Should have retried
  
  const events = eventEmitter.getEvents();
  assert(events.some(e => e.event instanceof DeadlockDetected));

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - deadlock retry exhaustion', async () => {
  const client = new MockClient();
  client.shouldDeadlock = true;
  client.deadlockCount = 0; // Reset to ensure it keeps failing
  const manager = new TransactionManager({ maxRetries: 1, retryDelay: 1 });

  const transactionId = await manager.beginTransaction(client);
  
  const operation = async () => {
    // Always deadlock for this test
    const error = new Error('deadlock detected');
    error.code = '40P01';
    throw error;
  };

  await assert.rejects(
    manager.executeWithDeadlockRetry(transactionId, operation),
    DeadlockError
  );

  await manager.rollbackTransaction(transactionId);
});

test('TransactionManager - executeInTransaction success', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  let operationExecuted = false;
  const operation = async () => {
    operationExecuted = true;
    return 'success';
  };

  const result = await manager.executeInTransaction(client, operation);
  
  assert.equal(result, 'success');
  assert(operationExecuted);
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql === 'BEGIN'));
  assert(queries.some(q => q.sql === 'COMMIT'));
});

test('TransactionManager - executeInTransaction with error rollback', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const operation = async () => {
    throw new Error('Operation failed');
  };

  await assert.rejects(
    manager.executeInTransaction(client, operation),
    Error
  );
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql === 'BEGIN'));
  assert(queries.some(q => q.sql === 'ROLLBACK'));
});

test('TransactionManager - executeWithSavepoint success', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const transactionId = await manager.beginTransaction(client);
  
  let operationExecuted = false;
  const operation = async () => {
    operationExecuted = true;
    return 'success';
  };

  const result = await manager.executeWithSavepoint(transactionId, operation);
  
  assert.equal(result, 'success');
  assert(operationExecuted);
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql.startsWith('SAVEPOINT')));

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - executeWithSavepoint with error rollback', async () => {
  const client = new MockClient();
  const manager = new TransactionManager();

  const transactionId = await manager.beginTransaction(client);
  
  const operation = async () => {
    throw new Error('Savepoint operation failed');
  };

  await assert.rejects(
    manager.executeWithSavepoint(transactionId, operation),
    Error
  );
  
  const queries = client.getQueries();
  assert(queries.some(q => q.sql.startsWith('SAVEPOINT')));
  assert(queries.some(q => q.sql.startsWith('ROLLBACK TO SAVEPOINT')));

  await manager.commitTransaction(transactionId);
});

test('TransactionManager - active transactions tracking', async () => {
  const client1 = new MockClient();
  const client2 = new MockClient();
  const manager = new TransactionManager();

  // Start multiple transactions
  const tx1 = await manager.beginTransaction(client1);
  const tx2 = await manager.beginTransaction(client2);
  
  const activeTx = manager.getActiveTransactions();
  assert.equal(activeTx.length, 2);
  assert(activeTx.some(tx => tx.id === tx1));
  assert(activeTx.some(tx => tx.id === tx2));
  
  // Commit one
  await manager.commitTransaction(tx1);
  
  const remainingTx = manager.getActiveTransactions();
  assert.equal(remainingTx.length, 1);
  assert.equal(remainingTx[0].id, tx2);

  await manager.commitTransaction(tx2);
  
  const finalTx = manager.getActiveTransactions();
  assert.equal(finalTx.length, 0);
});

test('TransactionManager - error handling for invalid transaction', async () => {
  const manager = new TransactionManager();

  await assert.rejects(
    manager.commitTransaction('invalid-tx-id'),
    TransactionError
  );

  await assert.rejects(
    manager.rollbackTransaction('invalid-tx-id'),
    TransactionError
  );

  await assert.rejects(
    manager.createSavepoint('invalid-tx-id'),
    TransactionError
  );
});

test('TransactionManager - cleanup on shutdown', async () => {
  const client1 = new MockClient();
  const client2 = new MockClient();
  const manager = new TransactionManager();

  // Start multiple transactions
  const tx1 = await manager.beginTransaction(client1);
  const tx2 = await manager.beginTransaction(client2);
  
  assert.equal(manager.getActiveTransactions().length, 2);
  
  // Cleanup should rollback all active transactions
  await manager.cleanup();
  
  assert.equal(manager.getActiveTransactions().length, 0);
  
  // Should have rollback queries for both clients
  const queries1 = client1.getQueries();
  const queries2 = client2.getQueries();
  assert(queries1.some(q => q.sql === 'ROLLBACK'));
  assert(queries2.some(q => q.sql === 'ROLLBACK'));
});

test('TransactionManager - isDeadlockError detection', async () => {
  const manager = new TransactionManager();

  // Test deadlock error codes
  const deadlockError1 = new Error('deadlock');
  deadlockError1.code = '40P01';
  assert(manager.isDeadlockError(deadlockError1));

  const deadlockError2 = new Error('serialization failure');
  deadlockError2.code = '40001';
  assert(manager.isDeadlockError(deadlockError2));

  const deadlockError3 = new Error('Transaction deadlock detected');
  assert(manager.isDeadlockError(deadlockError3));

  // Test non-deadlock error
  const normalError = new Error('constraint violation');
  normalError.code = '23505';
  assert(!manager.isDeadlockError(normalError));
});

test('TransactionManager - generateTransactionId uniqueness', async () => {
  const manager = new TransactionManager();
  
  const id1 = manager.generateTransactionId();
  const id2 = manager.generateTransactionId();
  
  assert(id1.startsWith('tx_'));
  assert(id2.startsWith('tx_'));
  assert(id1 !== id2);
});