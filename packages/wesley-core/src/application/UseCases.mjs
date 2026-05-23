/**
 * Application Use Cases - Pure business logic
 * Commands that orchestrate domain operations
 */

import { SchemaParsed, TypeScriptGenerated } from '../domain/Events.mjs';

export class ParseSchemaUseCase {
  constructor(parser) {
    this.parser = parser;
  }

  async execute(sdl) {
    const schema = await this.parser.parse(sdl);
    return new SchemaParsed(schema);
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
