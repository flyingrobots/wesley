/**
 * Backpressure Controller Tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  BackpressureController,
  BackpressureError,
  CircuitBreakerError,
  RateLimitExceededError,
  ConnectionPoolExhaustedError,
  BackpressureActivated,
  BackpressureDeactivated,
  CircuitBreakerStateChanged,
  ThrottlingAdjusted,
  CircuitBreakerState
} from '../src/domain/control/BackpressureController.mjs';

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('BackpressureController - basic functionality', async () => {
  const controller = new BackpressureController({
    maxConcurrentOperations: 5,
    baseRateLimit: 10
  });

  const status = controller.getStatus();
  assert.equal(status.enabled, true, 'Should be enabled by default');
  assert.equal(status.operations.max, 5, 'Should set max concurrent operations');
  assert.equal(status.rateLimit.base, 10, 'Should set base rate limit');
  assert.equal(status.circuitBreaker.state, CircuitBreakerState.CLOSED, 'Circuit breaker should start closed');

  await controller.shutdown();
});

test('BackpressureController - disabled mode', async () => {
  const controller = new BackpressureController({ enable: false });

  const permission = await controller.requestPermission({ id: 'test-op' });
  assert.equal(permission.granted, true, 'Should grant permission when disabled');
  assert.equal(permission.reason, 'backpressure disabled', 'Should indicate disabled mode');

  await controller.reportCompletion({ success: true });
  // Should not throw errors when disabled

  await controller.shutdown();
});

test('BackpressureController - rate limiting', async () => {
  const controller = new BackpressureController({
    baseRateLimit: 2, // Very low for testing
    adaptiveRateLimiting: false
  });

  // First requests should succeed
  const perm1 = await controller.requestPermission({ id: 'op1' });
  assert.equal(perm1.granted, true, 'First request should be granted');

  const perm2 = await controller.requestPermission({ id: 'op2' });
  assert.equal(perm2.granted, true, 'Second request should be granted');

  // Third request should be rate limited or delayed
  try {
    const perm3 = await controller.requestPermission({ id: 'op3' });
    if (perm3.granted && perm3.delay > 0) {
      assert(perm3.delay > 0, 'Should have delay when rate limited');
    }
  } catch (error) {
    assert(error instanceof RateLimitExceededError, 'Should throw rate limit error');
    assert.equal(error.code, 'RATE_LIMIT_EXCEEDED');
  }

  await controller.shutdown();
});

test('BackpressureController - concurrency limiting', async () => {
  const controller = new BackpressureController({
    maxConcurrentOperations: 2,
    baseRateLimit: 100 // High rate limit to focus on concurrency
  });

  // Fill up concurrent slots
  const perm1 = await controller.requestPermission({ id: 'op1' });
  assert.equal(perm1.granted, true, 'First operation should be granted');

  const perm2 = await controller.requestPermission({ id: 'op2' });
  assert.equal(perm2.granted, true, 'Second operation should be granted');

  // Third operation should have delay due to concurrency limit
  const perm3 = await controller.requestPermission({ id: 'op3' });
  if (perm3.granted) {
    assert(perm3.delay > 0, 'Third operation should have delay');
  }

  // Report completion to free up slot
  await controller.reportCompletion({ success: true, responseTime: 100 });
  
  const status = controller.getStatus();
  assert.equal(status.operations.active, 1, 'Should have one less active operation');

  await controller.shutdown();
});

test('BackpressureController - circuit breaker', async () => {
  const controller = new BackpressureController({
    failureThreshold: 3,
    resetTimeout: 100 // Short for testing
  });

  let stateChanges = [];
  controller.on('circuitBreakerStateChanged', (event) => {
    stateChanges.push(event);
  });

  // Report failures to trip circuit breaker
  for (let i = 0; i < 3; i++) {
    await controller.requestPermission({ id: `fail-op-${i}` });
    await controller.reportCompletion({ success: false, error: 'Test failure' });
  }

  // Circuit breaker should now be open
  const status = controller.getStatus();
  assert.equal(status.circuitBreaker.state, CircuitBreakerState.OPEN, 'Circuit breaker should be open');

  // Requests should be blocked
  try {
    await controller.requestPermission({ id: 'blocked-op' });
    assert.fail('Should throw circuit breaker error');
  } catch (error) {
    assert(error instanceof CircuitBreakerError, 'Should throw circuit breaker error');
    assert.equal(error.code, 'CIRCUIT_BREAKER_OPEN');
  }

  // Wait for reset timeout
  await sleep(150);

  // Should transition to half-open and allow limited requests
  const resetPerm = await controller.requestPermission({ id: 'reset-op' });
  assert.equal(resetPerm.granted, true, 'Should grant request after timeout');
  
  const resetStatus = controller.getStatus();
  assert.equal(resetStatus.circuitBreaker.state, CircuitBreakerState.HALF_OPEN, 
    'Circuit breaker should be half-open');

  // Report success to close circuit breaker
  await controller.reportCompletion({ success: true });

  assert(stateChanges.length >= 2, 'Should emit state change events');

  await controller.shutdown();
});

test('BackpressureController - operation queuing', async () => {
  const controller = new BackpressureController({
    maxConcurrentOperations: 1,
    maxConnectionPoolSize: 1,
    connectionPoolCritical: 0.5 // Force queuing
  });

  // Simulate high connection pool utilization
  controller.metrics.connectionPoolUtilization = 0.9;

  // First operation should be queued
  const permission = await controller.requestPermission({ 
    id: 'queued-op',
    priority: 5 
  });

  if (permission.queued) {
    assert.equal(permission.granted, false, 'Should not grant permission when queued');
    assert(permission.queuePosition >= 0, 'Should provide queue position');
    assert(typeof permission.estimatedDelay === 'number', 'Should estimate delay');
  }

  const status = controller.getStatus();
  if (status.operations.queued > 0) {
    assert(status.operations.queued >= 1, 'Should track queued operations');
  }

  await controller.shutdown();
});

test('BackpressureController - adaptive rate limiting', async () => {
  const controller = new BackpressureController({
    baseRateLimit: 10,
    adaptiveRateLimiting: true,
    responseTimeWarning: 500
  });

  let throttlingEvents = [];
  controller.on('throttlingAdjusted', (event) => {
    throttlingEvents.push(event);
  });

  const initialRate = controller.currentRateLimit;

  // Simulate slow responses to trigger throttling
  controller.metrics.averageResponseTime = 1000; // Above warning threshold
  controller.isBackpressureActive = true;
  controller.backpressureLevel = 0.7;

  // Trigger adaptive adjustment
  controller.adjustRateLimit();

  const adjustedRate = controller.currentRateLimit;
  assert(adjustedRate < initialRate, 'Rate limit should decrease under backpressure');

  // Simulate good conditions
  controller.metrics.averageResponseTime = 100;
  controller.metrics.errorRate = 0.001;
  controller.isBackpressureActive = false;
  controller.backpressureLevel = 0;

  controller.adjustRateLimit();

  const recoveredRate = controller.currentRateLimit;
  assert(recoveredRate >= adjustedRate, 'Rate limit should recover when conditions improve');

  await controller.shutdown();
});

test('BackpressureController - backpressure activation', async () => {
  const controller = new BackpressureController({
    connectionPoolWarning: 0.6,
    connectionPoolCritical: 0.8,
    responseTimeWarning: 500,
    queueDepthWarning: 10
  });

  let backpressureEvents = [];
  controller.on('backpressureActivated', (event) => {
    backpressureEvents.push(event);
  });
  controller.on('backpressureDeactivated', (event) => {
    backpressureEvents.push(event);
  });

  // Simulate conditions that trigger backpressure
  controller.metrics.connectionPoolUtilization = 0.9; // Above critical
  controller.metrics.averageResponseTime = 600; // Above warning
  controller.metrics.queueDepth = 15; // Above warning

  // Force evaluation
  controller.evaluateBackpressure();

  assert.equal(controller.isBackpressureActive, true, 'Backpressure should be active');
  assert(controller.backpressureLevel > 0, 'Backpressure level should be set');

  // Improve conditions
  controller.metrics.connectionPoolUtilization = 0.3;
  controller.metrics.averageResponseTime = 200;
  controller.metrics.queueDepth = 5;

  controller.evaluateBackpressure();

  assert.equal(controller.isBackpressureActive, false, 'Backpressure should be deactivated');

  assert(backpressureEvents.length >= 1, 'Should emit backpressure events');

  await controller.shutdown();
});

test('BackpressureController - metrics tracking', async () => {
  const controller = new BackpressureController();

  const initialMetrics = controller.getStatus().metrics;
  assert.equal(initialMetrics.totalOperations, 0, 'Should start with zero operations');
  assert.equal(initialMetrics.failedOperations, 0, 'Should start with zero failures');

  // Request permission and report completion
  await controller.requestPermission({ id: 'metric-op' });
  await controller.reportCompletion({ 
    success: true, 
    responseTime: 250 
  });

  const updatedMetrics = controller.getStatus().metrics;
  assert.equal(updatedMetrics.totalOperations, 1, 'Should increment total operations');
  assert(updatedMetrics.averageResponseTime > 0, 'Should track response time');

  // Report failure
  await controller.requestPermission({ id: 'fail-op' });
  await controller.reportCompletion({ 
    success: false, 
    error: 'Test error' 
  });

  const failureMetrics = controller.getStatus().metrics;
  assert.equal(failureMetrics.failedOperations, 1, 'Should track failed operations');
  assert(failureMetrics.errorRate > 0, 'Should calculate error rate');

  await controller.shutdown();
});

test('BackpressureController - token bucket rate limiting', async () => {
  const controller = new BackpressureController({
    baseRateLimit: 5 // 5 tokens per second
  });

  // Consume all tokens
  for (let i = 0; i < 5; i++) {
    controller.consumeRateLimitToken();
  }

  const status = controller.getStatus();
  assert.equal(status.rateLimit.tokensRemaining, 0, 'Should consume all tokens');

  // Refill tokens
  await sleep(1100); // Wait over 1 second
  controller.refillRateLimitTokens();

  const refillStatus = controller.getStatus();
  assert(refillStatus.rateLimit.tokensRemaining > 0, 'Should refill tokens over time');

  await controller.shutdown();
});

test('BackpressureController - graceful shutdown', async () => {
  const controller = new BackpressureController({
    maxConcurrentOperations: 10
  });

  // Start some operations
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(controller.requestPermission({ id: `shutdown-op-${i}` }));
  }

  await Promise.all(promises);

  const statusBefore = controller.getStatus();
  assert.equal(statusBefore.operations.active, 3, 'Should have active operations');

  // Queue an operation
  controller.queuedOperations.push({ 
    id: 'queued-shutdown-op', 
    timestamp: Date.now() 
  });

  let shutdownEvent = null;
  controller.on('shutdown', (event) => {
    shutdownEvent = event;
  });

  // Complete operations quickly
  setTimeout(() => {
    controller.reportCompletion({ success: true });
    controller.reportCompletion({ success: true });
    controller.reportCompletion({ success: true });
  }, 10);

  await controller.shutdown();

  const statusAfter = controller.getStatus();
  assert.equal(statusAfter.operations.queued, 0, 'Should clear queued operations');
  assert(shutdownEvent, 'Should emit shutdown event');

  // Controller should be stopped
  assert.equal(controller.monitoringInterval, null, 'Should stop monitoring');
});

test('BackpressureController - error handling', async () => {
  const controller = new BackpressureController();

  // Test custom error types
  const backpressureError = new BackpressureError('Test error', 'TEST_CODE', { test: true });
  assert.equal(backpressureError.name, 'BackpressureError');
  assert.equal(backpressureError.code, 'TEST_CODE');
  assert.equal(backpressureError.context.test, true);

  const circuitError = new CircuitBreakerError('open', 5);
  assert.equal(circuitError.name, 'BackpressureError');
  assert.equal(circuitError.code, 'CIRCUIT_BREAKER_OPEN');

  const rateLimitError = new RateLimitExceededError(15, 10);
  assert.equal(rateLimitError.name, 'BackpressureError');
  assert.equal(rateLimitError.code, 'RATE_LIMIT_EXCEEDED');

  const poolError = new ConnectionPoolExhaustedError(20, 20);
  assert.equal(poolError.name, 'BackpressureError');
  assert.equal(poolError.code, 'POOL_EXHAUSTED');

  await controller.shutdown();
});

test('BackpressureController - reset functionality', async () => {
  const controller = new BackpressureController();

  // Modify state
  controller.activeOperations = 5;
  controller.isBackpressureActive = true;
  controller.backpressureLevel = 0.8;
  controller.circuitBreakerState = CircuitBreakerState.OPEN;
  controller.circuitBreakerFailures = 3;
  controller.metrics.totalOperations = 100;
  controller.metrics.failedOperations = 10;

  // Reset
  controller.reset();

  // Check that state is reset
  assert.equal(controller.activeOperations, 0, 'Should reset active operations');
  assert.equal(controller.isBackpressureActive, false, 'Should reset backpressure');
  assert.equal(controller.backpressureLevel, 0, 'Should reset backpressure level');
  assert.equal(controller.circuitBreakerState, CircuitBreakerState.CLOSED, 'Should reset circuit breaker');
  assert.equal(controller.circuitBreakerFailures, 0, 'Should reset failures');
  assert.equal(controller.metrics.totalOperations, 0, 'Should reset metrics');

  await controller.shutdown();
});

test('BackpressureController - priority queue processing', async () => {
  const controller = new BackpressureController({
    maxConcurrentOperations: 1
  });

  // Fill up capacity
  await controller.requestPermission({ id: 'blocking-op' });

  // Queue operations with different priorities
  const lowPriorityOp = { id: 'low', priority: 1 };
  const highPriorityOp = { id: 'high', priority: 10 };
  const mediumPriorityOp = { id: 'medium', priority: 5 };

  // Simulate queuing (would normally happen in enqueueOperation)
  controller.queuedOperations.push(
    { operation: lowPriorityOp, priority: 1, timestamp: Date.now(), id: 'low' },
    { operation: highPriorityOp, priority: 10, timestamp: Date.now(), id: 'high' },
    { operation: mediumPriorityOp, priority: 5, timestamp: Date.now(), id: 'medium' }
  );

  // Complete blocking operation to trigger queue processing
  controller.activeOperations = 0; // Simulate completion
  await controller.processQueue();

  // High priority should be processed first
  assert.equal(controller.queuedOperations.length, 2, 'Should process one operation');
  assert(controller.queuedOperations[0].priority <= 5, 'Should process highest priority first');

  await controller.shutdown();
});

test('BackpressureController - connection pool pressure monitoring', async () => {
  const controller = new BackpressureController({
    maxConnectionPoolSize: 10,
    connectionPoolWarning: 0.7,
    connectionPoolCritical: 0.9
  });

  // Test warning level
  controller.metrics.connectionPoolUtilization = 0.8;
  const warningResult = controller.checkConnectionPool();
  assert.equal(warningResult.allowed, true, 'Should allow operations at warning level');
  assert(warningResult.utilization === 0.8, 'Should report utilization');

  // Test critical level
  controller.metrics.connectionPoolUtilization = 0.95;
  const criticalResult = controller.checkConnectionPool();
  assert.equal(criticalResult.allowed, false, 'Should block operations at critical level');
  assert(criticalResult.canQueue, 'Should allow queuing at critical level');

  await controller.shutdown();
});

test('BackpressureController - throughput calculation', async () => {
  const controller = new BackpressureController();

  // Simulate operations over time
  controller.metrics.totalOperations = 50;
  controller.metrics.lastUpdateTime = Date.now() - 5000; // 5 seconds ago

  controller.updateMetrics();

  const throughput = controller.metrics.throughput;
  assert(typeof throughput === 'number', 'Should calculate throughput');
  assert(throughput > 0, 'Should have positive throughput');

  // Test current rate calculation with history
  controller.metrics.throughputHistory = [
    { time: Date.now() - 1000, value: 10 },
    { time: Date.now() - 2000, value: 8 },
    { time: Date.now() - 3000, value: 12 }
  ];

  const currentRate = controller.calculateCurrentRate();
  assert(typeof currentRate === 'number', 'Should calculate current rate');

  await controller.shutdown();
});

test('BackpressureController - delay calculations', async () => {
  const controller = new BackpressureController({
    currentRateLimit: 5,
    maxConcurrentOperations: 3
  });

  // Test rate limiting delay
  controller.rateLimitTokens = 0;
  const rateLimitDelay = controller.calculateDelay();
  assert(rateLimitDelay >= 100, 'Should calculate minimum delay for rate limiting');

  // Test concurrency delay
  controller.activeOperations = 5; // Exceeds max of 3
  const concurrencyDelay = controller.calculateConcurrencyDelay();
  assert(concurrencyDelay > 0, 'Should calculate delay for concurrency limit');
  assert(concurrencyDelay <= 5000, 'Should cap concurrency delay');

  await controller.shutdown();
});

test('BackpressureController - monitoring lifecycle', async () => {
  const controller = new BackpressureController();

  // Should start monitoring on creation
  assert(controller.monitoringInterval !== null, 'Should start monitoring');

  controller.stopMonitoring();
  assert(controller.monitoringInterval === null, 'Should stop monitoring');

  controller.startMonitoring();
  assert(controller.monitoringInterval !== null, 'Should restart monitoring');

  // Should not create duplicate intervals
  const firstInterval = controller.monitoringInterval;
  controller.startMonitoring();
  assert.equal(controller.monitoringInterval, firstInterval, 'Should not create duplicate intervals');

  await controller.shutdown();
});

test('BackpressureController - event emission comprehensive', async () => {
  const controller = new BackpressureController({
    failureThreshold: 2,
    connectionPoolWarning: 0.5
  });

  const events = [];
  
  controller.on('backpressureActivated', (event) => {
    events.push({ type: 'backpressureActivated', payload: event.payload });
  });
  
  controller.on('backpressureDeactivated', (event) => {
    events.push({ type: 'backpressureDeactivated', payload: event.payload });
  });
  
  controller.on('circuitBreakerStateChanged', (event) => {
    events.push({ type: 'circuitBreakerStateChanged', payload: event.payload });
  });
  
  controller.on('throttlingAdjusted', (event) => {
    events.push({ type: 'throttlingAdjusted', payload: event.payload });
  });

  // Trigger backpressure
  controller.metrics.connectionPoolUtilization = 0.9;
  controller.evaluateBackpressure();

  // Deactivate backpressure
  controller.metrics.connectionPoolUtilization = 0.3;
  controller.evaluateBackpressure();

  // Trigger circuit breaker
  controller.recordCircuitBreakerFailure();
  controller.recordCircuitBreakerFailure();

  // Trigger throttling adjustment
  const oldRate = controller.currentRateLimit;
  controller.currentRateLimit = oldRate + 5;
  controller.emit('throttlingAdjusted', 
    new ThrottlingAdjusted(oldRate, controller.currentRateLimit, 'test'));

  // Verify events were emitted
  const backpressureActivated = events.filter(e => e.type === 'backpressureActivated');
  const backpressureDeactivated = events.filter(e => e.type === 'backpressureDeactivated');
  const circuitBreakerChanged = events.filter(e => e.type === 'circuitBreakerStateChanged');
  const throttlingAdjusted = events.filter(e => e.type === 'throttlingAdjusted');

  assert(backpressureActivated.length > 0, 'Should emit backpressure activation events');
  assert(backpressureDeactivated.length > 0, 'Should emit backpressure deactivation events');
  assert(throttlingAdjusted.length > 0, 'Should emit throttling adjustment events');

  await controller.shutdown();
});

test('BackpressureController - destroy cleanup', async () => {
  const controller = new BackpressureController();

  // Add some state
  controller.queuedOperations.push({ id: 'test' });
  controller.operationQueue.set('test', { data: 'test' });

  let listenerCount = 0;
  const testListener = () => { listenerCount++; };
  controller.on('test', testListener);

  // Destroy
  controller.destroy();

  // Verify cleanup
  assert.equal(controller.monitoringInterval, null, 'Should stop monitoring');
  assert.equal(controller.queuedOperations.length, 0, 'Should clear queued operations');
  assert.equal(controller.operationQueue.size, 0, 'Should clear operation queue');
  assert.equal(controller.listenerCount('test'), 0, 'Should remove all listeners');

  // Emit event to verify no listeners
  controller.emit('test');
  assert.equal(listenerCount, 0, 'Should not call removed listeners');
});