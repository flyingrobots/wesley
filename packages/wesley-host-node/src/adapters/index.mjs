/**
 * Adapters Index - Creates Node.js adapters for the CLI
 */

import { createPinoLogger } from './logger-pino.mjs';
import { NodeFileSystem } from './NodeFileSystem.mjs';
import { WesleyFileWriter } from './WesleyFileWriter.mjs';
import {
  GraphQLSchemaParser,
  PostgreSQLGenerator,
  PgTAPTestGenerator,
  MigrationDiffEngine
} from '../index.mjs';

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
  const postgreSQLGenerator = new PostgreSQLGenerator();
  const pgTAPTestGenerator = new PgTAPTestGenerator();
  const migrationDiffEngine = new MigrationDiffEngine();
  
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
    wesleyFileWriter
  };
}