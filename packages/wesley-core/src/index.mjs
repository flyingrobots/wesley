/**
 * Wesley Core - Pure domain logic, no dependencies
 * Hexagonal architecture with event-driven patterns
 */

// Domain Models
export { Schema, Table, Field } from './domain/Schema.mjs';
export { DirectiveProcessor } from './domain/Directives.mjs';
export { canonicalize } from './domain/canonicalize.mjs';
export { schemaHash } from './domain/schemaHash.mjs';
export { registryHash, canonicalizeJSON } from './domain/registryHash.mjs';
export { computeLayoutHash, buildLayoutDescriptor, encodingForType } from './domain/layoutHash.mjs';
export { computeHashChain, computeSdlHash, computeIrHash, computeBundleHash } from './domain/hashChain.mjs';
export { computeDelta } from './domain/schemaDelta.mjs';

// Domain Events
export * from './domain/Events.mjs';

// Note: Generators moved to dedicated packages per ENSIGN reorganization

// Note: SQLExecutor moved to host-node adapters per ENSIGN reorganization

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
export { PluginRunner } from './application/PluginRunner.mjs';
export { ArtifactWriter } from './application/ArtifactWriter.mjs';
export { discoverPlugins } from './application/PluginDiscovery.mjs';
export { validateConfig, KNOWN_EXPERIMENTAL_FLAGS } from './application/ConfigValidator.mjs';

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
// Fixed case sensitivity: logger.mjs -> Logger.mjs  
export { LoggerPort } from './ports/Logger.mjs';
export { ClockPort, SystemClock, FakeClock, systemClock } from './ports/clock.mjs';
export { GeneratorPlugin, validatePlugin, validatePlan, SUPPORTED_API_VERSIONS } from './ports/GeneratorPlugin.mjs';
export { ArtifactWriterPort, detectConflicts } from './ports/ArtifactWriter.mjs';

// Testing helpers
export { testGenerator, testGeneratorPlan, expectArtifact } from './testing/testGenerator.mjs';

// Note: Compiler services moved to host-node adapters per ENSIGN reorganization
