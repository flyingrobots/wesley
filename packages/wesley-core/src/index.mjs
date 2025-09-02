/**
 * Wesley Core - Pure domain logic, no dependencies
 * Hexagonal architecture with event-driven patterns
 */

// Domain Models
export { Schema, Table, Field } from './domain/Schema.mjs';
export { DirectiveProcessor } from './domain/Directives.mjs';

// Domain Events
export * from './domain/Events.mjs';

// Domain Generators (core business logic)
export { PostgreSQLGenerator } from './domain/generators/PostgreSQLGenerator.mjs';
export { PgTAPTestGenerator } from './domain/generators/PgTAPTestGenerator.mjs';
export { RPCFunctionGenerator } from './domain/generators/RPCFunctionGenerator.mjs';
export { MigrationDiffer } from './domain/generators/MigrationDiffer.mjs';

// SQL Execution Components
export { 
  SQLExecutor, 
  PostgreSQLConnection, 
  SQLOperation 
} from './domain/executor/SQLExecutor.mjs';

export { 
  MigrationExplainer, 
  MigrationOperation, 
  MigrationAnalysisSummary,
  PostgreSQLLockLevels 
} from './domain/explainer/MigrationExplainer.mjs';

export { 
  CICOrchestrator, 
  CICOperation, 
  CICExecutionStrategy,
  CICProgressTracker,
  CICOperationResult 
} from './domain/orchestrator/CICOrchestrator.mjs';

// Application Layer
export * from './application/Commands.mjs';
export * from './application/UseCases.mjs';
export { GenerationPipeline } from './application/GenerationPipeline.mjs';
export { EvidenceMap } from './application/EvidenceMap.mjs';
export { ScoringEngine } from './application/Scoring.mjs';

// Documentation & Configuration Utilities
export { DocumentationGenerator } from './documentation/DocumentationGenerator.mjs';
export { ConfigurationTemplate } from './config/ConfigurationTemplate.mjs';

// Safety Components (Wave 3)
export { 
  ConcurrentSafetyAnalyzer,
  ConcurrentSafetyError,
  RaceConditionError,
  LockEscalationError
} from './domain/analyzer/ConcurrentSafetyAnalyzer.mjs';

export { 
  BackpressureController,
  BackpressureError,
  CircuitBreakerError,
  RateLimitExceededError,
  ConnectionPoolExhaustedError,
  CircuitBreakerState
} from './domain/control/BackpressureController.mjs';

// Ports (Interfaces)
export * from './ports/Ports.mjs';

// CLI Module (Not exported directly - use specific CLI adapters)
// CLI components are available via './cli/index.mjs' for adapter implementations