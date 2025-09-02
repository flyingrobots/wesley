/**
 * Tests for WatchCommand
 */

import { test, describe } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WatchCommand, createWatcher, watch } from '../src/cli/WatchCommand.mjs';

describe('WatchCommand', () => {
  const testDir = join(tmpdir(), 'wesley-watch-test');
  let watcher;

  // Setup before tests
  test('setup', async () => {
    // Clean up any existing test data
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    await fs.mkdir(testDir, { recursive: true });
  });

  test('should create WatchCommand instance', () => {
    watcher = new WatchCommand({
      patterns: ['**/*.test.graphql'],
      cwd: testDir,
      debounceMs: 100
    });
    
    ok(watcher, 'Should create instance');
    strictEqual(watcher.debounceMs, 100);
    strictEqual(watcher.cwd, testDir);
    strictEqual(watcher.isWatching, false);
  });

  test('should start and stop watching', async () => {
    watcher = new WatchCommand({
      patterns: ['*.graphql'],
      cwd: testDir,
      debounceMs: 50
    });
    
    strictEqual(watcher.isWatching, false);
    
    // Start watching
    const startPromise = watcher.start();
    
    // Wait for ready
    await startPromise;
    
    strictEqual(watcher.isWatching, true);
    
    // Stop watching
    await watcher.stop();
    
    strictEqual(watcher.isWatching, false);
  });

  test('should detect file changes', async (t) => {
    let changeDetected = false;
    let changeEvent = null;
    
    watcher = new WatchCommand({
      patterns: ['*.graphql'],
      cwd: testDir,
      debounceMs: 50,
      onchange: (eventType, filePath) => {
        changeDetected = true;
        changeEvent = { eventType, filePath };
      }
    });
    
    // Set up event listener
    watcher.on('change', (event) => {
      changeDetected = true;
      changeEvent = event;
    });
    
    await watcher.start();
    
    // Create a test file
    const testFile = join(testDir, 'test.graphql');
    await fs.writeFile(testFile, 'type User { id: ID! }', 'utf8');
    
    // Wait for debounced change detection
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await watcher.stop();
    
    ok(changeDetected, 'Should detect file change');
    ok(changeEvent, 'Should emit change event');
  });

  test('should use factory functions', async () => {
    // Test createWatcher
    const factoryWatcher = createWatcher({
      patterns: ['*.gql'],
      cwd: testDir
    });
    
    ok(factoryWatcher instanceof WatchCommand, 'createWatcher should return WatchCommand instance');
    
    // Test watch utility function
    let utilityCallbackCalled = false;
    
    const utilityWatcher = await watch(
      '*.graphql',
      () => { utilityCallbackCalled = true; },
      { cwd: testDir, debounceMs: 50 }
    );
    
    ok(utilityWatcher instanceof WatchCommand, 'watch should return WatchCommand instance');
    strictEqual(utilityWatcher.isWatching, true, 'watch should start watching automatically');
    
    await utilityWatcher.stop();
  });

  test('should handle multiple patterns', () => {
    const multiWatcher = new WatchCommand({
      patterns: ['**/*.graphql', '**/*.gql', '**/*.schema'],
      cwd: testDir
    });
    
    strictEqual(multiWatcher.patterns.length, 3);
    ok(multiWatcher.patterns.includes('**/*.graphql'));
    ok(multiWatcher.patterns.includes('**/*.gql'));
    ok(multiWatcher.patterns.includes('**/*.schema'));
  });

  test('should handle ignored patterns', () => {
    const ignoredWatcher = new WatchCommand({
      patterns: ['**/*.graphql'],
      ignored: ['node_modules/**', 'dist/**', 'custom-ignore/**'],
      cwd: testDir
    });
    
    ok(ignoredWatcher.ignored.includes('node_modules/**'));
    ok(ignoredWatcher.ignored.includes('dist/**'));
    ok(ignoredWatcher.ignored.includes('custom-ignore/**'));
  });

  test('should provide default options', () => {
    const defaultWatcher = new WatchCommand();
    
    ok(Array.isArray(defaultWatcher.patterns));
    ok(defaultWatcher.patterns.includes('**/*.graphql'));
    ok(defaultWatcher.patterns.includes('**/*.gql'));
    ok(defaultWatcher.patterns.includes('**/*.schema'));
    
    strictEqual(defaultWatcher.debounceMs, 500);
    strictEqual(defaultWatcher.clearConsole, true);
    strictEqual(defaultWatcher.cwd, process.cwd());
  });

  test('should prevent multiple starts', async () => {
    watcher = new WatchCommand({
      patterns: ['*.graphql'],
      cwd: testDir
    });
    
    await watcher.start();
    
    try {
      await watcher.start();
      ok(false, 'Should throw error when starting already running watcher');
    } catch (error) {
      ok(error.message.includes('already running'), 'Should throw appropriate error');
    }
    
    await watcher.stop();
  });

  // Cleanup after all tests
  test('cleanup', async () => {
    if (watcher && watcher.isWatching) {
      await watcher.stop();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});