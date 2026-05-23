import { LoweringEngine, WesleyError } from '@wesley/core';
import { TypeScriptGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';
import { resolveSchemaIr } from '../utils/schema-ir-cache.mjs';
import { generateFamilyTypeScriptFromSDL, hasTableLikeIr } from '../utils/family-projections.mjs';

export class TypeScriptCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'typescript', 'Generate TypeScript interfaces from GraphQL');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd).alias('ts');
  }

  async executeCore(context) {
    const { schemaContent, schemaPath, units, options, logger } = context;
    const resolved = await resolveSchemaIr({
      ctx: this.ctx,
      schemaContent,
      schemaPath,
      units,
      logger
    });

    const loweringEngine = new LoweringEngine({
      parseIr: async () => resolved.ir
    });
    const { domain: schema } = await loweringEngine.lower({ sdl: schemaContent });

    let tsCode;
    if (hasTableLikeIr(resolved.ir)) {
      const generator = new TypeScriptGenerator(null);
      tsCode = generator.generate(schema);
    } else {
      tsCode = generateFamilyTypeScriptFromSDL(schemaContent);
    }
    if (!tsCode || tsCode.trim().length === 0) {
      throw new WesleyError(
        'UNSUPPORTED_TYPESCRIPT_PROJECTION',
        `No TypeScript projection could be generated from ${schemaPath}.`
      );
    }

    const outFile = await this.resolveOutFile({
      options,
      outputKey: 'typescript',
      defaultFileName: 'types.generated.ts'
    });
    const written = await this.writeOutput({ code: tsCode, outFile, options });
    if (!options.quiet && !options.json && outFile) {
      context.logger.info(`Generated TypeScript interfaces: ${written}`);
    }
    return { outFile: written };
  }
}
