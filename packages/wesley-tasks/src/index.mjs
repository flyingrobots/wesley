/**
 * Wesley T.A.S.K.S. - Task Abstraction, Scheduling, and Kernel System
 * 
 * Provides task definition, dependency resolution, and scheduling coordination.
 * Designed to be runtime-agnostic - works with any execution engine.
 */

export { TaskDefinition, TaskDependency, TaskGraph } from './TaskDefinition.mjs';

// NOTE: Additional exports (scheduler, queue, kernel, etc.) will be added when implemented.
