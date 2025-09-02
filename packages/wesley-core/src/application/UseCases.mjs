/**
 * Application Use Cases - Pure business logic
 * Commands that orchestrate domain operations
 */

import { 
  SchemaParsed, 
  SQLGenerated, 
  TypeScriptGenerated,
  MigrationDiffCalculated,
  MigrationSQLGenerated 
} from '../domain/Events.mjs';

export class ParseSchemaUseCase {
  constructor(parser) {
    this.parser = parser;
  }

  async execute(sdl) {
    const schema = await this.parser.parse(sdl);
    return new SchemaParsed(schema);
  }
}

export class GenerateSQLUseCase {
  constructor(generator) {
    this.generator = generator;
  }

  async execute(schema) {
    const sql = await this.generator.generate(schema);
    return new SQLGenerated(sql, schema);
  }
}

export class GenerateTypeScriptUseCase {
  constructor(generator) {
    this.generator = generator;
  }

  async execute(schema) {
    const typescript = await this.generator.generate(schema);
    return new TypeScriptGenerated(typescript, schema);
  }
}

export class CalculateMigrationDiffUseCase {
  constructor(diffEngine) {
    this.diffEngine = diffEngine;
  }

  async execute(previousSchema, currentSchema) {
    const diff = await this.diffEngine.diff(previousSchema, currentSchema);
    return new MigrationDiffCalculated(diff, previousSchema, currentSchema);
  }
}

export class GenerateMigrationSQLUseCase {
  constructor(generator) {
    this.generator = generator;
  }

  async execute(diff) {
    const sql = await this.generator.generate(diff);
    return new MigrationSQLGenerated(sql, diff);
  }
}