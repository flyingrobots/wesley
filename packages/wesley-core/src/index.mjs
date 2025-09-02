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

// Application Layer
export * from './application/Commands.mjs';
export * from './application/UseCases.mjs';
export { GenerationPipeline } from './application/GenerationPipeline.mjs';
export { EvidenceMap } from './application/EvidenceMap.mjs';
export { ScoringEngine } from './application/Scoring.mjs';

// Documentation & Configuration Utilities
export { DocumentationGenerator } from './documentation/DocumentationGenerator.mjs';
export { ConfigurationTemplate } from './config/ConfigurationTemplate.mjs';

// Ports (Interfaces)
export * from './ports/Ports.mjs';

// CLI Module (Not exported directly - use specific CLI adapters)
// CLI components are available via './cli/index.mjs' for adapter implementations