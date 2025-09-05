#!/usr/bin/env node
/**
 * Wesley CLI - Data Layer Compiler
 * Command-line interface for Wesley code generation
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the main CLI module
try {
  const { main } = await import(resolve(__dirname, 'src/index.mjs'));
  await main(process.argv);
} catch (error) {
  console.error('Failed to start Wesley CLI:', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
}