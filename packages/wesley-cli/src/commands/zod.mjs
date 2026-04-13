import { LoweringEngine } from '@wesley/core';
import { ZodGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';

export class ZodCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'zod', 'Generate standalone Zod validation schemas from GraphQL');
  }

  async executeCore(context) {
    const { schemaContent, options } = context;

    const loweringEngine = new LoweringEngine({
      parseIr: (sdl) => this.ctx.parsers.graphql.parse(sdl)
    });
    const { domain: schema } = await loweringEngine.lower({ sdl: schemaContent });

    const generator = new ZodGenerator(null);
    const zodCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: zodCode, outFile, options });
    if (!options.quiet && !options.json && outFile) {
      context.logger.info(`Generated Zod schemas: ${written}`);
    }
    return { outFile: written };
  }
}
