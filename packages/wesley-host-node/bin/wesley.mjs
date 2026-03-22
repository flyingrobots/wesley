#!/usr/bin/env node
/**
 * Wesley CLI - Node.js Host Entry Point
 * This is the ONLY place where we compose everything
 * This is where Node.js-specific code lives
 */

// Prefer workspace package name; fall back to relative import when running in-repo
let program;
try {
  ({ program } = await import('@wesley/cli/src/program.mjs'));
} catch (_e) {
  ({ program } = await import('../../wesley-cli/src/program.mjs'));
}
import { createNodeRuntime } from '../src/adapters/createNodeRuntime.mjs';
import { runWesleyCli } from '../src/runWesleyCli.mjs';

await runWesleyCli({
  argv: process.argv,
  createRuntime: createNodeRuntime,
  runProgram: program
});
