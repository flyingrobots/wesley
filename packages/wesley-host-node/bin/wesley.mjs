#!/usr/bin/env node
/**
 * Wesley CLI Executable - Node.js host entry point
 * Dependency injects Node.js adapters into the platform-agnostic CLI library
 */

import { main } from '@wesley/cli/src/main.mjs';
import { createAdapters } from '../src/adapters/index.mjs';

await main(process.argv, createAdapters());
