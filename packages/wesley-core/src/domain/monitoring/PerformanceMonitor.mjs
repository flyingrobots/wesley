/**
 * Performance Monitor - Query and Resource Tracking
 * Monitors query execution times, resource usage, slow queries,
 * index usage statistics, and connection pool health.
 * 
 * Licensed under the Apache License, Version 2.0
 */

import { DomainEvent } from '../Events.mjs';

/**
 * Custom error types for performance monitoring
 */
export class PerformanceMonitoringError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PerformanceMonitoringError';
    this.code = code;
    this.details = details;
  }
}

export class ResourceThresholdExceededError extends PerformanceMonitoringError {
  constructor(resource, threshold, actual, details = {}) {
    super(`Resource threshold exceeded: ${resource} (${actual} > ${threshold})`, 'RESOURCE_THRESHOLD_EXCEEDED', {
      resource,
      threshold,
      actual,
      ...details
    });
  }
}

export class SlowQueryDetectedError extends PerformanceMonitoringError {
  constructor(query, executionTime, threshold, details = {}) {
    super(`Slow query detected: ${executionTime}ms > ${threshold}ms`, 'SLOW_QUERY_DETECTED', {
      query,
      executionTime,
      threshold,
      ...details
    });
  }
}

/**
 * Domain events for performance monitoring
 */
export class PerformanceMonitoringStarted extends DomainEvent {
  constructor(options) {
    super('PERFORMANCE_MONITORING_STARTED', { options });
  }
}

export class PerformanceMonitoringStopped extends DomainEvent {
  constructor(stats) {
    super('PERFORMANCE_MONITORING_STOPPED', { stats });
  }
}

export class QueryExecutionTracked extends DomainEvent {
  constructor(queryId, metrics) {
    super('QUERY_EXECUTION_TRACKED', { queryId, metrics });
  }
}

export class SlowQueryDetected extends DomainEvent {
  constructor(queryId, metrics, threshold) {
    super('SLOW_QUERY_DETECTED', { queryId, metrics, threshold });
  }
}

export class ResourceUsageAlert extends DomainEvent {
  constructor(resource, usage, threshold) {
    super('RESOURCE_USAGE_ALERT', { resource, usage, threshold });
  }
}

export class IndexUsageAnalyzed extends DomainEvent {
  constructor(analysis) {
    super('INDEX_USAGE_ANALYZED', { analysis });
  }
}

export class ConnectionPoolStatus extends DomainEvent {
  constructor(status) {
    super('CONNECTION_POOL_STATUS', { status });
  }
}

/**
 * Query execution metrics
 */
export class QueryMetrics {
  constructor(queryId, sql, startTime = Date.now()) {
    this.queryId = queryId;
    this.sql = sql;
    this.startTime = startTime;
    this.endTime = null;
    this.executionTime = null;
    this.rowsReturned = null;
    this.rowsAffected = null;
    this.memoryUsed = null;
    this.diskReads = null;
    this.indexScans = null;
    this.sequentialScans = null;
    this.cacheHits = null;
    this.cacheMisses = null;
  }

  complete(endTime = Date.now(), stats = {}) {
    this.endTime = endTime;
    this.executionTime = endTime - this.startTime;
    Object.assign(this, stats);
    return this;
  }

  toJSON() {
    return {
      queryId: this.queryId,
      sql: this.sql,
      startTime: this.startTime,
      endTime: this.endTime,
      executionTime: this.executionTime,
      rowsReturned: this.rowsReturned,
      rowsAffected: this.rowsAffected,
      memoryUsed: this.memoryUsed,
      diskReads: this.diskReads,
      indexScans: this.indexScans,
      sequentialScans: this.sequentialScans,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };
  }
}

/**
 * Resource usage metrics
 */
export class ResourceMetrics {
  constructor(timestamp = Date.now()) {
    this.timestamp = timestamp;
    this.cpu = {
      usage: 0,       // CPU usage percentage
      system: 0,      // System CPU time
      user: 0,        // User CPU time
      idle: 0         // Idle time
    };
    this.memory = {
      used: 0,        // Used memory in bytes
      free: 0,        // Free memory in bytes
      total: 0,       // Total memory in bytes
      cached: 0,      // Cached memory in bytes
      buffers: 0      // Buffer memory in bytes
    };
    this.io = {
      reads: 0,       // Disk reads
      writes: 0,      // Disk writes
      readBytes: 0,   // Bytes read
      writeBytes: 0,  // Bytes written
      readTime: 0,    // Time spent reading
      writeTime: 0    // Time spent writing
    };
    this.network = {
      bytesIn: 0,     // Network bytes received
      bytesOut: 0,    // Network bytes sent
      packetsIn: 0,   // Network packets received
      packetsOut: 0   // Network packets sent
    };
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      cpu: this.cpu,
      memory: this.memory,
      io: this.io,
      network: this.network
    };
  }
}

/**
 * PerformanceMonitor - Core monitoring logic
 */
export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      slowQueryThreshold: 1000,      // ms
      queryHistoryLimit: 1000,       // number of queries to keep
      resourceSamplingInterval: 5000, // ms
      indexAnalysisInterval: 60000,  // ms
      connectionPoolCheckInterval: 10000, // ms
      enableQueryLogging: true,
      enableResourceMonitoring: true,
      enableIndexAnalysis: true,
      enableConnectionPoolMonitoring: true,
      resourceThresholds: {
        cpu: 80,        // %
        memory: 85,     // %
        diskIO: 90,     // %
        connections: 90 // %
      },
      ...options
    };

    this.listeners = new Map();
    this.queryHistory = [];
    this.resourceHistory = [];
    this.indexStats = new Map();
    this.connectionPoolStats = null;
    this.isMonitoring = false;
    this.intervals = new Map();
  }

  /**
   * Add event listener
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
    return this;
  }

  /**
   * Emit domain event
   */
  emit(event) {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));
    return this;
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.emit(new PerformanceMonitoringStarted(this.options));

    // Start resource monitoring
    if (this.options.enableResourceMonitoring) {
      const resourceInterval = setInterval(() => {
        this.collectResourceMetrics();
      }, this.options.resourceSamplingInterval);
      
      this.intervals.set('resource', resourceInterval);
    }

    // Start index analysis
    if (this.options.enableIndexAnalysis) {
      const indexInterval = setInterval(() => {
        this.analyzeIndexUsage();
      }, this.options.indexAnalysisInterval);
      
      this.intervals.set('index', indexInterval);
    }

    // Start connection pool monitoring
    if (this.options.enableConnectionPoolMonitoring) {
      const poolInterval = setInterval(() => {
        this.checkConnectionPool();
      }, this.options.connectionPoolCheckInterval);
      
      this.intervals.set('pool', poolInterval);
    }

    return this;
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    const stats = this.getMonitoringStats();
    this.emit(new PerformanceMonitoringStopped(stats));

    return stats;
  }

  /**
   * Track query execution
   */
  async trackQuery(sql, queryId = null) {
    if (!this.options.enableQueryLogging) {
      return null;
    }

    const id = queryId || this.generateQueryId(sql);
    const metrics = new QueryMetrics(id, sql);

    return {
      queryId: id,
      metrics,
      complete: (stats = {}) => {
        metrics.complete(Date.now(), stats);
        this.recordQueryMetrics(metrics);
        return metrics;
      }
    };
  }

  /**
   * Record completed query metrics
   */
  recordQueryMetrics(metrics) {
    // Add to history
    this.queryHistory.push(metrics);
    
    // Maintain history limit
    if (this.queryHistory.length > this.options.queryHistoryLimit) {
      this.queryHistory.shift();
    }

    // Emit tracking event
    this.emit(new QueryExecutionTracked(metrics.queryId, metrics.toJSON()));

    // Check for slow query
    if (metrics.executionTime > this.options.slowQueryThreshold) {
      this.emit(new SlowQueryDetected(metrics.queryId, metrics.toJSON(), this.options.slowQueryThreshold));
      
      if (this.options.strictMode) {
        throw new SlowQueryDetectedError(metrics.sql, metrics.executionTime, this.options.slowQueryThreshold);
      }
    }

    return metrics;
  }

  /**
   * Collect resource usage metrics
   */
  async collectResourceMetrics() {
    try {
      const metrics = await this.gatherResourceMetrics();
      
      this.resourceHistory.push(metrics);
      
      // Maintain history limit (keep last hour at 5-second intervals)
      const maxHistory = 720; // 1 hour
      if (this.resourceHistory.length > maxHistory) {
        this.resourceHistory.shift();
      }

      // Check thresholds
      this.checkResourceThresholds(metrics);
      
      return metrics;
      
    } catch (error) {
      throw new PerformanceMonitoringError('Failed to collect resource metrics', 'RESOURCE_COLLECTION_FAILED', { error: error.message });
    }
  }

  /**
   * Gather system resource metrics (mock implementation)
   */
  async gatherResourceMetrics() {
    // In real implementation, this would use system APIs
    const metrics = new ResourceMetrics();
    
    // Mock data for demonstration
    metrics.cpu.usage = Math.random() * 100;
    metrics.memory.used = Math.random() * 8000000000;
    metrics.memory.total = 8000000000;
    metrics.memory.free = metrics.memory.total - metrics.memory.used;
    metrics.io.reads = Math.floor(Math.random() * 1000);
    metrics.io.writes = Math.floor(Math.random() * 500);
    
    return metrics;
  }

  /**
   * Check resource usage against thresholds
   */
  checkResourceThresholds(metrics) {
    const { resourceThresholds } = this.options;
    
    // Check CPU usage
    if (metrics.cpu.usage > resourceThresholds.cpu) {
      this.emit(new ResourceUsageAlert('cpu', metrics.cpu.usage, resourceThresholds.cpu));
      
      if (this.options.strictMode) {
        throw new ResourceThresholdExceededError('cpu', resourceThresholds.cpu, metrics.cpu.usage);
      }
    }
    
    // Check memory usage
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsagePercent > resourceThresholds.memory) {
      this.emit(new ResourceUsageAlert('memory', memoryUsagePercent, resourceThresholds.memory));
      
      if (this.options.strictMode) {
        throw new ResourceThresholdExceededError('memory', resourceThresholds.memory, memoryUsagePercent);
      }
    }
  }

  /**
   * Analyze index usage patterns
   */
  async analyzeIndexUsage() {
    try {
      const analysis = await this.performIndexAnalysis();
      this.emit(new IndexUsageAnalyzed(analysis));
      return analysis;
      
    } catch (error) {
      throw new PerformanceMonitoringError('Index analysis failed', 'INDEX_ANALYSIS_FAILED', { error: error.message });
    }
  }

  /**
   * Perform index usage analysis (mock implementation)
   */
  async performIndexAnalysis() {
    // In real implementation, this would query pg_stat_user_indexes
    return {
      timestamp: Date.now(),
      totalIndexes: 25,
      unusedIndexes: [],
      heavilyUsedIndexes: [],
      recommendations: []
    };
  }

  /**
   * Check connection pool status
   */
  async checkConnectionPool() {
    try {
      const status = await this.gatherConnectionPoolStats();
      this.connectionPoolStats = status;
      this.emit(new ConnectionPoolStatus(status));
      
      // Check connection threshold
      const { resourceThresholds } = this.options;
      const connectionUsage = (status.activeConnections / status.maxConnections) * 100;
      
      if (connectionUsage > resourceThresholds.connections) {
        this.emit(new ResourceUsageAlert('connections', connectionUsage, resourceThresholds.connections));
      }
      
      return status;
      
    } catch (error) {
      throw new PerformanceMonitoringError('Connection pool check failed', 'CONNECTION_POOL_CHECK_FAILED', { error: error.message });
    }
  }

  /**
   * Gather connection pool statistics (mock implementation)
   */
  async gatherConnectionPoolStats() {
    // Mock connection pool stats
    return {
      timestamp: Date.now(),
      activeConnections: Math.floor(Math.random() * 20) + 1,
      idleConnections: Math.floor(Math.random() * 5),
      maxConnections: 25,
      queuedRequests: Math.floor(Math.random() * 3),
      totalConnections: 0,
      connectionErrors: 0,
      averageConnectionTime: Math.random() * 100
    };
  }

  /**
   * Get slow queries from history
   */
  getSlowQueries(threshold = null) {
    const limit = threshold || this.options.slowQueryThreshold;
    return this.queryHistory.filter(query => query.executionTime > limit);
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    const queries = this.queryHistory;
    
    if (queries.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        fastestQuery: null,
        slowestQuery: null
      };
    }

    const executionTimes = queries.map(q => q.executionTime).filter(t => t !== null);
    const slowQueries = queries.filter(q => q.executionTime > this.options.slowQueryThreshold);
    
    return {
      totalQueries: queries.length,
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      slowQueries: slowQueries.length,
      fastestQuery: queries.reduce((fastest, query) => 
        !fastest || (query.executionTime && query.executionTime < fastest.executionTime) ? query : fastest, null),
      slowestQuery: queries.reduce((slowest, query) => 
        !slowest || (query.executionTime && query.executionTime > slowest.executionTime) ? query : slowest, null)
    };
  }

  /**
   * Get resource usage statistics
   */
  getResourceStats() {
    if (this.resourceHistory.length === 0) {
      return {
        samples: 0,
        cpu: { average: 0, peak: 0 },
        memory: { average: 0, peak: 0 },
        io: { totalReads: 0, totalWrites: 0 }
      };
    }

    const cpuUsages = this.resourceHistory.map(r => r.cpu.usage);
    const memoryUsages = this.resourceHistory.map(r => (r.memory.used / r.memory.total) * 100);
    
    return {
      samples: this.resourceHistory.length,
      cpu: {
        average: cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length,
        peak: Math.max(...cpuUsages)
      },
      memory: {
        average: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
        peak: Math.max(...memoryUsages)
      },
      io: {
        totalReads: this.resourceHistory.reduce((sum, r) => sum + r.io.reads, 0),
        totalWrites: this.resourceHistory.reduce((sum, r) => sum + r.io.writes, 0)
      }
    };
  }

  /**
   * Get comprehensive monitoring statistics
   */
  getMonitoringStats() {
    return {
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - (this.startTime || Date.now()),
      queryStats: this.getQueryStats(),
      resourceStats: this.getResourceStats(),
      connectionPoolStats: this.connectionPoolStats,
      indexStats: Object.fromEntries(this.indexStats),
      options: this.options
    };
  }

  /**
   * Generate unique query ID
   */
  generateQueryId(sql) {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset monitoring data
   */
  reset() {
    this.queryHistory = [];
    this.resourceHistory = [];
    this.indexStats.clear();
    this.connectionPoolStats = null;
    return this;
  }
}

// Export singleton with default settings
export const performanceMonitor = new PerformanceMonitor();