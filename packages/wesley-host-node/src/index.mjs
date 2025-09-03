/**
 * Wesley Host-Node - Node.js platform adapters
 * Main export file for all adapters and re-exports from core
 */

// Export existing adapters
export { ConsoleLogger } from './adapters/ConsoleLogger.mjs';
export { EventBus } from './adapters/EventBus.mjs';
export { GraphQLAdapter } from './adapters/GraphQLAdapter.mjs';
export { NodeFileSystem } from './adapters/NodeFileSystem.mjs';
export { PgParserAdapter } from './adapters/PgParserAdapter.mjs';
export { PostgreSQLAdapter } from './adapters/PostgreSQLAdapter.mjs';
export { WesleyFileWriter } from './adapters/WesleyFileWriter.mjs';

// Re-export generators from core that CLI expects
// TODO: These should probably be imported directly from core by the CLI
import {
  PostgreSQLGenerator,
  PgTAPTestGenerator
} from '@wesley/core';

export { PostgreSQLGenerator, PgTAPTestGenerator };

// Stub implementations for missing components
// TODO: Implement these properly

export class GraphQLSchemaParser {
  constructor(options = {}) {
    this.options = options;
  }

  async parse(schemaSource) {
    // Stub implementation - should use graphql library to parse
    console.warn('GraphQLSchemaParser: Using stub implementation');
    return {
      types: [],
      directives: [],
      raw: schemaSource
    };
  }
}

export class MigrationDiffEngine {
  constructor(options = {}) {
    this.options = options;
  }

  async diff(fromSchema, toSchema) {
    // Stub implementation - should generate migration SQL
    console.warn('MigrationDiffEngine: Using stub implementation');
    return {
      operations: [],
      sql: '-- No migration generated (stub implementation)'
    };
  }

  async plan(operations) {
    // Stub implementation - should plan migration phases
    console.warn('MigrationDiffEngine.plan: Using stub implementation');
    return {
      expand: [],
      backfill: [],
      validate: [],
      switch: [],
      contract: []
    };
  }
}