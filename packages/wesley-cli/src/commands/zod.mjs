import { LoweringEngine, WesleyError } from '@wesley/core';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';
import { resolveSchemaIr } from '../utils/schema-ir-cache.mjs';
import { generateFamilyZodFromSDL, hasTableLikeIr } from '../utils/family-projections.mjs';
import { generateTableZod } from '../utils/table-projections.mjs';

export class ZodCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'zod', 'Generate standalone Zod validation schemas from GraphQL');
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

    let zodCode;
    if (hasTableLikeIr(resolved.ir)) {
      zodCode = generateTableZod(schema);
    } else {
      zodCode = generateFamilyZodFromSDL(schemaContent);
    }
    if (!zodCode || zodCode.trim().length === 0) {
      throw new WesleyError(
        'UNSUPPORTED_ZOD_PROJECTION',
        `No Zod projection could be generated from ${schemaPath}.`
      );
    }

    const outFile = await this.resolveOutFile({
      options,
      outputKey: 'zod',
      defaultFileName: 'zod.generated.ts'
    });
    const written = await this.writeOutput({ code: zodCode, outFile, options });
    if (!options.quiet && !options.json && outFile) {
      context.logger.info(`Generated Zod schemas: ${written}`);
    }
    return { outFile: written };
  }
}
