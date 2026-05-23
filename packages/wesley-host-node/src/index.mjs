/**
 * Wesley Host-Node - Node.js platform adapters
 * Main export file for all adapters and re-exports from core
 */

// Export logging adapters
export { createPinoLogger } from './adapters/logger-pino.mjs';
export { ConsoleLogger } from './adapters/console-compat-logger.mjs';

// Export other adapters
export { EventBus } from './adapters/EventBus.mjs';
export { GraphQLAdapter } from '@wesley/runtime-node';
export { NodeFileSystem } from './adapters/NodeFileSystem.mjs';
export { runWesleyCli } from './runWesleyCli.mjs';

// Import GraphQLAdapter for use in GraphQLSchemaParser
import { GraphQLAdapter } from '@wesley/runtime-node';

// Import core domain models
import { Schema, Table, Field } from '@wesley/core';

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
          tables: schema.getTables().map((t) => (t.toJSON ? t.toJSON() : t)),
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
      const fields = {};
      for (const f of tableData.fields) {
        const directives = {};
        if (f.directives.pk) directives['@primaryKey'] = {};
        if (f.directives.fk) {
          directives['@foreignKey'] = {
            ref: `${f.directives.fk.targetTable}.${f.directives.fk.targetField}`
          };
        }
        if (f.directives.unique) directives['@unique'] = {};
        if (f.directives.default) directives['@default'] = { expr: f.directives.default.value };
        if (f.directives.index) {
          const idx = tableData.indexes?.find((i) => i.fields?.includes(f.name));
          if (idx) directives['@index'] = { name: idx.name, using: idx.using };
          else directives['@index'] = {};
        }

        fields[f.name] = new Field({
          name: f.name,
          type: f.type.base,
          nonNull: !f.nullable,
          list: f.type.isList,
          directives
        });
      }

      const tableDirectives = { '@table': {} };
      if (tableData.directives.tenant) {
        tableDirectives['@tenant'] = { by: tableData.directives.tenant.field };
      }
      if (tableData.directives.rls) {
        tableDirectives['@rls'] = tableData.directives.rls;
      }

      tables[tableData.name] = new Table({
        name: tableData.name,
        directives: tableDirectives,
        fields
      });
    }

    return new Schema(tables);
  }
}
