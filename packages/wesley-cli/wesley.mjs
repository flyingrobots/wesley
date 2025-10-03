#!/usr/bin/env node
// Compatibility wrapper for historical CLI path used in tests/workflows
// Delegates to the platform host runtime and CLI program.

import { program } from './src/program.mjs';
import { createNodeRuntime } from '../wesley-host-node/src/adapters/createNodeRuntime.mjs';

const ctx = await createNodeRuntime();
const exitCode = await program(process.argv, ctx);
process.exit(exitCode || 0);

