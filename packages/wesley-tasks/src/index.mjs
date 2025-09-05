/**
 * Wesley T.A.S.K.S. - Task Abstraction, Scheduling, and Kernel System
 * 
 * Provides task definition, dependency resolution, and scheduling coordination.
 * Designed to be runtime-agnostic - works with any execution engine.
 */

export { TaskDefinition, TaskDependency, TaskGraph } from './TaskDefinition.mjs';
export { TaskScheduler, SchedulingStrategy } from './TaskScheduler.mjs';
export { TaskQueue, QueuePriority } from './TaskQueue.mjs';
export { DependencyResolver } from './DependencyResolver.mjs';
export { TaskKernel } from './TaskKernel.mjs';

// Task execution coordination with S.L.A.P.S.
export { ExecutionCoordinator } from './ExecutionCoordinator.mjs';
export { ResourceManager } from './ResourceManager.mjs';
export { ProgressTracker } from './ProgressTracker.mjs';