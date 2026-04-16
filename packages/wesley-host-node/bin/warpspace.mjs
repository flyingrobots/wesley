#!/usr/bin/env node

import { program } from '../src/warpspace-program.mjs';
import { createNodeRuntime } from '../src/adapters/createNodeRuntime.mjs';
import { runWesleyCli } from '../src/runWesleyCli.mjs';

await runWesleyCli({
  argv: process.argv,
  createRuntime: createNodeRuntime,
  runProgram: program
});
