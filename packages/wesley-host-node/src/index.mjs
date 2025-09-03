/**
 * Wesley Host-Node - Node.js platform adapters
 * Main export file for all adapters and re-exports from core
 */

// Export logging adapters
export { createPinoLogger } from './adapters/logger-pino.mjs';
export { ConsoleLogger } from './adapters/console-compat-logger.mjs';

// Export other adapters
export { EventBus } from './adapters/EventBus.mjs';
export { GraphQLAdapter } from './adapters/GraphQLAdapter.mjs';
export { NodeFileSystem } from './adapters/NodeFileSystem.mjs';
export { PgParserAdapter } from './adapters/PgParserAdapter.mjs';
export { PostgreSQLAdapter } from './adapters/PostgreSQLAdapter.mjs';
export { WesleyFileWriter } from './adapters/WesleyFileWriter.mjs';

// Import GraphQLAdapter for use in GraphQLSchemaParser
import { GraphQLAdapter } from './adapters/GraphQLAdapter.mjs';

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
    this.adapter = new GraphQLAdapter();
  }

  async parse(schemaSource) {
    try {
      // First validate the SDL syntax
      const validation = this.adapter.validateSDL(schemaSource);
      if (!validation.valid) {
        throw new Error(`Invalid GraphQL schema: ${validation.error}`);
      }

      // Parse SDL to Wesley Schema (stub for now, but with proper structure)
      const wesleySchema = this.adapter.parseSDL(schemaSource);
      
      // Return Wesley schema object with expected interface
      return {
        getTables: () => this.extractTablesFromSchema(wesleySchema),
        toJSON: () => ({ 
          tables: this.extractTablesFromSchema(wesleySchema).map(t => t.toJSON()),
          raw: schemaSource 
        }),
        raw: schemaSource
      };
    } catch (error) {
      throw new Error(`GraphQL parsing failed: ${error.message}`);
    }
  }

  extractTablesFromSchema(wesleySchema) {
    // Stub implementation - should extract @table types from GraphQL AST
    // For now, return empty array to avoid crashes
    console.warn('GraphQLSchemaParser.extractTablesFromSchema: Using stub implementation');
    return [];
  }
}

export class MigrationDiffEngine {
  constructor(options = {}) {
    this.options = options;
  }

  async diff(fromSchema, toSchema) {
    // Stub implementation - should generate migration SQL
    console.warn('MigrationDiffEngine.diff: Using stub implementation');
    return {
      steps: [],
      operations: [],
      sql: '-- No migration generated (stub implementation)'
    };
  }

  async generateMigration(diff) {
    // Stub implementation - should generate actual migration files
    console.warn('MigrationDiffEngine.generateMigration: Using stub implementation');
    return {
      filename: `migration_${Date.now()}.sql`,
      content: diff.sql || '-- No migration content'
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