import { ZodGenerator } from '@wesley/core';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';

export class ZodCommand extends FileOutputGeneratorCommand {
  constructor() {
    super('zod', 'Generate standalone Zod schemas from GraphQL');
  }

  async executeCore(ctx) {
    const { schemaContent, options, fileSystem } = ctx;

    const parser = new GraphQLSchemaParser();
    const schema = await parser.parse(schemaContent);

    const generator = new ZodGenerator(null);
    const zodCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: zodCode, outFile, options, fileSystem });
    if (!options.quiet && outFile) {
      console.log(`✨ Generated Zod schemas: ${written}`);
    }
    return { outFile: written };
  }
}

export default ZodCommand;

// Auto-register this command by creating an instance
new ZodCommand();
