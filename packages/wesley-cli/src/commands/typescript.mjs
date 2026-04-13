import { LoweringEngine } from '@wesley/core';
import { TypeScriptGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';
import { resolveSchemaIr } from '../utils/schema-ir-cache.mjs';

export class TypeScriptCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'typescript', 'Generate TypeScript interfaces from GraphQL');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd).alias('ts');
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

    const generator = new TypeScriptGenerator(null);
    const tsCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: tsCode, outFile, options });
    if (!options.quiet && !options.json && outFile) {
      context.logger.info(`Generated TypeScript interfaces: ${written}`);
    }
    return { outFile: written };
  }
}
