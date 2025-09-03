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
export { CompilerPort } from './ports/compiler.mjs';
export { ParserPort } from './ports/parser.mjs';
export { SqlGeneratorPort } from './ports/sqlgen.mjs';
export { TestGeneratorPort } from './ports/testgen.mjs';
export { DiffEnginePort } from './ports/diff.mjs';
export { WriterPort } from './ports/writer.mjs';
export { FileSystemPort } from './ports/fs.mjs';
export { LoggerPort } from './ports/logger.mjs';
export { ClockPort, SystemClock } from './ports/clock.mjs';

// Application Services
export { InProcessCompiler } from './compiler/inprocess.mjs';