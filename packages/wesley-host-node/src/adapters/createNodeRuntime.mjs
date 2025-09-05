/**
 * Node.js Runtime Composition
 * Creates runtime context with lazy-loaded generators
 * NO top-level imports of generator packages!
 */

import * as fs from 'node:fs/promises';
import process from 'node:process';
import pino from 'pino';
import { NodeFileSystem } from './NodeFileSystem.mjs';

// Stub generators for fallback when packages are broken
const stub = {
  sql: { 
    emitDDL: () => ({ label: 'ddl', files: [] }), 
    emitRLS: () => ({ label: 'rls', files: [] }), 
    emitMigrations: () => ({ label: 'migrations', files: [] }) 
  },
  tests: { 
    emitPgTap: () => ({ label: 'pgtap', files: [] }) 
  },
  js: { 
    emitModels: () => ({ label: 'models', files: [] }), 
    emitZod: () => ({ label: 'zod', files: [] }), 
    emitNextApi: () => ({ label: 'api', files: [] }) 
  }
};

export async function createNodeRuntime() {
  // Dynamic imports so --version doesn't explode
  let sqlGen = stub.sql;
  let testGen = stub.tests;
  let jsGen = stub.js;
  
  try {
    const supa = await import('@wesley/generator-supabase');
    sqlGen = { 
      emitDDL: supa.emitDDL || stub.sql.emitDDL, 
      emitRLS: supa.emitRLS || stub.sql.emitRLS, 
      emitMigrations: supa.emitMigrations || stub.sql.emitMigrations 
    };
    testGen = { 
      emitPgTap: supa.emitPgTap || stub.tests.emitPgTap 
    };
  } catch (e) {
    console.warn('Warning: @wesley/generator-supabase not available, using stubs');
  }
  
  try {
    const js = await import('@wesley/generator-js');
    jsGen = { 
      emitModels: js.emitModels || stub.js.emitModels, 
      emitZod: js.emitZod || stub.js.emitZod, 
      emitNextApi: js.emitNextApi || stub.js.emitNextApi 
    };
  } catch (e) {
    console.warn('Warning: @wesley/generator-js not available, using stubs');
  }

  // Try to load planner and runner
  let planner = null;
  let runner = null;
  
  try {
    planner = await import('@wesley/tasks');
  } catch (e) {
    console.warn('Warning: @wesley/tasks not available');
  }
  
  try {
    runner = await import('@wesley/slaps');
  } catch (e) {
    console.warn('Warning: @wesley/slaps not available');
  }

  const logger = pino({ 
    name: 'Wesley', 
    level: process.env.WESLEY_LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  });

  const nodeFs = new NodeFileSystem();

  return {
    // Core utilities
    logger,
    fs: nodeFs,
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    
    // Parsers
    parsers: { 
      graphql: { 
        parse: (s) => {
          // TODO: Wire real GraphQL parser
          return { ast: s };
        } 
      } 
    },
    
    // Generators (lazy-loaded)
    generators: { 
      sql: sqlGen, 
      tests: testGen, 
      js: jsGen 
    },
    
    // Planning and execution (may be null)
    planner,
    runner,
    
    // File writer
    writer: { 
      writeFiles: async (artifacts, outdir) => {
        // TODO: Implement proper file writing
        for (const artifact of artifacts) {
          const path = `${outdir}/${artifact.name}`;
          await nodeFs.write(path, artifact.content);
        }
      } 
    },
    
    // Clock
    clock: { 
      now: () => new Date() 
    },
  };
}