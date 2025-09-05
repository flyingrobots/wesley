#!/usr/bin/env node
/**
 * Wesley CLI - Node.js Host Entry Point
 * This is the ONLY place where we compose everything
 * This is where Node.js-specific code lives
 */

import { program } from '@wesley/cli/src/program.mjs';
import { createNodeRuntime } from '../src/adapters/createNodeRuntime.mjs';

// Compose at the edge
const argv = process.argv.slice(2);
const ctx = await createNodeRuntime();

// Run the pure CLI with injected dependencies
try {
  const exitCode = await program(argv, ctx);
  process.exit(exitCode || 0);
} catch (error) {
  console.error(error?.stack || error);
  process.exit(1);
}