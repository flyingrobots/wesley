/**
 * Node.js Runtime Composition
 * Creates runtime context with lazy-loaded generators
 * NO top-level imports of generator packages!
 */

import * as fs from 'node:fs/promises';
import process from 'node:process';
import pino from 'pino';
import { NodeFileSystem } from './NodeFileSystem.mjs';
import { ConfigLoader } from './ConfigLoader.mjs';
import { DbAdapter } from './DbAdapter.mjs';
import { GraphQLAdapter } from './GraphQLAdapter.mjs';

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

  // Create a wrapper that respects quiet mode
  const pinoLogger = pino({ 
    name: 'Wesley', 
    level: process.env.WESLEY_LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  });

  // Logger wrapper that can be silenced
  const logger = {
    child: (bindings) => {
      const childLogger = pinoLogger.child(bindings);
      // If level is set to silent (100), create a no-op logger
      if (bindings.level >= 100) {
        return {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {}
        };
      }
      return childLogger;
    },
    debug: pinoLogger.debug.bind(pinoLogger),
    info: pinoLogger.info.bind(pinoLogger),
    warn: pinoLogger.warn.bind(pinoLogger),
    error: pinoLogger.error.bind(pinoLogger),
    fatal: pinoLogger.fatal.bind(pinoLogger)
  };

  const nodeFs = new NodeFileSystem();

  // Load configuration (user override via env path if provided)
  let config = null;
  try {
    const loader = new ConfigLoader();
    const cfgPath = process.env.WESLEY_CONFIG_FILEPATH || null;
    config = await loader.load(cfgPath);
  } catch (e) {
    console.warn('Warning: could not load Wesley config:', e?.message || e);
  }

  return {
    // Core utilities
    logger,
    fs: nodeFs,
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    config,
    db: new DbAdapter(),
    
    // Parsers
    parsers: {
      graphql: {
        parse: (sdl) => {
          const adapter = new GraphQLAdapter();
          return adapter.parseSDL(sanitizeGraphQL(sdl, process.env));
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
    // Validators
    validators: {
      sanitizeGraphQL: (sdl) => sanitizeGraphQL(sdl, process.env)
    }
  };
}

function sanitizeGraphQL(sdl, env) {
  if (typeof sdl !== 'string') throw new Error('Schema content must be a string');
  const max = parseInt(env?.WESLEY_MAX_SCHEMA_BYTES || '5242880', 10); // 5MB default
  if (Buffer.byteLength(sdl, 'utf8') > max) {
    const e = new Error(`Schema exceeds max size (${max} bytes)`);
    e.code = 'EINPUTSIZE';
    throw e;
  }
  // Strip BOM and null bytes
  let out = sdl.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  return out;
}
