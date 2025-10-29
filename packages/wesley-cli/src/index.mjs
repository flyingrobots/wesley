/**
 * Wesley CLI Library - Platform-agnostic command interface
 * 
 * Exports the core CLI framework without Node.js dependencies.
 * The host platform (wesley-host-node) dependency injects adapters.
 */

// Export framework components
export { AutomaticallyRegisteredProgram } from './framework/AutomaticallyRegisteredProgram.mjs';
export { WesleyCommand } from './framework/WesleyCommand.mjs';
export { GeneratorCommand } from './framework/GeneratorCommand.mjs';
export { FileOutputGeneratorCommand } from './framework/FileOutputGeneratorCommand.mjs';
export { CommandFactory } from './framework/CommandFactory.mjs';
export { ExecutionPlan } from './framework/ExecutionPlan.mjs';
export { PlanBuilder } from './framework/PlanBuilder.mjs';

// Export utilities
export * from './framework/utils.mjs';