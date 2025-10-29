/**
 * Adapters Index - Creates Node.js adapters for the CLI
 */

import { createPinoLogger } from './logger-pino.mjs';
import { NodeFileSystem } from './NodeFileSystem.mjs';
import { WesleyFileWriter } from './WesleyFileWriter.mjs';
import {
  GraphQLSchemaParser
} from '../index.mjs';
import { InProcessCompiler } from './inprocess-compiler.mjs';

// Stub migration diff engine
class StubMigrationDiffEngine {
  async diff(fromSchema, toSchema) {
    return {
      steps: [],
      operations: [],
      sql: '-- No migration generated (stub implementation)',
      manifest: { kind: 'noop' }
    };
  }
}

// Temporary stub generators until imports are fixed
class StubPostgreSQLGenerator {
  async generate(schema) {
    return 'CREATE TABLE test (id uuid PRIMARY KEY);';
  }
}

class StubPgTAPTestGenerator {
  async generate(schema) {
    return 'SELECT plan(1); SELECT ok(true, "Test");';
  }
}

export function createAdapters() {
  const logger = createPinoLogger();
  const fileSystem = new NodeFileSystem();
  
  // Process adapter - wraps Node.js process
  const processAdapter = {
    argv: process.argv,
    env: process.env,
    exit: process.exit.bind(process),
    stderr: process.stderr,
    stdout: process.stdout,
    stdin: process.stdin
  };

  // Wesley-specific adapters
  const graphQLSchemaParser = new GraphQLSchemaParser();
  const postgreSQLGenerator = new StubPostgreSQLGenerator();
  const pgTAPTestGenerator = new StubPgTAPTestGenerator();
  const migrationDiffEngine = new StubMigrationDiffEngine();
  
  // File writer adapter
  const wesleyFileWriter = {
    create: (options) => new WesleyFileWriter(options)
  };

  return {
    logger,
    fileSystem,
    process: processAdapter,
    graphQLSchemaParser,
    postgreSQLGenerator,
    pgTAPTestGenerator,
    migrationDiffEngine,
    wesleyFileWriter,
    InProcessCompiler
  };
}