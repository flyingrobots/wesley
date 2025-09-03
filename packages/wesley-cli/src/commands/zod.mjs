import { GraphQLSchemaParser } from '@wesley/host-node';
import { ZodGenerator } from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class ZodCommand extends WesleyCommand {
  constructor() {
    super('zod', 'Generate standalone Zod schemas from GraphQL');
    this.requiresSchema = true;
  }

  async executeCore(ctx) {
    const { schemaContent, options } = ctx;

    const parser = new GraphQLSchemaParser();
    const schema = await parser.parse(schemaContent);

    const generator = new ZodGenerator(null);
    const zodCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: zodCode, outFile, options });
    if (!options.quiet && outFile) {
      console.log(`✨ Generated Zod schemas: ${written}`);
    }
    return { outFile: written };
  }
}

export default ZodCommand;

