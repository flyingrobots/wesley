import { LoweringEngine } from '@wesley/core';
import { ZodGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';
import { resolveSchemaIr } from '../utils/schema-ir-cache.mjs';

export class ZodCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'zod', 'Generate standalone Zod validation schemas from GraphQL');
  }

  async executeCore(context) {
    const { schemaContent, schemaPath, units, options, logger } = context;

    const loweringEngine = new LoweringEngine({
      parseIr: async () => (await resolveSchemaIr({
        ctx: this.ctx,
        schemaContent,
        schemaPath,
        units,
        logger
      })).ir
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
