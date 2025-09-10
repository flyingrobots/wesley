/**
 * Performance Monitor Tests
 * Tests for query tracking, resource monitoring, and performance analysis
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  PerformanceMonitor, 
  QueryMetrics,
  ResourceMetrics,
  PerformanceMonitoringError, 
  ResourceThresholdExceededError,
  SlowQueryDetectedError,
  performanceMonitor 
} from '../src/domain/monitoring/PerformanceMonitor.mjs';

test('PerformanceMonitor can be constructed with default options', () => {
  const monitor = new PerformanceMonitor();
  
  assert.equal(monitor.options.slowQueryThreshold, 1000);
  assert.equal(monitor.options.queryHistoryLimit, 1000);
  assert.equal(monitor.options.resourceSamplingInterval, 5000);
  assert.equal(monitor.options.enableQueryLogging, true);
  assert.equal(monitor.options.enableResourceMonitoring, true);
  assert.equal(monitor.options.enableIndexAnalysis, true);
});

test('PerformanceMonitor can be constructed with custom options', () => {
  const monitor = new PerformanceMonitor({
    slowQueryThreshold: 500,
    queryHistoryLimit: 100,
    enableQueryLogging: false,
    resourceThresholds: { cpu: 90, memory: 95 }
  });
  
  assert.equal(monitor.options.slowQueryThreshold, 500);
  assert.equal(monitor.options.queryHistoryLimit, 100);
  assert.equal(monitor.options.enableQueryLogging, false);
  assert.equal(monitor.options.resourceThresholds.cpu, 90);
  assert.equal(monitor.options.resourceThresholds.memory, 95);
});

test('QueryMetrics tracks execution correctly', () => {
  const startTime = Date.now();
  const metrics = new QueryMetrics('query_001', 'SELECT * FROM users', startTime);
  
  assert.equal(metrics.queryId, 'query_001');
  assert.equal(metrics.sql, 'SELECT * FROM users');
  assert.equal(metrics.startTime, startTime);
  assert.equal(metrics.endTime, null);
  assert.equal(metrics.executionTime, null);
  
  const endTime = startTime + 150;
  const completedMetrics = metrics.complete(endTime, {
    rowsReturned: 25,
    memoryUsed: 1024
  });
  
  assert.equal(completedMetrics.endTime, endTime);
  assert.equal(completedMetrics.executionTime, 150);
  assert.equal(completedMetrics.rowsReturned, 25);
  assert.equal(completedMetrics.memoryUsed, 1024);
});

test('QueryMetrics toJSON serializes correctly', () => {
  const metrics = new QueryMetrics('query_001', 'SELECT * FROM users');
  metrics.complete(Date.now(), { rowsReturned: 10 });
  
  const json = metrics.toJSON();
  
  assert.equal(json.queryId, 'query_001');
  assert.equal(json.sql, 'SELECT * FROM users');
  assert.equal(json.rowsReturned, 10);
  assert(typeof json.executionTime === 'number');
});

test('ResourceMetrics initializes correctly', () => {
  const timestamp = Date.now();
  const metrics = new ResourceMetrics(timestamp);
  
  assert.equal(metrics.timestamp, timestamp);
  assert.equal(metrics.cpu.usage, 0);
  assert.equal(metrics.memory.used, 0);
  assert.equal(metrics.io.reads, 0);
  assert.equal(metrics.network.bytesIn, 0);
});

test('ResourceMetrics toJSON serializes correctly', () => {
  const metrics = new ResourceMetrics();
  metrics.cpu.usage = 50;
  metrics.memory.used = 1000000;
  
  const json = metrics.toJSON();
  
  assert.equal(json.cpu.usage, 50);
  assert.equal(json.memory.used, 1000000);
  assert(typeof json.timestamp === 'number');
});

test('trackQuery returns tracker object', async () => {
  const monitor = new PerformanceMonitor();
  
  const tracker = await monitor.trackQuery('SELECT * FROM users', 'custom_query_id');
  
  assert.equal(tracker.queryId, 'custom_query_id');
  assert(tracker.metrics instanceof QueryMetrics);
  assert(typeof tracker.complete === 'function');
});

test('trackQuery generates ID when not provided', async () => {
  const monitor = new PerformanceMonitor();
  
  const tracker = await monitor.trackQuery('SELECT * FROM users');
  
  assert(typeof tracker.queryId === 'string');
  assert(tracker.queryId.length > 0);
});

test('trackQuery returns null when logging disabled', async () => {
  const monitor = new PerformanceMonitor({ enableQueryLogging: false });
  
  const tracker = await monitor.trackQuery('SELECT * FROM users');
  
  assert.equal(tracker, null);
});

test('recordQueryMetrics adds to history', async () => {
  const monitor = new PerformanceMonitor({ queryHistoryLimit: 5 });
  
  const metrics = new QueryMetrics('query_001', 'SELECT * FROM users');
  metrics.complete(Date.now(), { rowsReturned: 10 });
  
  monitor.recordQueryMetrics(metrics);
  
  assert.equal(monitor.queryHistory.length, 1);
  assert.equal(monitor.queryHistory[0].queryId, 'query_001');
});

test('recordQueryMetrics maintains history limit', async () => {
  const monitor = new PerformanceMonitor({ queryHistoryLimit: 2 });
  
  // Add 3 queries
  for (let i = 1; i <= 3; i++) {
    const metrics = new QueryMetrics(`query_${i}`, 'SELECT * FROM users');
    metrics.complete(Date.now(), { rowsReturned: 10 });
    monitor.recordQueryMetrics(metrics);
  }
  
  assert.equal(monitor.queryHistory.length, 2);
  assert.equal(monitor.queryHistory[0].queryId, 'query_2'); // First one removed
  assert.equal(monitor.queryHistory[1].queryId, 'query_3');
});

test('recordQueryMetrics detects slow queries', async () => {
  const monitor = new PerformanceMonitor({ slowQueryThreshold: 100 });
  let slowQueryEvent = null;
  
  monitor.on('SLOW_QUERY_DETECTED', (event) => {
    slowQueryEvent = event;
  });
  
  const metrics = new QueryMetrics('slow_query', 'SELECT * FROM large_table');
  metrics.complete(Date.now(), { executionTime: 150 }); // Manually set for test
  metrics.executionTime = 150; // Override since complete() calculates from timestamps
  
  monitor.recordQueryMetrics(metrics);
  
  assert(slowQueryEvent);
  assert.equal(slowQueryEvent.type, 'SLOW_QUERY_DETECTED');
  assert.equal(slowQueryEvent.payload.queryId, 'slow_query');
});

test('recordQueryMetrics throws in strict mode for slow queries', async () => {
  const monitor = new PerformanceMonitor({ 
    slowQueryThreshold: 100, 
    strictMode: true 
  });
  
  const metrics = new QueryMetrics('slow_query', 'SELECT * FROM large_table');
  metrics.complete(Date.now(), { executionTime: 150 });
  metrics.executionTime = 150; // Override for test
  
  assert.throws(
    () => monitor.recordQueryMetrics(metrics),
    SlowQueryDetectedError
  );
});

test('startMonitoring sets up intervals', async () => {
  const monitor = new PerformanceMonitor({
    resourceSamplingInterval: 100,
    indexAnalysisInterval: 200,
    connectionPoolCheckInterval: 300
  });
  
  assert.equal(monitor.isMonitoring, false);
  assert.equal(monitor.intervals.size, 0);
  
  await monitor.startMonitoring();
  
  assert.equal(monitor.isMonitoring, true);
  assert.equal(monitor.intervals.size, 3);
  
  // Clean up
  await monitor.stopMonitoring();
});

test('stopMonitoring clears intervals and returns stats', async () => {
  const monitor = new PerformanceMonitor();
  let events = [];
  
  monitor.on('PERFORMANCE_MONITORING_STARTED', (event) => events.push(event.type));
  monitor.on('PERFORMANCE_MONITORING_STOPPED', (event) => events.push(event.type));
  
  await monitor.startMonitoring();
  const stats = await monitor.stopMonitoring();
  
  assert.equal(monitor.isMonitoring, false);
  assert.equal(monitor.intervals.size, 0);
  assert(typeof stats === 'object');
  assert.equal(events.length, 2);
});

test('collectResourceMetrics gathers and stores metrics', async () => {
  const monitor = new PerformanceMonitor();
  
  const metrics = await monitor.collectResourceMetrics();
  
  assert(metrics instanceof ResourceMetrics);
  assert.equal(monitor.resourceHistory.length, 1);
  assert(typeof metrics.cpu.usage === 'number');
  assert(typeof metrics.memory.used === 'number');
});

test('collectResourceMetrics maintains history limit', async () => {
  const monitor = new PerformanceMonitor();
  
  // Simulate adding many metrics (more than maxHistory = 720)
  for (let i = 0; i < 725; i++) {
    await monitor.collectResourceMetrics();
  }
  
  assert(monitor.resourceHistory.length <= 720);
});

test('checkResourceThresholds emits alerts for high usage', async () => {
  const monitor = new PerformanceMonitor({
    resourceThresholds: { cpu: 50, memory: 60 }
  });
  
  let alertEvent = null;
  monitor.on('RESOURCE_USAGE_ALERT', (event) => {
    alertEvent = event;
  });
  
  const metrics = new ResourceMetrics();
  metrics.cpu.usage = 75; // Above threshold
  
  monitor.checkResourceThresholds(metrics);
  
  assert(alertEvent);
  assert.equal(alertEvent.type, 'RESOURCE_USAGE_ALERT');
  assert.equal(alertEvent.payload.resource, 'cpu');
  assert.equal(alertEvent.payload.usage, 75);
});

test('checkResourceThresholds throws in strict mode', async () => {
  const monitor = new PerformanceMonitor({
    resourceThresholds: { cpu: 50 },
    strictMode: true
  });
  
  const metrics = new ResourceMetrics();
  metrics.cpu.usage = 75;
  
  assert.throws(
    () => monitor.checkResourceThresholds(metrics),
    ResourceThresholdExceededError
  );
});

test('analyzeIndexUsage performs analysis', async () => {
  const monitor = new PerformanceMonitor();
  let analysisEvent = null;
  
  monitor.on('INDEX_USAGE_ANALYZED', (event) => {
    analysisEvent = event;
  });
  
  const analysis = await monitor.analyzeIndexUsage();
  
  assert(typeof analysis === 'object');
  assert(typeof analysis.totalIndexes === 'number');
  assert(Array.isArray(analysis.unusedIndexes));
  assert(analysisEvent);
  assert.equal(analysisEvent.type, 'INDEX_USAGE_ANALYZED');
});

test('checkConnectionPool monitors pool status', async () => {
  const monitor = new PerformanceMonitor();
  let statusEvent = null;
  
  monitor.on('CONNECTION_POOL_STATUS', (event) => {
    statusEvent = event;
  });
  
  const status = await monitor.checkConnectionPool();
  
  assert(typeof status === 'object');
  assert(typeof status.activeConnections === 'number');
  assert(typeof status.maxConnections === 'number');
  assert(statusEvent);
  assert.equal(statusEvent.type, 'CONNECTION_POOL_STATUS');
});

test('checkConnectionPool emits alerts for high connection usage', async () => {
  const monitor = new PerformanceMonitor({
    resourceThresholds: { connections: 80 }
  });
  
  // Mock high connection usage
  monitor.gatherConnectionPoolStats = async () => ({
    timestamp: Date.now(),
    activeConnections: 22,
    maxConnections: 25, // 88% usage, above 80% threshold
    idleConnections: 3,
    queuedRequests: 0,
    totalConnections: 0,
    connectionErrors: 0,
    averageConnectionTime: 50
  });
  
  let alertEvent = null;
  monitor.on('RESOURCE_USAGE_ALERT', (event) => {
    alertEvent = event;
  });
  
  await monitor.checkConnectionPool();
  
  assert(alertEvent);
  assert.equal(alertEvent.payload.resource, 'connections');
});

test('getSlowQueries filters by threshold', async () => {
  const monitor = new PerformanceMonitor();
  
  // Add mix of slow and fast queries
  const fastQuery = new QueryMetrics('fast', 'SELECT 1');
  fastQuery.executionTime = 50;
  
  const slowQuery = new QueryMetrics('slow', 'SELECT * FROM large_table');
  slowQuery.executionTime = 1500;
  
  monitor.queryHistory = [fastQuery, slowQuery];
  
  const slowQueries = monitor.getSlowQueries();
  assert.equal(slowQueries.length, 1);
  assert.equal(slowQueries[0].queryId, 'slow');
  
  const verySlowQueries = monitor.getSlowQueries(2000);
  assert.equal(verySlowQueries.length, 0);
});

test('getQueryStats calculates correct statistics', () => {
  const monitor = new PerformanceMonitor();
  
  // Add sample queries
  const queries = [
    { executionTime: 100 },
    { executionTime: 200 },
    { executionTime: 1500 }, // Slow query
    { executionTime: 300 }
  ].map((data, i) => {
    const metrics = new QueryMetrics(`query_${i}`, 'SELECT 1');
    metrics.executionTime = data.executionTime;
    return metrics;
  });
  
  monitor.queryHistory = queries;
  
  const stats = monitor.getQueryStats();
  
  assert.equal(stats.totalQueries, 4);
  assert.equal(stats.averageExecutionTime, 525); // (100+200+1500+300)/4
  assert.equal(stats.slowQueries, 1);
  assert.equal(stats.fastestQuery.executionTime, 100);
  assert.equal(stats.slowestQuery.executionTime, 1500);
});

test('getQueryStats handles empty history', () => {
  const monitor = new PerformanceMonitor();
  
  const stats = monitor.getQueryStats();
  
  assert.equal(stats.totalQueries, 0);
  assert.equal(stats.averageExecutionTime, 0);
  assert.equal(stats.slowQueries, 0);
  assert.equal(stats.fastestQuery, null);
  assert.equal(stats.slowestQuery, null);
});

test('getResourceStats calculates correct statistics', () => {
  const monitor = new PerformanceMonitor();
  
  // Add sample resource metrics
  const metrics1 = new ResourceMetrics();
  metrics1.cpu.usage = 30;
  metrics1.memory.used = 1000000;
  metrics1.memory.total = 2000000;
  metrics1.io.reads = 100;
  
  const metrics2 = new ResourceMetrics();
  metrics2.cpu.usage = 70;
  metrics2.memory.used = 1500000;
  metrics2.memory.total = 2000000;
  metrics2.io.reads = 200;
  
  monitor.resourceHistory = [metrics1, metrics2];
  
  const stats = monitor.getResourceStats();
  
  assert.equal(stats.samples, 2);
  assert.equal(stats.cpu.average, 50); // (30+70)/2
  assert.equal(stats.cpu.peak, 70);
  assert.equal(stats.memory.average, 62.5); // ((50+75)/2)% usage
  assert.equal(stats.memory.peak, 75);
  assert.equal(stats.io.totalReads, 300);
});

test('getResourceStats handles empty history', () => {
  const monitor = new PerformanceMonitor();
  
  const stats = monitor.getResourceStats();
  
  assert.equal(stats.samples, 0);
  assert.equal(stats.cpu.average, 0);
  assert.equal(stats.cpu.peak, 0);
  assert.equal(stats.memory.average, 0);
  assert.equal(stats.memory.peak, 0);
  assert.equal(stats.io.totalReads, 0);
  assert.equal(stats.io.totalWrites, 0);
});

test('getMonitoringStats returns comprehensive stats', () => {
  const monitor = new PerformanceMonitor();
  monitor.isMonitoring = true;
  
  const stats = monitor.getMonitoringStats();
  
  assert.equal(stats.isMonitoring, true);
  assert(typeof stats.uptime === 'number');
  assert(typeof stats.queryStats === 'object');
  assert(typeof stats.resourceStats === 'object');
  assert(typeof stats.options === 'object');
});

test('generateQueryId creates unique identifiers', () => {
  const monitor = new PerformanceMonitor();
  
  const id1 = monitor.generateQueryId('SELECT 1');
  const id2 = monitor.generateQueryId('SELECT 1');
  
  assert(typeof id1 === 'string');
  assert(typeof id2 === 'string');
  assert.notEqual(id1, id2);
  assert(id1.startsWith('query_'));
  assert(id2.startsWith('query_'));
});

test('reset clears all monitoring data', () => {
  const monitor = new PerformanceMonitor();
  
  // Add some data
  monitor.queryHistory.push(new QueryMetrics('test', 'SELECT 1'));
  monitor.resourceHistory.push(new ResourceMetrics());
  monitor.indexStats.set('test_index', { usage: 100 });
  monitor.connectionPoolStats = { active: 5 };
  
  assert.equal(monitor.queryHistory.length, 1);
  assert.equal(monitor.resourceHistory.length, 1);
  assert.equal(monitor.indexStats.size, 1);
  assert(monitor.connectionPoolStats);
  
  monitor.reset();
  
  assert.equal(monitor.queryHistory.length, 0);
  assert.equal(monitor.resourceHistory.length, 0);
  assert.equal(monitor.indexStats.size, 0);
  assert.equal(monitor.connectionPoolStats, null);
});

test('singleton instance is available', () => {
  assert(performanceMonitor instanceof PerformanceMonitor);
  assert.equal(performanceMonitor.options.slowQueryThreshold, 1000);
});

test('custom error types have correct properties', () => {
  const resourceError = new ResourceThresholdExceededError('cpu', 80, 95, { context: 'test' });
  assert.equal(resourceError.name, 'PerformanceMonitoringError');
  assert.equal(resourceError.code, 'RESOURCE_THRESHOLD_EXCEEDED');
  assert.equal(resourceError.details.resource, 'cpu');
  assert.equal(resourceError.details.threshold, 80);
  assert.equal(resourceError.details.actual, 95);
  
  const slowQueryError = new SlowQueryDetectedError('SELECT *', 2000, 1000, { table: 'users' });
  assert.equal(slowQueryError.name, 'PerformanceMonitoringError');
  assert.equal(slowQueryError.code, 'SLOW_QUERY_DETECTED');
  assert.equal(slowQueryError.details.executionTime, 2000);
  assert.equal(slowQueryError.details.threshold, 1000);
  assert.equal(slowQueryError.details.table, 'users');
});

test('event system works correctly', async () => {
  const monitor = new PerformanceMonitor();
  const events = [];
  
  monitor.on('QUERY_EXECUTION_TRACKED', (event) => events.push(event.type));
  monitor.on('RESOURCE_USAGE_ALERT', (event) => events.push(event.type));
  
  // Track a query
  const tracker = await monitor.trackQuery('SELECT 1');
  tracker.complete();
  
  // Trigger resource alert
  const metrics = new ResourceMetrics();
  metrics.cpu.usage = 95;
  monitor.checkResourceThresholds(metrics);
  
  assert.equal(events.length, 2);
  assert.equal(events[0], 'QUERY_EXECUTION_TRACKED');
  assert.equal(events[1], 'RESOURCE_USAGE_ALERT');
});

test('integration test with full monitoring cycle', async () => {
  const monitor = new PerformanceMonitor({
    slowQueryThreshold: 100,
    resourceSamplingInterval: 10,
    queryHistoryLimit: 10
  });
  
  const events = [];
  monitor.on('PERFORMANCE_MONITORING_STARTED', () => events.push('started'));
  monitor.on('PERFORMANCE_MONITORING_STOPPED', () => events.push('stopped'));
  monitor.on('QUERY_EXECUTION_TRACKED', () => events.push('query'));
  
  // Start monitoring
  await monitor.startMonitoring();
  
  // Track some queries
  const tracker1 = await monitor.trackQuery('SELECT * FROM users');
  tracker1.complete({ rowsReturned: 25 });
  
  const tracker2 = await monitor.trackQuery('SELECT COUNT(*) FROM posts');
  tracker2.complete({ rowsReturned: 1 });
  
  // Let it run briefly to collect some resource metrics
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Stop monitoring
  const stats = await monitor.stopMonitoring();
  
  assert.equal(events.filter(e => e === 'started').length, 1);
  assert.equal(events.filter(e => e === 'stopped').length, 1);
  assert.equal(events.filter(e => e === 'query').length, 2);
  assert.equal(monitor.queryHistory.length, 2);
  assert(monitor.resourceHistory.length > 0);
  assert(typeof stats.queryStats.totalQueries === 'number');
});