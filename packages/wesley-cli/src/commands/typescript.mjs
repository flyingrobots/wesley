import { LoweringEngine } from '@wesley/core';
import { TypeScriptGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';

export class TypeScriptCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'typescript', 'Generate TypeScript interfaces from GraphQL');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd).alias('ts');
  }

  async executeCore(context) {
    const { schemaContent, options } = context;

    const loweringEngine = new LoweringEngine({
      parseIr: (sdl) => this.ctx.parsers.graphql.parse(sdl)
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
