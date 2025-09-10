/**
 * LockMonitor
 * Real-time monitoring of database locks, deadlock detection, and performance analysis
 */

import { DomainEvent } from '../Events.mjs';

/**
 * Monitor error classes
 */
export class MonitorError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'MonitorError';
    this.originalError = originalError;
    this.code = originalError?.code;
    this.details = originalError?.details;
  }
}

/**
 * Monitor Events
 */
export class DeadlockDetectedEvent extends DomainEvent {
  constructor(deadlockInfo) {
    super('DEADLOCK_DETECTED_MONITOR', deadlockInfo);
  }
}

export class LockWaitDetected extends DomainEvent {
  constructor(waitInfo) {
    super('LOCK_WAIT_DETECTED', waitInfo);
  }
}

export class PerformanceThresholdExceeded extends DomainEvent {
  constructor(thresholdInfo) {
    super('PERFORMANCE_THRESHOLD_EXCEEDED', thresholdInfo);
  }
}

export class LockContentionAlert extends DomainEvent {
  constructor(contentionInfo) {
    super('LOCK_CONTENTION_ALERT', contentionInfo);
  }
}

/**
 * Lock wait states
 */
export const LockWaitState = {
  WAITING: 'waiting',
  ACQUIRED: 'acquired',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
};

/**
 * LockMonitor - Real-time database lock monitoring and analysis
 */
export class LockMonitor {
  constructor(options = {}) {
    this.monitoringInterval = options.monitoringInterval || 5000; // 5 seconds
    this.deadlockCheckInterval = options.deadlockCheckInterval || 10000; // 10 seconds
    this.performanceThresholds = {
      maxWaitTime: options.maxWaitTime || 30000, // 30 seconds
      maxBlockedQueries: options.maxBlockedQueries || 10,
      maxLockHoldTime: options.maxLockHoldTime || 300000, // 5 minutes
      ...options.performanceThresholds
    };
    this.eventEmitter = options.eventEmitter || null;
    
    // State tracking
    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.deadlockTimer = null;
    this.lockHistory = new Map(); // lockId -> history
    this.waitQueue = new Map(); // waiting processes
    this.performanceMetrics = {
      totalQueries: 0,
      blockedQueries: 0,
      deadlockCount: 0,
      avgWaitTime: 0,
      maxWaitTime: 0,
      contentionEvents: 0
    };
  }

  /**
   * Start lock monitoring
   */
  async startMonitoring(client) {
    if (this.isMonitoring) {
      throw new MonitorError('Lock monitoring is already running');
    }

    this.client = client;
    this.isMonitoring = true;

    // Start periodic monitoring
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performMonitoringCycle();
      } catch (error) {
        console.warn('Lock monitoring cycle failed:', error.message);
      }
    }, this.monitoringInterval);

    // Start deadlock detection
    this.deadlockTimer = setInterval(async () => {
      try {
        await this.detectDeadlocks();
      } catch (error) {
        console.warn('Deadlock detection failed:', error.message);
      }
    }, this.deadlockCheckInterval);

    console.log('Lock monitoring started');
  }

  /**
   * Stop lock monitoring
   */
  async stopMonitoring() {
    this.isMonitoring = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.deadlockTimer) {
      clearInterval(this.deadlockTimer);
      this.deadlockTimer = null;
    }

    console.log('Lock monitoring stopped');
  }

  /**
   * Perform a single monitoring cycle
   */
  async performMonitoringCycle() {
    if (!this.isMonitoring || !this.client) return;

    try {
      const [locks, waitingQueries, blockingQueries] = await Promise.all([
        this.getCurrentLocks(),
        this.getWaitingQueries(),
        this.getBlockingQueries()
      ]);

      await this.analyzeLockContention(locks, waitingQueries, blockingQueries);
      await this.updatePerformanceMetrics(waitingQueries, blockingQueries);
      await this.checkPerformanceThresholds(waitingQueries, blockingQueries);
    } catch (error) {
      throw new MonitorError(`Monitoring cycle failed: ${error.message}`, error);
    }
  }

  /**
   * Get current locks from pg_locks
   */
  async getCurrentLocks(client = this.client) {
    try {
      const result = await client.query(`
        SELECT 
          l.locktype,
          l.database,
          l.relation,
          l.page,
          l.tuple,
          l.virtualxid,
          l.transactionid,
          l.classid,
          l.objid,
          l.objsubid,
          l.virtualtransaction,
          l.pid,
          l.mode,
          l.granted,
          l.fastpath,
          a.query as current_query,
          a.state,
          a.query_start,
          a.state_change,
          a.application_name,
          a.client_addr,
          EXTRACT(EPOCH FROM (now() - a.query_start)) * 1000 as query_duration_ms,
          CASE 
            WHEN l.granted THEN NULL
            ELSE EXTRACT(EPOCH FROM (now() - a.state_change)) * 1000
          END as wait_duration_ms
        FROM pg_locks l
        LEFT JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE l.pid IS NOT NULL
        ORDER BY l.granted ASC, query_duration_ms DESC
      `);

      return result.rows.map(row => ({
        lockId: this.generateLockId(row),
        lockType: row.locktype,
        relation: row.relation,
        transactionId: row.transactionid,
        virtualTransactionId: row.virtualtransaction,
        pid: row.pid,
        mode: row.mode,
        granted: row.granted,
        fastpath: row.fastpath,
        currentQuery: row.current_query,
        state: row.state,
        queryStart: row.query_start,
        stateChange: row.state_change,
        applicationName: row.application_name,
        clientAddr: row.client_addr,
        queryDuration: row.query_duration_ms,
        waitDuration: row.wait_duration_ms || 0
      }));
    } catch (error) {
      throw new MonitorError(`Failed to get current locks: ${error.message}`, error);
    }
  }

  /**
   * Get queries waiting for locks
   */
  async getWaitingQueries(client = this.client) {
    try {
      const result = await client.query(`
        SELECT 
          blocked.pid as blocked_pid,
          blocked.query as blocked_query,
          blocked.state,
          blocked.query_start,
          blocked.state_change,
          blocked.application_name,
          blocked.client_addr,
          blocking.pid as blocking_pid,
          blocking.query as blocking_query,
          blocking.state as blocking_state,
          blocking.application_name as blocking_app,
          blocked_locks.mode as blocked_mode,
          blocking_locks.mode as blocking_mode,
          blocked_locks.locktype,
          blocked_locks.relation,
          EXTRACT(EPOCH FROM (now() - blocked.state_change)) * 1000 as wait_time_ms,
          EXTRACT(EPOCH FROM (now() - blocking.query_start)) * 1000 as blocking_duration_ms
        FROM pg_locks blocked_locks
        JOIN pg_stat_activity blocked ON blocked_locks.pid = blocked.pid
        JOIN pg_locks blocking_locks ON (
          blocked_locks.locktype = blocking_locks.locktype
          AND blocked_locks.database IS NOT DISTINCT FROM blocking_locks.database
          AND blocked_locks.relation IS NOT DISTINCT FROM blocking_locks.relation
          AND blocked_locks.page IS NOT DISTINCT FROM blocking_locks.page
          AND blocked_locks.tuple IS NOT DISTINCT FROM blocking_locks.tuple
          AND blocked_locks.virtualxid IS NOT DISTINCT FROM blocking_locks.virtualxid
          AND blocked_locks.transactionid IS NOT DISTINCT FROM blocking_locks.transactionid
          AND blocked_locks.classid IS NOT DISTINCT FROM blocking_locks.classid
          AND blocked_locks.objid IS NOT DISTINCT FROM blocking_locks.objid
          AND blocked_locks.objsubid IS NOT DISTINCT FROM blocking_locks.objsubid
        )
        JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
        WHERE NOT blocked_locks.granted 
          AND blocking_locks.granted
          AND blocked.pid != blocking.pid
        ORDER BY wait_time_ms DESC
      `);

      return result.rows.map(row => ({
        blockedPid: row.blocked_pid,
        blockedQuery: row.blocked_query,
        blockedState: row.state,
        blockingPid: row.blocking_pid,
        blockingQuery: row.blocking_query,
        blockingState: row.blocking_state,
        blockedMode: row.blocked_mode,
        blockingMode: row.blocking_mode,
        lockType: row.locktype,
        relation: row.relation,
        waitTime: row.wait_time_ms || 0,
        blockingDuration: row.blocking_duration_ms || 0,
        blockedApp: row.application_name,
        blockingApp: row.blocking_app,
        clientAddr: row.client_addr
      }));
    } catch (error) {
      throw new MonitorError(`Failed to get waiting queries: ${error.message}`, error);
    }
  }

  /**
   * Get queries that are blocking others
   */
  async getBlockingQueries(client = this.client) {
    try {
      const result = await client.query(`
        SELECT 
          blocking.pid,
          blocking.query,
          blocking.state,
          blocking.query_start,
          blocking.application_name,
          blocking.client_addr,
          COUNT(blocked.pid) as blocked_count,
          MAX(EXTRACT(EPOCH FROM (now() - blocked.state_change)) * 1000) as max_wait_time,
          AVG(EXTRACT(EPOCH FROM (now() - blocked.state_change)) * 1000) as avg_wait_time,
          EXTRACT(EPOCH FROM (now() - blocking.query_start)) * 1000 as blocking_duration_ms,
          array_agg(DISTINCT blocked.pid) as blocked_pids
        FROM pg_locks blocking_locks
        JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
        JOIN pg_locks blocked_locks ON (
          blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        )
        JOIN pg_stat_activity blocked ON blocked_locks.pid = blocked.pid
        WHERE blocking_locks.granted 
          AND NOT blocked_locks.granted
          AND blocking.pid != blocked.pid
        GROUP BY blocking.pid, blocking.query, blocking.state, blocking.query_start, 
                 blocking.application_name, blocking.client_addr
        HAVING COUNT(blocked.pid) > 0
        ORDER BY blocked_count DESC, max_wait_time DESC
      `);

      return result.rows.map(row => ({
        blockingPid: row.pid,
        blockingQuery: row.query,
        blockingState: row.state,
        queryStart: row.query_start,
        applicationName: row.application_name,
        clientAddr: row.client_addr,
        blockedCount: parseInt(row.blocked_count),
        maxWaitTime: row.max_wait_time || 0,
        avgWaitTime: row.avg_wait_time || 0,
        blockingDuration: row.blocking_duration_ms || 0,
        blockedPids: row.blocked_pids || []
      }));
    } catch (error) {
      throw new MonitorError(`Failed to get blocking queries: ${error.message}`, error);
    }
  }

  /**
   * Detect potential deadlocks
   */
  async detectDeadlocks(client = this.client) {
    if (!client) return [];

    try {
      const waitingQueries = await this.getWaitingQueries(client);
      const deadlocks = this.analyzeDeadlockChains(waitingQueries);

      for (const deadlock of deadlocks) {
        this.performanceMetrics.deadlockCount++;
        this.emitEvent(new DeadlockDetectedEvent(deadlock));
      }

      return deadlocks;
    } catch (error) {
      throw new MonitorError(`Deadlock detection failed: ${error.message}`, error);
    }
  }

  /**
   * Analyze chains of waiting processes for circular dependencies (deadlocks)
   */
  analyzeDeadlockChains(waitingQueries) {
    const graph = new Map(); // pid -> array of pids it's waiting for
    const reverseGraph = new Map(); // pid -> array of pids waiting for it

    // Build dependency graphs
    for (const query of waitingQueries) {
      if (!graph.has(query.blockedPid)) {
        graph.set(query.blockedPid, []);
      }
      if (!reverseGraph.has(query.blockingPid)) {
        reverseGraph.set(query.blockingPid, []);
      }

      graph.get(query.blockedPid).push(query.blockingPid);
      reverseGraph.get(query.blockingPid).push(query.blockedPid);
    }

    // Find cycles using DFS
    const deadlocks = [];
    const visited = new Set();
    const recursionStack = new Set();

    const findCycles = (pid, path) => {
      if (recursionStack.has(pid)) {
        // Found a cycle - extract it
        const cycleStart = path.indexOf(pid);
        const cycle = path.slice(cycleStart);
        const cycleInfo = this.buildDeadlockInfo(cycle, waitingQueries);
        deadlocks.push(cycleInfo);
        return true;
      }

      if (visited.has(pid)) {
        return false;
      }

      visited.add(pid);
      recursionStack.add(pid);
      path.push(pid);

      const waitingFor = graph.get(pid) || [];
      for (const blockingPid of waitingFor) {
        if (findCycles(blockingPid, [...path])) {
          // Continue to find all cycles
        }
      }

      recursionStack.delete(pid);
      return false;
    };

    // Check each process for cycles
    for (const pid of graph.keys()) {
      if (!visited.has(pid)) {
        findCycles(pid, []);
      }
    }

    return deadlocks;
  }

  /**
   * Build detailed deadlock information
   */
  buildDeadlockInfo(cycle, waitingQueries) {
    const processes = [];
    
    for (let i = 0; i < cycle.length; i++) {
      const currentPid = cycle[i];
      const nextPid = cycle[(i + 1) % cycle.length];
      
      const waitInfo = waitingQueries.find(q => 
        q.blockedPid === currentPid && q.blockingPid === nextPid
      );

      if (waitInfo) {
        processes.push({
          pid: currentPid,
          query: waitInfo.blockedQuery,
          waitingFor: nextPid,
          waitTime: waitInfo.waitTime,
          lockType: waitInfo.lockType,
          mode: waitInfo.blockedMode,
          applicationName: waitInfo.blockedApp
        });
      }
    }

    return {
      cycleLength: cycle.length,
      processes,
      detectedAt: new Date(),
      totalWaitTime: processes.reduce((sum, p) => sum + (p.waitTime || 0), 0),
      maxWaitTime: Math.max(...processes.map(p => p.waitTime || 0))
    };
  }

  /**
   * Analyze lock contention patterns
   */
  async analyzeLockContention(locks, waitingQueries, blockingQueries) {
    const contentionHotspots = new Map(); // relation -> contention info

    // Analyze table/index contention
    for (const query of waitingQueries) {
      if (query.relation) {
        if (!contentionHotspots.has(query.relation)) {
          contentionHotspots.set(query.relation, {
            relation: query.relation,
            lockType: query.lockType,
            waitingCount: 0,
            totalWaitTime: 0,
            maxWaitTime: 0,
            avgWaitTime: 0,
            contentionEvents: 0
          });
        }

        const contention = contentionHotspots.get(query.relation);
        contention.waitingCount++;
        contention.totalWaitTime += query.waitTime;
        contention.maxWaitTime = Math.max(contention.maxWaitTime, query.waitTime);
        contention.avgWaitTime = contention.totalWaitTime / contention.waitingCount;
        contention.contentionEvents++;
      }
    }

    // Emit alerts for high contention
    for (const contention of contentionHotspots.values()) {
      if (contention.waitingCount >= 3 && contention.avgWaitTime > 5000) {
        this.emitEvent(new LockContentionAlert(contention));
      }
    }

    return Array.from(contentionHotspots.values());
  }

  /**
   * Update performance metrics
   */
  async updatePerformanceMetrics(waitingQueries, blockingQueries) {
    this.performanceMetrics.totalQueries = waitingQueries.length + blockingQueries.length;
    this.performanceMetrics.blockedQueries = waitingQueries.length;

    if (waitingQueries.length > 0) {
      const waitTimes = waitingQueries.map(q => q.waitTime);
      this.performanceMetrics.avgWaitTime = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
      this.performanceMetrics.maxWaitTime = Math.max(this.performanceMetrics.maxWaitTime, Math.max(...waitTimes));
    }

    this.performanceMetrics.contentionEvents += waitingQueries.length;
  }

  /**
   * Check performance thresholds and emit alerts
   */
  async checkPerformanceThresholds(waitingQueries, blockingQueries) {
    const thresholds = this.performanceThresholds;

    // Check max wait time threshold
    const longWaits = waitingQueries.filter(q => q.waitTime > thresholds.maxWaitTime);
    for (const longWait of longWaits) {
      this.emitEvent(new LockWaitDetected({
        type: 'long_wait',
        threshold: thresholds.maxWaitTime,
        actual: longWait.waitTime,
        blockedPid: longWait.blockedPid,
        blockingPid: longWait.blockingPid,
        query: longWait.blockedQuery
      }));
    }

    // Check blocked queries threshold
    if (waitingQueries.length > thresholds.maxBlockedQueries) {
      this.emitEvent(new PerformanceThresholdExceeded({
        type: 'blocked_queries',
        threshold: thresholds.maxBlockedQueries,
        actual: waitingQueries.length,
        blockedQueries: waitingQueries.length
      }));
    }

    // Check lock hold time threshold
    const longHolds = blockingQueries.filter(q => q.blockingDuration > thresholds.maxLockHoldTime);
    for (const longHold of longHolds) {
      this.emitEvent(new PerformanceThresholdExceeded({
        type: 'long_lock_hold',
        threshold: thresholds.maxLockHoldTime,
        actual: longHold.blockingDuration,
        blockingPid: longHold.blockingPid,
        blockedCount: longHold.blockedCount,
        query: longHold.blockingQuery
      }));
    }
  }

  /**
   * Get comprehensive lock report
   */
  async getLockReport(client = this.client) {
    if (!client) {
      throw new MonitorError('No database client available');
    }

    try {
      const [locks, waitingQueries, blockingQueries, deadlocks] = await Promise.all([
        this.getCurrentLocks(client),
        this.getWaitingQueries(client),
        this.getBlockingQueries(client),
        this.detectDeadlocks(client)
      ]);

      const contention = await this.analyzeLockContention(locks, waitingQueries, blockingQueries);

      return {
        timestamp: new Date(),
        summary: {
          totalLocks: locks.length,
          grantedLocks: locks.filter(l => l.granted).length,
          waitingQueries: waitingQueries.length,
          blockingQueries: blockingQueries.length,
          deadlocks: deadlocks.length,
          contentionHotspots: contention.length
        },
        performanceMetrics: { ...this.performanceMetrics },
        locks,
        waitingQueries,
        blockingQueries,
        deadlocks,
        contentionHotspots: contention,
        isMonitoring: this.isMonitoring
      };
    } catch (error) {
      throw new MonitorError(`Failed to generate lock report: ${error.message}`, error);
    }
  }

  /**
   * Generate a unique lock ID for tracking
   */
  generateLockId(lockRow) {
    const parts = [
      lockRow.locktype,
      lockRow.database || '',
      lockRow.relation || '',
      lockRow.classid || '',
      lockRow.objid || '',
      lockRow.virtualxid || '',
      lockRow.transactionid || ''
    ];
    return parts.join('|');
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      monitoringInterval: this.monitoringInterval,
      deadlockCheckInterval: this.deadlockCheckInterval,
      performanceThresholds: { ...this.performanceThresholds },
      performanceMetrics: { ...this.performanceMetrics }
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.performanceMetrics = {
      totalQueries: 0,
      blockedQueries: 0,
      deadlockCount: 0,
      avgWaitTime: 0,
      maxWaitTime: 0,
      contentionEvents: 0
    };
  }

  /**
   * Emit event if event emitter is configured
   */
  emitEvent(event) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit('monitor_event', event);
    }
  }
}

// Export singleton for convenience
export const lockMonitor = new LockMonitor();