#!/usr/bin/env node
/**
 * Simple Test Runner - Just run all tests with Node.js
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

console.log('🎯 Wesley Core Test Suite');
console.log('Running all test files with Node.js --test');

// Just run all .test.mjs files with Node.js built-in test runner
const testProcess = spawn('node', [
  '--test',
  '--test-reporter=spec',
  'test/**/*.test.mjs'
], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(code);
  }
});