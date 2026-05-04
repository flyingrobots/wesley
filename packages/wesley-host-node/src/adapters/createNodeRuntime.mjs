/**
 * Node.js Runtime Composition
 * Creates runtime context with generic host adapters.
 */

import path from 'node:path';
import process from 'node:process';
import pino from 'pino';
import { GENERATED_LEDGER_DIR } from '@wesley/core';
import {
  GitWarpEventStore,
  GraphQLAdapter
} from '@wesley/runtime-node';
import { NodeFileSystem } from './NodeFileSystem.mjs';
import { nodeCrypto } from './NodeCrypto.mjs';

const stub = {
  js: {
    emitModels: () => ({ label: 'models', files: [] }),
    emitZod: () => ({ label: 'zod', files: [] }),
    emitNextApi: () => ({ label: 'api', files: [] })
  }
};

export async function createNodeRuntime() {
  let jsGen = stub.js;

  try {
    const js = await import('@wesley/generator-js');
    jsGen = {
      emitModels: js.emitModels || stub.js.emitModels,
      emitZod: js.emitZod || stub.js.emitZod,
      emitNextApi: js.emitNextApi || stub.js.emitNextApi
    };
  } catch (_e) {
    console.warn('Warning: @wesley/generator-js not available, using stubs');
  }

  // Try to load the generic task planner
  let planner = null;

  try {
    planner = await import('@wesley/tasks');
  } catch (_e) {
    if (process.env.WESLEY_WARN_MISSING === '1') {
      console.warn('Warning: @wesley/tasks not available');
    }
  }

  // Create a wrapper that respects quiet mode
  const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
  const usePretty = isDevelopment && process.env.WESLEY_LOG_FORMAT !== 'json';
  const pinoLogger = pino({
    name: 'Wesley',
    level: process.env.WESLEY_LOG_LEVEL || 'info',
    // Use pino-pretty for readable logs in development; undefined lets pino use its default transport in other environments for performance
    transport: usePretty ? {
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

  const config = { paths: {} };

  const eventStore = new GitWarpEventStore({
    rootDir: GENERATED_LEDGER_DIR
  });

  return {
    // Core utilities
    logger,
    fs: nodeFs,
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    config,
    eventStore,

    // Parsers
    parsers: {
      graphql: {
        parse: (sdl) => {
          const adapter = new GraphQLAdapter();
          return adapter.parseSDL(sanitizeGraphQL(sdl, process.env));
        },
        parseComposed: (units) => {
          const adapter = new GraphQLAdapter();
          // Enforce aggregate size limit before per-unit sanitization
          const totalBytes = units.reduce((sum, u) => sum + Buffer.byteLength(u.sdl || '', 'utf8'), 0);
          const parsed = Number.parseInt(process.env?.WESLEY_MAX_SCHEMA_BYTES, 10);
          const max = Number.isFinite(parsed) ? parsed : 5242880;
          if (totalBytes > max) {
            const e = new Error(`Composed schema exceeds max size (${totalBytes} bytes > ${max} limit)`);
            e.code = 'EINPUTSIZE';
            throw e;
          }
          const sanitizedUnits = units.map(u => ({ ...u, sdl: sanitizeGraphQL(u.sdl, process.env) }));
          return adapter.parseComposed(sanitizedUnits);
        }
      }
    },

    // Generators (lazy-loaded)
    generators: {
      js: jsGen
    },

    // Shell exec wrapper (host-only)
    shell: {
      exec: async (cmd, options = {}) => {
        const { exec } = await import('node:child_process');
        return new Promise((resolve, reject) => {
          const child = exec(cmd, { ...options }, (error, stdout, stderr) => {
            if (error) {
              error.stdout = stdout;
              error.stderr = stderr;
              return reject(error);
            }
            resolve({ stdout, stderr });
          });
          if (options.inheritStdio) {
            child.stdout?.pipe(process.stdout);
            child.stderr?.pipe(process.stderr);
          }
        });
      },
      execSync: async (cmd, options = {}) => {
        const { execSync } = await import('node:child_process');
        return execSync(cmd, { stdio: options.stdio ?? 'pipe', ...options });
      }
    },

    // Planning (may be null); execution engines are module-owned.
    planner,

    // File writer
    writer: {
      writeFiles: async (artifacts, baseDir) => {
        if (!Array.isArray(artifacts)) {
          throw new TypeError('writer.writeFiles expects an array of artifacts');
        }
        for (const artifact of artifacts) {
          let targetPath = artifact?.path;
          if (!targetPath) {
            const name = artifact?.name ?? '<unknown>';
            // Fallback: write under provided baseDir (or 'out/') if not materialized by the caller
            if (typeof name === 'string' && name.length > 0) {
              const dir = (typeof baseDir === 'string' && baseDir.length > 0) ? baseDir : 'out';
              targetPath = path.join(dir, name);
            } else {
              throw new TypeError(`Artifact "${name}" is missing a resolved path`);
            }
          }
          await nodeFs.write(targetPath, artifact.content ?? '');
        }
      }
    },

    // Clock
    clock: {
      now: () => new Date()
    },
    // Crypto
    crypto: nodeCrypto,
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
  // Strip BOM and null bytes (matches browser runtime behaviour).
  let out = sdl;
  if (out.length && out.charCodeAt(0) === 0xFEFF) out = out.slice(1);
  if (out.indexOf('\0') !== -1) out = out.split('\0').join('');
  return out;
}
