/**
 * LockMonitor Tests
 * Comprehensive tests for lock monitoring, deadlock detection, and performance analysis
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  LockMonitor,
  MonitorError,
  DeadlockDetectedEvent,
  LockWaitDetected,
  PerformanceThresholdExceeded,
  LockContentionAlert,
  LockWaitState
} from '../src/domain/locks/LockMonitor.mjs';

// Mock database client with configurable lock data
class MockClient {
  constructor() {
    this.queries = [];
    this.mockLocks = [];
    this.mockWaitingQueries = [];
    this.mockBlockingQueries = [];
    this.shouldFail = false;
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params, timestamp: Date.now() });

    if (this.shouldFail) {
      throw new Error('Mock database error');
    }

    // Handle different query types based on SQL content
    if (sql.includes('pg_locks') && sql.includes('pg_stat_activity')) {
      if (sql.includes('blocked.pid') && sql.includes('blocking.pid')) {
        // Waiting queries query
        return { rows: this.mockWaitingQueries };
      } else if (sql.includes('COUNT(blocked.pid)')) {
        // Blocking queries query  
        return { rows: this.mockBlockingQueries };
      } else {
        // Current locks query
        return { rows: this.mockLocks };
      }
    }

    return { rows: [] };
  }

  setMockLocks(locks) {
    this.mockLocks = locks;
  }

  setMockWaitingQueries(queries) {
    this.mockWaitingQueries = queries;
  }

  setMockBlockingQueries(queries) {
    this.mockBlockingQueries = queries;
  }

  setShouldFail(shouldFail) {
    this.shouldFail = shouldFail;
  }

  getQueries() {
    return [...this.queries];
  }

  reset() {
    this.queries = [];
    this.mockLocks = [];
    this.mockWaitingQueries = [];
    this.mockBlockingQueries = [];
    this.shouldFail = false;
  }
}

// Mock event emitter
class MockEventEmitter {
  constructor() {
    this.events = [];
  }

  emit(eventType, event) {
    this.events.push({ eventType, event, timestamp: Date.now() });
  }

  getEvents() {
    return [...this.events];
  }

  getEventsOfType(eventClass) {
    return this.events.filter(e => e.event instanceof eventClass);
  }

  reset() {
    this.events = [];
  }
}

// Helper to create mock lock data
function createMockLock(overrides = {}) {
  return {
    locktype: 'relation',
    database: null,
    relation: 12345,
    page: null,
    tuple: null,
    virtualxid: null,
    transactionid: null,
    classid: null,
    objid: null,
    objsubid: null,
    virtualtransaction: '1/123',
    pid: 1001,
    mode: 'ExclusiveLock',
    granted: true,
    fastpath: false,
    current_query: 'SELECT * FROM users',
    state: 'active',
    query_start: new Date().toISOString(),
    state_change: new Date().toISOString(),
    application_name: 'test-app',
    client_addr: '127.0.0.1',
    query_duration_ms: 1000,
    wait_duration_ms: 0,
    ...overrides
  };
}

function createMockWaitingQuery(overrides = {}) {
  return {
    blocked_pid: 1001,
    blocked_query: 'UPDATE users SET name = ? WHERE id = ?',
    state: 'active',
    query_start: new Date().toISOString(),
    state_change: new Date().toISOString(),
    application_name: 'blocked-app',
    client_addr: '127.0.0.1',
    blocking_pid: 1002,
    blocking_query: 'SELECT * FROM users FOR UPDATE',
    blocking_state: 'idle in transaction',
    blocking_app: 'blocking-app',
    blocked_mode: 'ExclusiveLock',
    blocking_mode: 'ExclusiveLock',
    locktype: 'relation',
    relation: 12345,
    wait_time_ms: 5000,
    blocking_duration_ms: 30000,
    ...overrides
  };
}

function createMockBlockingQuery(overrides = {}) {
  return {
    pid: 1002,
    query: 'SELECT * FROM users FOR UPDATE',
    state: 'idle in transaction',
    query_start: new Date().toISOString(),
    application_name: 'blocking-app',
    client_addr: '127.0.0.1',
    blocked_count: '3',
    max_wait_time: 10000,
    avg_wait_time: 7500,
    blocking_duration_ms: 30000,
    blocked_pids: [1001, 1003, 1004],
    ...overrides
  };
}

test('LockMonitor - initialization and configuration', () => {
  const monitor = new LockMonitor({
    monitoringInterval: 10000,
    deadlockCheckInterval: 15000,
    maxWaitTime: 60000,
    maxBlockedQueries: 20
  });
  
  assert.equal(monitor.monitoringInterval, 10000);
  assert.equal(monitor.deadlockCheckInterval, 15000);
  assert.equal(monitor.performanceThresholds.maxWaitTime, 60000);
  assert.equal(monitor.performanceThresholds.maxBlockedQueries, 20);
  assert.equal(monitor.isMonitoring, false);
});

test('LockMonitor - start and stop monitoring', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor({ monitoringInterval: 100, deadlockCheckInterval: 200 });
  
  assert.equal(monitor.isMonitoring, false);
  
  await monitor.startMonitoring(client);
  assert.equal(monitor.isMonitoring, true);
  assert(monitor.monitoringTimer !== null);
  assert(monitor.deadlockTimer !== null);
  
  await monitor.stopMonitoring();
  assert.equal(monitor.isMonitoring, false);
  assert.equal(monitor.monitoringTimer, null);
  assert.equal(monitor.deadlockTimer, null);
});

test('LockMonitor - getCurrentLocks parsing', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  const mockLocks = [
    createMockLock({ pid: 1001, mode: 'ExclusiveLock', granted: true }),
    createMockLock({ pid: 1002, mode: 'ShareLock', granted: false, wait_duration_ms: 5000 })
  ];
  
  client.setMockLocks(mockLocks);
  
  const locks = await monitor.getCurrentLocks();
  
  assert.equal(locks.length, 2);
  assert.equal(locks[0].pid, 1001);
  assert.equal(locks[0].mode, 'ExclusiveLock');
  assert.equal(locks[0].granted, true);
  assert.equal(locks[0].waitDuration, 0);
  
  assert.equal(locks[1].pid, 1002);
  assert.equal(locks[1].mode, 'ShareLock');
  assert.equal(locks[1].granted, false);
  assert.equal(locks[1].waitDuration, 5000);
});

test('LockMonitor - getWaitingQueries parsing', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  const mockWaiting = [
    createMockWaitingQuery({
      blocked_pid: 1001,
      blocking_pid: 1002,
      wait_time_ms: 8000
    })
  ];
  
  client.setMockWaitingQueries(mockWaiting);
  
  const waitingQueries = await monitor.getWaitingQueries();
  
  assert.equal(waitingQueries.length, 1);
  assert.equal(waitingQueries[0].blockedPid, 1001);
  assert.equal(waitingQueries[0].blockingPid, 1002);
  assert.equal(waitingQueries[0].waitTime, 8000);
  assert.equal(waitingQueries[0].blockedMode, 'ExclusiveLock');
  assert.equal(waitingQueries[0].blockingMode, 'ExclusiveLock');
});

test('LockMonitor - getBlockingQueries parsing', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  const mockBlocking = [
    createMockBlockingQuery({
      pid: 1002,
      blocked_count: '5',
      max_wait_time: 12000,
      avg_wait_time: 8000
    })
  ];
  
  client.setMockBlockingQueries(mockBlocking);
  
  const blockingQueries = await monitor.getBlockingQueries();
  
  assert.equal(blockingQueries.length, 1);
  assert.equal(blockingQueries[0].blockingPid, 1002);
  assert.equal(blockingQueries[0].blockedCount, 5);
  assert.equal(blockingQueries[0].maxWaitTime, 12000);
  assert.equal(blockingQueries[0].avgWaitTime, 8000);
  assert(Array.isArray(blockingQueries[0].blockedPids));
});

test('LockMonitor - deadlock detection with simple cycle', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const monitor = new LockMonitor({ eventEmitter });
  
  // Create a simple A -> B -> A deadlock
  const mockWaiting = [
    createMockWaitingQuery({
      blocked_pid: 1001,
      blocking_pid: 1002,
      blocked_query: 'UPDATE table1 SET x = 1',
      wait_time_ms: 5000
    }),
    createMockWaitingQuery({
      blocked_pid: 1002,
      blocking_pid: 1001,
      blocked_query: 'UPDATE table2 SET y = 2', 
      wait_time_ms: 3000
    })
  ];
  
  client.setMockWaitingQueries(mockWaiting);
  
  const deadlocks = await monitor.detectDeadlocks();
  
  assert.equal(deadlocks.length, 1);
  const deadlock = deadlocks[0];
  assert.equal(deadlock.cycleLength, 2);
  assert.equal(deadlock.processes.length, 2);
  assert(deadlock.totalWaitTime > 0);
  assert(deadlock.detectedAt instanceof Date);
  
  // Check event was emitted
  const deadlockEvents = eventEmitter.getEventsOfType(DeadlockDetectedEvent);
  assert.equal(deadlockEvents.length, 1);
});

test('LockMonitor - deadlock detection with complex cycle', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  // Create A -> B -> C -> A deadlock
  const mockWaiting = [
    createMockWaitingQuery({
      blocked_pid: 1001,
      blocking_pid: 1002,
      wait_time_ms: 2000
    }),
    createMockWaitingQuery({
      blocked_pid: 1002,
      blocking_pid: 1003,
      wait_time_ms: 3000
    }),
    createMockWaitingQuery({
      blocked_pid: 1003,
      blocking_pid: 1001,
      wait_time_ms: 4000
    })
  ];
  
  client.setMockWaitingQueries(mockWaiting);
  
  const deadlocks = await monitor.detectDeadlocks();
  
  assert.equal(deadlocks.length, 1);
  assert.equal(deadlocks[0].cycleLength, 3);
  assert.equal(deadlocks[0].processes.length, 3);
  assert.equal(deadlocks[0].totalWaitTime, 9000);
});

test('LockMonitor - no deadlock with linear chain', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  // Create A -> B -> C (no cycle)
  const mockWaiting = [
    createMockWaitingQuery({
      blocked_pid: 1001,
      blocking_pid: 1002
    }),
    createMockWaitingQuery({
      blocked_pid: 1002,
      blocking_pid: 1003
    })
  ];
  
  client.setMockWaitingQueries(mockWaiting);
  
  const deadlocks = await monitor.detectDeadlocks();
  
  assert.equal(deadlocks.length, 0);
});

test('LockMonitor - lock contention analysis', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const monitor = new LockMonitor({ eventEmitter });
  
  const mockLocks = [createMockLock()];
  const mockWaiting = [
    createMockWaitingQuery({
      relation: 12345,
      wait_time_ms: 6000,
      locktype: 'relation'
    }),
    createMockWaitingQuery({
      relation: 12345,
      wait_time_ms: 8000,
      locktype: 'relation'
    }),
    createMockWaitingQuery({
      relation: 12345,
      wait_time_ms: 10000,
      locktype: 'relation'
    })
  ];
  const mockBlocking = [createMockBlockingQuery()];
  
  client.setMockLocks(mockLocks);
  client.setMockWaitingQueries(mockWaiting);
  client.setMockBlockingQueries(mockBlocking);
  
  const contention = await monitor.analyzeLockContention(mockLocks, mockWaiting, mockBlocking);
  
  assert.equal(contention.length, 1);
  const hotspot = contention[0];
  assert.equal(hotspot.relation, 12345);
  assert.equal(hotspot.waitingCount, 3);
  assert.equal(hotspot.totalWaitTime, 24000);
  assert.equal(hotspot.maxWaitTime, 10000);
  assert.equal(hotspot.avgWaitTime, 8000);
  
  // Should trigger contention alert
  const contentionEvents = eventEmitter.getEventsOfType(LockContentionAlert);
  assert.equal(contentionEvents.length, 1);
});

test('LockMonitor - performance metrics tracking', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  const mockWaiting = [
    createMockWaitingQuery({ wait_time_ms: 5000 }),
    createMockWaitingQuery({ wait_time_ms: 3000 }),
    createMockWaitingQuery({ wait_time_ms: 7000 })
  ];
  const mockBlocking = [
    createMockBlockingQuery({ blocked_count: '2' })
  ];
  
  await monitor.updatePerformanceMetrics(mockWaiting, mockBlocking);
  
  const metrics = monitor.performanceMetrics;
  assert.equal(metrics.totalQueries, 4); // 3 waiting + 1 blocking
  assert.equal(metrics.blockedQueries, 3);
  assert.equal(metrics.avgWaitTime, 5000); // (5000 + 3000 + 7000) / 3
  assert.equal(metrics.maxWaitTime, 7000);
  assert.equal(metrics.contentionEvents, 3);
});

test('LockMonitor - performance threshold alerts', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const monitor = new LockMonitor({
    eventEmitter,
    performanceThresholds: {
      maxWaitTime: 4000,
      maxBlockedQueries: 2,
      maxLockHoldTime: 20000
    }
  });
  
  const mockWaiting = [
    createMockWaitingQuery({ wait_time_ms: 5000 }), // Exceeds maxWaitTime
    createMockWaitingQuery({ wait_time_ms: 6000 }), // Exceeds maxWaitTime
    createMockWaitingQuery({ wait_time_ms: 2000 })  // Under threshold
  ];
  const mockBlocking = [
    createMockBlockingQuery({ 
      blocked_count: '1',
      blocking_duration_ms: 25000  // Exceeds maxLockHoldTime
    })
  ];
  
  await monitor.checkPerformanceThresholds(mockWaiting, mockBlocking);
  
  const events = eventEmitter.getEvents();
  
  // Should have 2 wait time alerts + 1 blocked queries alert + 1 lock hold time alert
  const waitAlerts = events.filter(e => 
    e.event instanceof LockWaitDetected && e.event.payload.type === 'long_wait'
  );
  assert.equal(waitAlerts.length, 2);
  
  const blockedQueryAlerts = events.filter(e =>
    e.event instanceof PerformanceThresholdExceeded && e.event.payload.type === 'blocked_queries'
  );
  assert.equal(blockedQueryAlerts.length, 1);
  
  const lockHoldAlerts = events.filter(e =>
    e.event instanceof PerformanceThresholdExceeded && e.event.payload.type === 'long_lock_hold'
  );
  assert.equal(lockHoldAlerts.length, 1);
});

test('LockMonitor - comprehensive lock report', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  const mockLocks = [
    createMockLock({ granted: true }),
    createMockLock({ granted: false })
  ];
  const mockWaiting = [createMockWaitingQuery()];
  const mockBlocking = [createMockBlockingQuery()];
  
  client.setMockLocks(mockLocks);
  client.setMockWaitingQueries(mockWaiting);
  client.setMockBlockingQueries(mockBlocking);
  
  const report = await monitor.getLockReport();
  
  assert(report.timestamp instanceof Date);
  assert.equal(report.summary.totalLocks, 2);
  assert.equal(report.summary.grantedLocks, 1);
  assert.equal(report.summary.waitingQueries, 1);
  assert.equal(report.summary.blockingQueries, 1);
  assert.equal(report.summary.deadlocks, 0);
  
  assert.equal(report.locks.length, 2);
  assert.equal(report.waitingQueries.length, 1);
  assert.equal(report.blockingQueries.length, 1);
  assert(Array.isArray(report.deadlocks));
  assert(Array.isArray(report.contentionHotspots));
  assert(typeof report.performanceMetrics === 'object');
});

test('LockMonitor - monitoring cycle execution', async () => {
  const client = new MockClient();
  const eventEmitter = new MockEventEmitter();
  const monitor = new LockMonitor({ eventEmitter });
  
  // Set up some mock data
  client.setMockLocks([createMockLock()]);
  client.setMockWaitingQueries([createMockWaitingQuery()]);
  client.setMockBlockingQueries([createMockBlockingQuery()]);
  
  await monitor.performMonitoringCycle();
  
  // Should have executed three main queries
  const queries = client.getQueries();
  assert(queries.length >= 3);
  
  // Performance metrics should be updated
  assert(monitor.performanceMetrics.totalQueries > 0);
});

test('LockMonitor - error handling in monitoring cycle', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  client.setShouldFail(true);
  
  await assert.rejects(
    monitor.performMonitoringCycle(),
    MonitorError
  );
});

test('LockMonitor - generate lock ID consistency', () => {
  const monitor = new LockMonitor();
  
  const lockRow1 = {
    locktype: 'relation',
    database: '12345',
    relation: '67890',
    classid: null,
    objid: null,
    virtualxid: null,
    transactionid: null
  };
  
  const lockRow2 = { ...lockRow1 };
  const lockRow3 = { ...lockRow1, relation: '99999' };
  
  const id1 = monitor.generateLockId(lockRow1);
  const id2 = monitor.generateLockId(lockRow2);
  const id3 = monitor.generateLockId(lockRow3);
  
  assert.equal(id1, id2); // Same lock should have same ID
  assert(id1 !== id3);    // Different lock should have different ID
});

test('LockMonitor - monitoring status and configuration', () => {
  const monitor = new LockMonitor({
    monitoringInterval: 5000,
    deadlockCheckInterval: 10000,
    maxWaitTime: 30000
  });
  
  const status = monitor.getMonitoringStatus();
  
  assert.equal(status.isMonitoring, false);
  assert.equal(status.monitoringInterval, 5000);
  assert.equal(status.deadlockCheckInterval, 10000);
  assert.equal(status.performanceThresholds.maxWaitTime, 30000);
  assert(typeof status.performanceMetrics === 'object');
});

test('LockMonitor - reset metrics', async () => {
  const client = new MockClient();
  const monitor = new LockMonitor();
  
  // Simulate some activity
  const mockWaiting = [createMockWaitingQuery({ wait_time_ms: 5000 })];
  await monitor.updatePerformanceMetrics(mockWaiting, []);
  
  assert(monitor.performanceMetrics.avgWaitTime > 0);
  assert(monitor.performanceMetrics.contentionEvents > 0);
  
  monitor.resetMetrics();
  
  assert.equal(monitor.performanceMetrics.avgWaitTime, 0);
  assert.equal(monitor.performanceMetrics.contentionEvents, 0);
  assert.equal(monitor.performanceMetrics.totalQueries, 0);
});

test('LockMonitor - automatic monitoring cycles', async (t) => {
  const client = new MockClient();
  const monitor = new LockMonitor({ 
    monitoringInterval: 50,  // Very short for testing
    deadlockCheckInterval: 100 
  });
  
  // Set up mock data
  client.setMockLocks([createMockLock()]);
  client.setMockWaitingQueries([]);
  client.setMockBlockingQueries([]);
  
  await monitor.startMonitoring(client);
  
  // Wait for a few cycles
  await new Promise(resolve => setTimeout(resolve, 120));
  
  await monitor.stopMonitoring();
  
  // Should have executed multiple monitoring cycles
  const queries = client.getQueries();
  assert(queries.length > 3); // Should have multiple query cycles
});

test('LockMonitor - event emission configuration', async () => {
  const eventEmitter = new MockEventEmitter();
  const monitor = new LockMonitor({ eventEmitter });
  
  // Manually emit an event to test the mechanism
  const testEvent = new DeadlockDetectedEvent({ test: 'data' });
  monitor.emitEvent(testEvent);
  
  const events = eventEmitter.getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'monitor_event');
  assert.equal(events[0].event, testEvent);
});