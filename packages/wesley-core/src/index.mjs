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
export { GQL_TO_PG, PG_TO_GQL, fieldTypeToPg, gqlScalarToPg } from './domain/typeMapping.mjs';

// Domain Errors
export { WesleyError, OpsError, PluginError } from './domain/WesleyError.mjs';

// Exit codes
export { exitCodeFor, isRegistered, getRegistry } from './domain/ExitCodes.mjs';

// Domain Events
export * from './domain/Events.mjs';

// Note: Generators moved to dedicated packages per ENSIGN reorganization
export { PostgreSQLGenerator } from './domain/generators/PostgreSQLGenerator.mjs';
export { PgTAPTestGenerator } from './domain/generators/PgTAPTestGenerator.mjs';

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
export { irToSchema } from './application/irToSchema.mjs';
export { EvidenceMap } from './application/EvidenceMap.mjs';
export {
  adjustReadinessVerdictForEvidenceTrust,
  assessEvidenceTrust,
  classifyEvidenceLocation,
  confidencePenaltyForEvidenceTrust,
  createEvidenceQualitySummary,
  evidenceTrustMeetsThreshold,
  listEvidenceFiles,
  pickBestEvidenceLocation,
  strongestEvidenceStrength,
  summarizeEvidenceKinds,
  summarizeEvidenceQuality,
  totalEvidenceCitations
} from './application/EvidenceQuality.mjs';
export {
  countContentLines,
  extractContentForLineSpan,
  isExactLineSpan,
  isWholeFileLineSpan,
  lineSpanWidth,
  lineSpanForContent,
  parseLineSpan
} from './application/EvidenceSpans.mjs';
export {
  GENERATED_ARTIFACT_DIR,
  LEGACY_GENERATED_ARTIFACT_DIR,
  GENERATED_BUNDLE_PATH,
  GENERATED_HISTORY_PATH,
  GENERATED_SCORES_PATH,
  GENERATED_SNAPSHOT_PATH,
  GENERATED_REALM_PATH,
  GENERATED_SHIPME_PATH,
  GENERATED_COUNTERFACTUAL_DIR,
  GENERATED_COUNTERFACTUAL_CURRENT_PATH,
  GENERATED_LEDGER_DIR,
  GENERATED_CHECKPOINTS_DIR,
  legacyGeneratedArtifactPath,
  generatedArtifactPathCandidates
} from './application/GeneratedArtifactPaths.mjs';
export { buildAdditivePlan, explainPlan, lockFor, emitMigrations } from './application/MigrationPlan.mjs';
export { MemoryEventStore } from './application/MemoryEventStore.mjs';
export { createRuntimeEventCollector, createRuntimeStreamId, RUNTIME_EVENT_SCHEMA_VERSION } from './application/RuntimeEvents.mjs';
export { buildRuntimeRunReport, applyRuntimeEvent } from './application/RuntimeRunReport.mjs';
export {
  RUNTIME_RUN_SNAPSHOT_SCHEMA_VERSION,
  createRuntimeRunSnapshot,
  applyRuntimeEventToSnapshot,
  buildRuntimeRunSnapshot
} from './application/RuntimeRunSnapshot.mjs';
export { replayRuntimeRun } from './application/RuntimeRunReplay.mjs';
export {
  inspectRuntimeRunStream,
  inspectRuntimeRunStreams,
  listRuntimeRunReports,
  listRuntimeRunStreamIds,
  readRuntimeRunRecord,
  readRuntimeRunSnapshot,
  readRuntimeRunStreamSince,
  resolveRuntimeRunStream,
  runtimeRunStreamExists,
  summarizeRuntimeRunDoctor
} from './application/RuntimeRunStore.mjs';
export { ScoringEngine } from './application/Scoring.mjs';
export { PluginRunner } from './application/PluginRunner.mjs';
export { TransmutationRunner, createRunId } from './application/TransmutationRunner.mjs';
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
export { GeneratorPlugin, validatePlugin, validatePlan, validateGenerateResult, SUPPORTED_API_VERSIONS } from './ports/GeneratorPlugin.mjs';
export { ArtifactWriterPort, detectConflicts } from './ports/ArtifactWriter.mjs';
export { EventStorePort, assertEventStorePort } from './ports/EventStore.mjs';

// Utility helpers
export { mustFind, mustMatch } from './util/guards.mjs';

// Testing helpers
export { testGenerator, testGeneratorPlan, expectArtifact } from './testing/testGenerator.mjs';

// Note: Compiler services moved to host-node adapters per ENSIGN reorganization
