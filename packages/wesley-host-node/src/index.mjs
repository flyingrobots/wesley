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

// Re-export generators from proper packages
import { PostgreSQLGenerator, PgTAPTestGenerator } from '@wesley/generator-supabase';
import { ModelGenerator } from '@wesley/generator-js';

// Import core domain models
import { Schema, Table, Field } from '@wesley/core';

export { PostgreSQLGenerator, PgTAPTestGenerator, ModelGenerator };

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

      // Parse SDL to Wesley IR using the real parser
      const wesleyIR = this.adapter.parseSDL(schemaSource);
      
      // Convert Wesley IR to Wesley domain model objects
      const schema = this.convertIRToSchema(wesleyIR);
      
      // Return Wesley schema object with expected interface
      return {
        getTables: () => schema.getTables(),
        toJSON: () => ({ 
          tables: schema.getTables().map(t => t.toJSON ? t.toJSON() : t),
          raw: schemaSource 
        }),
        raw: schemaSource
      };
    } catch (error) {
      // Preserve the error type if it's a Wesley parse error
      if (error.name === 'PARSE_FAILED') {
        throw error;
      }
      throw new Error(`GraphQL parsing failed: ${error.message}`);
    }
  }

  /**
   * Convert Wesley IR to Wesley domain model objects
   */
  convertIRToSchema(ir) {
    const tables = {};
    
    for (const tableData of ir.tables) {
      // Convert columns to Field objects
      const fields = {};
      for (const columnData of tableData.columns) {
        const field = new Field({
          name: columnData.name,
          type: this.postgresqlToGraphQLType(columnData.type),
          nonNull: !columnData.nullable,
          list: columnData.type.includes('[]'),
          directives: this.convertDirectivesToExpectedFormat(columnData, tableData)
        });
        fields[field.name] = field;
      }
      
      // Create Table object
      const table = new Table({
        name: tableData.name,
        directives: this.convertTableDirectivesToExpectedFormat(tableData),
        fields: fields
      });
      
      tables[table.name] = table;
    }
    
    return new Schema(tables);
  }
  
  /**
   * Convert PostgreSQL type back to GraphQL type (best effort)
   */
  postgresqlToGraphQLType(pgType) {
    const baseType = pgType.replace('[]', '');
    switch (baseType) {
      case 'uuid': return 'ID';
      case 'text': return 'String';
      case 'integer': return 'Int';
      case 'double precision': return 'Float';
      case 'boolean': return 'Boolean';
      case 'timestamptz': return 'DateTime';
      default: return 'String';
    }
  }
  
  /**
   * Convert Wesley directives to expected format for fields
   */
  convertDirectivesToExpectedFormat(columnData, tableData) {
    const directives = {};
    
    // Check for primary key
    if (tableData.primaryKey === columnData.name) {
      directives['@primaryKey'] = {};
    }
    
    // Check for foreign keys
    const fk = tableData.foreignKeys.find(fk => fk.column === columnData.name);
    if (fk) {
      directives['@foreignKey'] = { ref: `${fk.refTable}.${fk.refColumn}` };
    }
    
    // Check for unique constraint
    if (columnData.unique) {
      directives['@unique'] = {};
    }
    
    // Check for default value
    if (columnData.default) {
      directives['@default'] = { expr: columnData.default };
    }
    
    // Check for indexes
    const index = tableData.indexes.find(idx => idx.columns.includes(columnData.name));
    if (index) {
      directives['@index'] = { name: index.name, using: index.using };
    }
    
    return directives;
  }
  
  /**
   * Convert Wesley table directives to expected format
   */
  convertTableDirectivesToExpectedFormat(tableData) {
    const directives = { '@table': {} };
    
    if (tableData.tenantBy) {
      directives['@tenant'] = { by: tableData.tenantBy };
    }
    
    // Handle RLS directives - check for both new and legacy names
    const rlsDirective = tableData.directives?.['wes_rls'] || tableData.directives?.['rls'];
    if (rlsDirective) {
      directives['@rls'] = rlsDirective;
    }
    
    return directives;
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
      sql: '-- No migration generated (stub implementation)',
      manifest: { kind: 'noop' }
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