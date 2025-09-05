/**
 * Wesley S.L.A.P.S. - Strategic Lock-Aware PostgreSQL System
 * 
 * Provides runtime execution engine for T.A.S.K.S. with PostgreSQL-specific
 * lock awareness, backpressure control, and concurrent operation safety.
 */

export { ExecutionEngine, ExecutionResult } from './ExecutionEngine.mjs';
export { LockAwareExecutor } from './LockAwareExecutor.mjs';
export { BackpressureController } from './BackpressureController.mjs';
export { ResourceAllocator } from './ResourceAllocator.mjs';
export { ConcurrencyManager } from './ConcurrencyManager.mjs';

// Safety and monitoring
export { SafetyAnalyzer } from './SafetyAnalyzer.mjs';
export { PerformanceMonitor } from './PerformanceMonitor.mjs';
export { ConnectionPoolManager } from './ConnectionPoolManager.mjs';

// Integration with T.A.S.K.S.
export { TasksSlapsBridge } from './TasksSlapsBridge.mjs';