import { InProcessCompiler, SystemClock } from '@wesley/core';
import {
  GraphQLSchemaParser,
  PostgreSQLGenerator,
  PgTAPTestGenerator,
  MigrationDiffEngine,
  NodeFileSystem,
  WesleyFileWriter
} from '@wesley/host-node';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class GeneratePipelineCommand extends WesleyCommand {
  constructor() {
    super('generate', 'Generate SQL, tests, and more from GraphQL schema');
    this.requiresSchema = true;
  }

  makeCompiler(options) {
    const logger = this.makeLogger(options, { cmd: 'generate' });
    const compiler = new InProcessCompiler({
      parser: new GraphQLSchemaParser(),
      sqlGenerator: new PostgreSQLGenerator(),
      testGenerator: new PgTAPTestGenerator(),
      diffEngine: new MigrationDiffEngine(),
      fileSystem: new NodeFileSystem(),
      logger,
      clock: new SystemClock()
    });
    return { logger, compiler };
  }

  async executeCore(ctx) {
    const { schemaContent, options } = ctx;

    const writer = new WesleyFileWriter(options);
    const sha = writer.getCurrentSHA();

    const { logger, compiler } = this.makeCompiler(options);

    const result = await compiler.compile(
      { sdl: schemaContent, flags: { supabase: !!options.supabase, emitBundle: !!options['emit-bundle'] } },
      { sha, outDir: options.outDir || 'out' }
    );

    await writer.writeBundle(result);

    if (options.json) {
      const output = {
        success: true,
        artifacts: result.artifacts || {},
        scores: result.scores || null,
        meta: result.meta || {},
        timestamp: new Date().toISOString()
      };
      console.log(JSON.stringify(output, null, 2));
    } else if (!options.quiet) {
      console.log('');
      console.log('✨ Generated:');
      if (result.artifacts && result.artifacts.sql) console.log('  ✓ PostgreSQL DDL       → out/schema.sql');
      if (result.artifacts && result.artifacts.typescript) console.log('  ✓ TypeScript Types     → out/types.ts');
      if (result.artifacts && result.artifacts.tests) console.log('  ✓ pgTAP Tests          → tests/generated.sql');
      if (result.artifacts && result.artifacts.migration) console.log('  ✓ Migration            → db/migrations/');
      console.log('');

      if (result.scores && result.scores.scores) {
        console.log('📊 Scores:');
        const { scs, mri, tci } = result.scores.scores;
        if (typeof scs === 'number') console.log(`  SCS: ${(scs * 100).toFixed(1)}%`);
        if (typeof mri === 'number') console.log(`  MRI: ${(mri * 100).toFixed(1)}%`);
        if (typeof tci === 'number') console.log(`  TCI: ${(tci * 100).toFixed(1)}%`);
        console.log('');
        if (result.scores.readiness && result.scores.readiness.verdict) {
          console.log(`🎯 Verdict: ${result.scores.readiness.verdict}`);
        }
      } else {
        console.log('📊 Scores: (not available)');
      }
      console.log('');
    }
    return result;
  }
}

export default GeneratePipelineCommand;

