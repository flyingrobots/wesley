import { GraphQLSchemaParser } from '@wesley/host-node';
import { TypeScriptGenerator } from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class TypeScriptCommand extends WesleyCommand {
  constructor() {
    super('typescript', 'Generate TypeScript interfaces from GraphQL');
    this.requiresSchema = true;
  }

  async executeCore(ctx) {
    const { schemaContent, options } = ctx;

    const parser = new GraphQLSchemaParser();
    const schema = await parser.parse(schemaContent);

    const generator = new TypeScriptGenerator(null);
    const tsCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: tsCode, outFile, options });
    if (!options.quiet && outFile) {
      console.log(`✨ Generated TypeScript interfaces: ${written}`);
    }
    return { outFile: written };
  }
}

export default TypeScriptCommand;

