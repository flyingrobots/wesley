/**
 * Generate Command
 * PURE - No imports from generators or host-node
 * Everything through ctx
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class GeneratePipelineCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx);
    this.name = 'generate';
  }
  
  async run(argv) {
    const logger = this.makeLogger({}, { cmd: 'generate' });
    
    // Parse args (simplified for now)
    const schemaPath = argv[0] || 'schema.graphql';
    const schema = await this.readSchemaFromOptions({ schema: schemaPath });

    logger.info({ schema: schemaPath }, 'Parsing schema...');

    // Use injected generators
    const { generators, writer } = this.ctx;
    
    if (!generators || !generators.sql) {
      logger.error('SQL generator not available');
      return;
    }

    // Generate DDL using injected generator
    const ddlResult = generators.sql.emitDDL({ schema });
    
    // Write files using injected writer
    if (writer && writer.writeFiles) {
      await writer.writeFiles(ddlResult.files || [], 'out');
    }
    
    logger.info('✨ Generated DDL');
  }
}

export default GeneratePipelineCommand;