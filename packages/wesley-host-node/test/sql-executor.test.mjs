import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { FakeClock } from '@wesley/core';

import {
  SQLExecutor,
  PostgreSQLConnection,
  SQLOperation,
  SQLExecutorStarted
} from '../src/adapters/SQLExecutor.mjs';

function createClock() {
  return new FakeClock('2026-03-23T00:00:00.000Z');
}

async function flushClock(clock, ms = 0) {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
  await clock.advanceBy(ms);
  await Promise.resolve();
}

class FakePsqlProcess {
  constructor(clock) {
    this.clock = clock;
    this.pid = 12345;
    this.killed = false;
    this.handlers = new Map();
    this.stdin = {
      write: (chunk) => {
        if (String(chunk).includes('\\q')) {
          this.clock.setTimeout(() => {
            const listener = this.handlers.get('exit');
            if (listener) listener(0, null);
          }, 0);
        }
      }
    };
    this.stdout = { on() {}, removeListener() {} };
    this.stderr = { on() {}, removeListener() {} };
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  kill() {
    this.killed = true;
    const listener = this.handlers.get('exit');
    if (listener) listener(0, 'SIGTERM');
  }
}

class MockSQLExecutor extends SQLExecutor {
  constructor(connection, eventEmitter = null, clock = createClock()) {
    super(connection, eventEmitter, { clock });
    this.mockResults = new Map();
    this.mockExecuteDelay = 0;
  }

  async start() {
    this.emit(new SQLExecutorStarted(this.connection.connectionString, {}));
    this.psqlProcess = new FakePsqlProcess(this.clock);
    return true;
  }

  async executeSql(sql) {
    if (this.mockExecuteDelay > 0) {
      await this.clock.sleep(this.mockExecuteDelay);
    }

    if (this.mockResults.has(sql.trim())) {
      const result = this.mockResults.get(sql.trim());
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }

    if (sql.includes('INSERT')) return 'INSERT 0 1\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('UPDATE')) return 'UPDATE 1\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('DELETE')) return 'DELETE 1\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('CREATE')) return 'CREATE INDEX\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('BEGIN')) return 'BEGIN\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('COMMIT')) return 'COMMIT\nWESLEY_OPERATION_COMPLETE';
    if (sql.includes('ROLLBACK')) return 'ROLLBACK\nWESLEY_OPERATION_COMPLETE';

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
  test('creates connection from connection string', () => {
    const conn = new PostgreSQLConnection('postgresql://user:pass@host:5432/db');
    assert.equal(conn.connectionString, 'postgresql://user:pass@host:5432/db');
  });

  test('builds correct psql arguments and env', () => {
    const conn = new PostgreSQLConnection(null, {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      password: 'secret',
      applicationName: 'wesley-test'
    });

    assert.deepEqual(conn.toPsqlArgs().slice(0, 8), [
      '-h', 'localhost',
      '-p', '5432',
      '-d', 'testdb',
      '-U', 'testuser'
    ]);
    assert.equal(conn.toEnv().PGPASSWORD, 'secret');
    assert.equal(conn.toEnv().PGAPPNAME, 'wesley-test');
  });
});

describe('SQLOperation', () => {
  test('tracks timing deterministically with an injected clock', async () => {
    const clock = createClock();
    const op = new SQLOperation('SELECT 1;');

    assert.equal(op.getDuration(), null);
    op.start(clock);
    await clock.advanceBy(25);
    op.complete(5, clock);

    assert.equal(op.rowsAffected, 5);
    assert.equal(op.getDuration(), 25);
  });

  test('tracks failure timing deterministically with an injected clock', async () => {
    const clock = createClock();
    const op = new SQLOperation('INVALID SQL;');
    const error = new Error('syntax error');

    op.start(clock);
    await clock.advanceBy(10);
    op.fail(error, clock);

    assert.equal(op.error, error);
    assert.equal(op.getDuration(), 10);
  });
});

describe('SQLExecutor', () => {
  let eventEmitter;
  let connection;
  let executor;
  let events;
  let clock;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    events = [];
    clock = createClock();
    eventEmitter.on('domain-event', (event) => events.push(event));
    connection = new PostgreSQLConnection('postgresql://test:test@localhost:5432/test');
    executor = new MockSQLExecutor(connection, eventEmitter, clock);
  });

  test('emits startup event', async () => {
    await executor.start();
    assert.equal(events.length, 1);
    assert.ok(events[0] instanceof SQLExecutorStarted);
    assert.ok(executor.psqlProcess);
  });

  test('executes a single operation and records rows affected', async () => {
    await executor.start();

    const operation = new SQLOperation('INSERT INTO test VALUES (1);', { operation: 'INSERT' });
    const result = await executor.executeOperation(operation);

    assert.ok(result.includes('INSERT'));
    assert.equal(operation.rowsAffected, 1);
    assert.equal(events.find((e) => e.type === 'SQL_OPERATION_STARTED').payload.operation, 'INSERT');
    assert.ok(events.find((e) => e.type === 'SQL_OPERATION_COMPLETED'));
  });

  test('handles operation failures', async () => {
    await executor.start();
    executor.setMockResult('INVALID SQL;', new Error('SQL syntax error'));

    const operation = new SQLOperation('INVALID SQL;', { operation: 'TEST_ERROR' });
    await assert.rejects(() => executor.executeOperation(operation), /SQL syntax error/);

    const errorEvent = events.find((e) => e.type === 'SQL_EXECUTOR_ERROR');
    assert.ok(errorEvent);
    assert.equal(errorEvent.payload.operation, 'TEST_ERROR');
  });

  test('manages transactions and advisory locks', async () => {
    await executor.start();

    await executor.startTransaction('REPEATABLE READ');
    await executor.acquireAdvisoryLock(12345, false);
    await executor.releaseAdvisoryLock(12345);
    await executor.commitTransaction();

    assert.equal(executor.transactionActive, false);
    assert.equal(executor.advisoryLocks.size, 0);
    assert.ok(events.find((e) => e.type === 'SQL_TRANSACTION_STARTED'));
    assert.ok(events.find((e) => e.type === 'SQL_ADVISORY_LOCK_ACQUIRED'));
    assert.ok(events.find((e) => e.type === 'SQL_TRANSACTION_COMMITTED'));
  });

  test('handles operation timeout without wall-clock sleeps', async () => {
    await executor.start();
    executor.setExecuteDelay(200);

    const operation = new SQLOperation('SLOW QUERY;', {
      operation: 'TIMEOUT_TEST',
      timeoutMs: 100
    });

    const promise = executor.executeOperation(operation);
    await flushClock(clock, 150);

    const timeoutEvent = events.find((e) =>
      e.type === 'SQL_EXECUTOR_ERROR' && e.payload.error.includes('Operation timeout')
    );
    assert.ok(timeoutEvent);

    await flushClock(clock, 100);
    await promise;
  });

  test('shuts down cleanly without wall-clock sleeps', async () => {
    await executor.start();
    await executor.startTransaction();
    await executor.acquireAdvisoryLock(54321);

    const shutdownPromise = executor.shutdown();
    await flushClock(clock, 2001);
    await shutdownPromise;

    assert.equal(executor.transactionActive, false);
    assert.equal(executor.advisoryLocks.size, 0);
    assert.equal(executor.psqlProcess, null);
  });

  test('supports typical migration execution pattern', async () => {
    await executor.start();
    await executor.startTransaction();

    const ddlOperations = [
      new SQLOperation('CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL);', {
        operation: 'CREATE_TABLE',
        table: 'users'
      }),
      new SQLOperation('CREATE INDEX idx_users_email ON users (email);', {
        operation: 'CREATE_INDEX',
        table: 'users'
      }),
      new SQLOperation('INSERT INTO users (email) VALUES (\'test@example.com\');', {
        operation: 'SEED_DATA',
        table: 'users'
      })
    ];

    await executor.executeOperations(ddlOperations);
    await executor.commitTransaction();

    const stats = executor.getStats();
    assert.equal(stats.completed, 5);
    assert.equal(stats.failed, 0);
  });
});
