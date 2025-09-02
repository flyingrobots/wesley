#!/usr/bin/env node
/**
 * Wesley CLI - Command-line interface
 * Orchestrates core logic with platform adapters
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GenerationPipeline } from '@wesley/core';
import {
  GraphQLSchemaParser,
  PostgreSQLGenerator,
  PgTAPTestGenerator,
  MigrationDiffEngine,
  NodeFileSystem,
  ConsoleLogger,
  WesleyFileWriter
} from '@wesley/host-node';

const command = process.argv[2];
const args = process.argv.slice(3);

// Parse command line arguments
function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }
  return options;
}

// Main generate command
async function generate(options) {
  const schemaPath = resolve(options.schema || 'schema.graphql');
  const schemaContent = readFileSync(schemaPath, 'utf8');
  
  // Create platform adapters
  const fileSystem = new NodeFileSystem();
  const logger = new ConsoleLogger('🚀 Wesley');
  const writer = new WesleyFileWriter(options);
  
  // Get SHA
  const sha = writer.getCurrentSHA();
  
  // Create generators with evidence map injection
  const evidenceMap = { record: () => {}, getSha: () => sha, toJSON: () => ({}) }; // Temporary
  
  // Create pipeline with ports
  const pipeline = new GenerationPipeline({
    parser: new GraphQLSchemaParser(),
    sqlGenerator: new PostgreSQLGenerator(evidenceMap),
    testGenerator: new PgTAPTestGenerator(evidenceMap),
    diffEngine: new MigrationDiffEngine(),
    fileSystem,
    logger
  });
  
  // Execute pipeline
  const bundle = await pipeline.execute(schemaContent, {
    sha,
    supabase: options.supabase,
    emitBundle: options['emit-bundle']
  });
  
  // Write results
  const files = await writer.writeBundle(bundle);
  
  // Output summary
  console.log('');
  console.log('✨ Generated:');
  if (bundle.artifacts.sql) console.log('  ✓ PostgreSQL DDL       → out/schema.sql');
  if (bundle.artifacts.typescript) console.log('  ✓ TypeScript Types     → out/types.ts');
  if (bundle.artifacts.tests) console.log('  ✓ pgTAP Tests          → tests/generated.sql');
  if (bundle.artifacts.migration) console.log('  ✓ Migration            → db/migrations/');
  console.log('');
  console.log('📊 Scores:');
  console.log(`  SCS: ${(bundle.scores.scores.scs * 100).toFixed(1)}%`);
  console.log(`  MRI: ${(bundle.scores.scores.mri * 100).toFixed(1)}%`);
  console.log(`  TCI: ${(bundle.scores.scores.tci * 100).toFixed(1)}%`);
  console.log('');
  console.log(`🎯 Verdict: ${bundle.scores.readiness.verdict}`);
}

// Test command
async function test(options) {
  console.log('🧪 Running pgTAP tests...');
  console.log('Test runner not yet implemented');
  console.log('Tests are in: tests/generated.sql');
}

// Main CLI
async function main() {
  const options = parseArgs(args);
  
  switch (command) {
    case 'generate':
      await generate(options);
      break;
      
    case 'test':
      await test(options);
      break;
      
    default:
      console.log(`
Wesley - GraphQL → Everything

Usage:
  wesley generate --schema <path>    Generate SQL, tests, and more
  wesley investigate                  Run HOLMES investigation
  wesley verify                       Run WATSON verification
  wesley predict                      Run MORIARTY predictions
  wesley test                         Run generated pgTAP tests

Options:
  --schema <path>      GraphQL schema file (default: schema.graphql)
  --emit-bundle        Emit .wesley/ evidence bundle
  --supabase          Enable Supabase features (RLS tests)

"Make it so, schema."
      `);
  }
}

main().catch(error => {
  console.error('💥 Error:', error.message);
  process.exit(1);
});