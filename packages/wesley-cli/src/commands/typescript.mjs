import { TypeScriptGenerator } from '@wesley/core';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';

export class TypeScriptCommand extends FileOutputGeneratorCommand {
  constructor() {
    super('typescript', 'Generate TypeScript interfaces from GraphQL');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd).alias('ts');
  }

  async executeCore(ctx) {
    const { schemaContent, options, fileSystem } = ctx;

    const parser = new GraphQLSchemaParser();
    const schema = await parser.parse(schemaContent);

    const generator = new TypeScriptGenerator(null);
    const tsCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: tsCode, outFile, options, fileSystem });
    if (!options.quiet && outFile) {
      console.log(`✨ Generated TypeScript interfaces: ${written}`);
    }
    return { outFile: written };
  }
}

export default TypeScriptCommand;

// Auto-register this command by creating an instance
new TypeScriptCommand();
