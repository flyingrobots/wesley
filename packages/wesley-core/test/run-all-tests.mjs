#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 * Runs all test types with proper organization and reporting
 */

import { spawn } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Test configurations
const testConfigs = {
  unit: {
    pattern: 'test/unit/**/*.test.mjs',
    description: 'Unit Tests',
    timeout: 5000
  },
  integration: {
    pattern: 'test/integration/**/*.test.mjs',
    description: 'Integration Tests',
    timeout: 30000
  },
  property: {
    pattern: 'test/property/**/*.test.mjs',
    description: 'Property-Based Tests',
    timeout: 15000
  },
  snapshots: {
    pattern: 'test/snapshots/**/*.test.mjs',
    description: 'Snapshot Tests',
    timeout: 10000
  },
  e2e: {
    pattern: 'test/e2e/**/*.test.mjs',
    description: 'End-to-End Tests',
    timeout: 60000
  }
};

function findTestFiles(pattern) {
  const wildcardIndex = pattern.indexOf('*');
  const basePart = wildcardIndex === -1 ? pattern : pattern.slice(0, wildcardIndex);
  const normalizedBase = basePart.replace(/\/$/, '') || '.';
  const baseDir = join(projectRoot, normalizedBase);

  if (!existsSync(baseDir)) {
    return [];
  }

  const suffix = pattern.includes('.') ? pattern.slice(pattern.indexOf('.')) : '.test.mjs';
  const files = [];

  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        files.push(relative(projectRoot, absolutePath));
      }
    }
  };

  walk(baseDir);
  return files.sort();
}

/**
 * Run a specific test suite
 */
async function runTestSuite(suiteName, config, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running ${config.description}...`);
    console.log(`   Pattern: ${config.pattern}`);

    const matchedFiles = findTestFiles(config.pattern);
    if (matchedFiles.length === 0) {
      console.log('   ⚪️  No test files matched pattern, skipping suite');
      resolve({ suite: suiteName, status: 'skipped', code: 0 });
      return;
    }

    console.log(`   Matched files: ${matchedFiles.length}`);

    const args = ['--test'];

    if (options.coverage) {
      args.push('--experimental-test-coverage');
    }

    args.push('--test-timeout', config.timeout.toString());

    if (options.watch) {
      args.push('--watch');
    }

    if (options.reporter) {
      args.push('--test-reporter', options.reporter);
    }

    args.push(...matchedFiles);

    const testProcess = spawn('node', args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Set snapshot update mode if requested
        ...(options.updateSnapshots ? { UPDATE_SNAPSHOTS: '1' } : {})
      }
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${config.description} passed`);
        resolve({ suite: suiteName, status: 'passed', code });
      } else {
        console.log(`❌ ${config.description} failed (exit code: ${code})`);
        if (options.bailOnFail) {
          reject(new Error(`${config.description} failed`));
        } else {
          resolve({ suite: suiteName, status: 'failed', code });
        }
      }
    });

    testProcess.on('error', (error) => {
      console.error(`💥 Error running ${config.description}:`, error);
      reject(error);
    });
  });
}

/**
 * Run specific test suites in parallel
 */
async function runTestsParallel(suiteNames, options = {}) {
  console.log(`🚀 Running tests in parallel: ${suiteNames.join(', ')}`);
  
  const promises = suiteNames.map(suiteName => {
    const config = testConfigs[suiteName];
    if (!config) {
      throw new Error(`Unknown test suite: ${suiteName}`);
    }
    return runTestSuite(suiteName, config, options);
  });

  const results = await Promise.allSettled(promises);
  
  // Report results
  console.log('\n📊 Parallel Test Results:');
  results.forEach((result, index) => {
    const suiteName = suiteNames[index];
    if (result.status === 'fulfilled') {
      const { status, code } = result.value;
      console.log(`   ${suiteName}: ${status} (${code})`);
    } else {
      console.log(`   ${suiteName}: error - ${result.reason.message}`);
    }
  });

  const failedCount = results.filter(r => 
    r.status === 'rejected' || r.value?.status === 'failed'
  ).length;

  return { total: results.length, failed: failedCount };
}

/**
 * Run tests sequentially 
 */
async function runTestsSequential(suiteNames, options = {}) {
  console.log(`🐌 Running tests sequentially: ${suiteNames.join(', ')}`);
  
  const results = [];
  
  for (const suiteName of suiteNames) {
    const config = testConfigs[suiteName];
    if (!config) {
      throw new Error(`Unknown test suite: ${suiteName}`);
    }
    
    try {
      const result = await runTestSuite(suiteName, config, options);
      results.push(result);
      
      if (result.status === 'failed' && options.bailOnFail) {
        break;
      }
    } catch (error) {
      results.push({ suite: suiteName, status: 'error', error });
      if (options.bailOnFail) {
        break;
      }
    }
  }
  
  // Report results
  console.log('\n📊 Sequential Test Results:');
  results.forEach(result => {
    console.log(`   ${result.suite}: ${result.status}`);
  });

  const failedCount = results.filter(r => 
    r.status === 'failed' || r.status === 'error'
  ).length;

  return { total: results.length, failed: failedCount };
}

/**
 * Main test runner
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line options
  const options = {
    coverage: args.includes('--coverage'),
    watch: args.includes('--watch'),
    updateSnapshots: args.includes('--update-snapshots'),
    parallel: args.includes('--parallel'),
    sequential: args.includes('--sequential'),
    bailOnFail: args.includes('--bail'),
    reporter: args.includes('--reporter=tap') ? 'tap' : 'spec'
  };

  // Parse test suite selection
  let selectedSuites = Object.keys(testConfigs);
  
  const suiteArgs = args.filter(arg => !arg.startsWith('--'));
  if (suiteArgs.length > 0) {
    selectedSuites = suiteArgs.filter(suite => testConfigs[suite]);
    
    // Warn about unknown suites
    const unknownSuites = suiteArgs.filter(suite => !testConfigs[suite]);
    if (unknownSuites.length > 0) {
      console.warn(`⚠️  Unknown test suites: ${unknownSuites.join(', ')}`);
      console.warn(`   Available suites: ${Object.keys(testConfigs).join(', ')}`);
    }
  }

  // Use all suites by default; CI selection is controlled by workflows

  if (selectedSuites.length === 0) {
    console.error('❌ No valid test suites specified');
    process.exit(1);
  }

  console.log(`\n🎯 Wesley Core Test Suite`);
  console.log(`   Selected: ${selectedSuites.join(', ')}`);
  console.log(`   Mode: ${options.parallel ? 'parallel' : 'sequential'}`);
  if (options.coverage) console.log(`   Coverage: enabled`);
  if (options.updateSnapshots) console.log(`   Snapshots: update mode`);

  try {
    const runFunction = options.parallel ? runTestsParallel : runTestsSequential;
    const results = await runFunction(selectedSuites, options);
    
    console.log(`\n🏁 Test Summary:`);
    console.log(`   Total suites: ${results.total}`);
    console.log(`   Failed suites: ${results.failed}`);
    console.log(`   Success rate: ${((results.total - results.failed) / results.total * 100).toFixed(1)}%`);
    
    if (results.failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Test runner error:', error.message);
    process.exit(1);
  }
}

// Show usage if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Wesley Core Test Runner

Usage: node test/run-all-tests.mjs [suites...] [options]

Test Suites:
  unit         Unit tests for individual modules
  integration  Integration tests for component interaction
  property     Property-based tests using fast-check
  snapshots    Snapshot tests for generated output
  e2e          End-to-end tests
  
  (default: run all suites)

Options:
  --coverage           Enable test coverage reporting
  --watch             Watch mode for development
  --update-snapshots  Update snapshot files
  --parallel          Run test suites in parallel (default)
  --sequential        Run test suites sequentially
  --bail              Stop on first failure
  --reporter=tap      Use TAP reporter

Examples:
  node test/run-all-tests.mjs                    # Run all tests
  node test/run-all-tests.mjs unit property      # Run specific suites
  node test/run-all-tests.mjs --coverage         # Run with coverage
  node test/run-all-tests.mjs snapshots --update-snapshots  # Update snapshots
  node test/run-all-tests.mjs --watch unit       # Watch unit tests
`);
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
