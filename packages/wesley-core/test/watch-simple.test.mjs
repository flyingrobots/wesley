/**
 * Simple test for WatchCommand functionality
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WatchCommand } from '../src/cli/WatchCommand.mjs';

const testDir = join(tmpdir(), 'wesley-watch-test-simple');

async function testBasicFunctionality() {
  console.log('Testing WatchCommand basic functionality...');
  
  // Clean up
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (e) {}
  
  await fs.mkdir(testDir, { recursive: true });
  
  // Test 1: Create instance
  const watcher = new WatchCommand({
    patterns: ['*.graphql'],
    cwd: testDir,
    debounceMs: 100,
    clearConsole: false // Don't clear console during tests
  });
  
  console.log('✓ WatchCommand instance created');
  
  // Test 2: Check default properties
  if (!watcher.patterns.includes('*.graphql')) {
    throw new Error('Patterns not set correctly');
  }
  
  if (watcher.isWatching !== false) {
    throw new Error('isWatching should be false initially');
  }
  
  console.log('✓ Properties initialized correctly');
  
  // Test 3: Start and stop
  try {
    await watcher.start();
    console.log('✓ Watcher started successfully');
    
    if (watcher.isWatching !== true) {
      throw new Error('isWatching should be true after start');
    }
    
    await watcher.stop();
    console.log('✓ Watcher stopped successfully');
    
    if (watcher.isWatching !== false) {
      throw new Error('isWatching should be false after stop');
    }
    
  } catch (error) {
    console.error('Error during start/stop test:', error);
    throw error;
  }
  
  // Test 4: Factory functions
  const { createWatcher, watch } = await import('../src/cli/WatchCommand.mjs');
  
  const factoryWatcher = createWatcher({
    patterns: ['*.gql'],
    cwd: testDir
  });
  
  if (!(factoryWatcher instanceof WatchCommand)) {
    throw new Error('createWatcher should return WatchCommand instance');
  }
  
  console.log('✓ Factory functions work correctly');
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
  
  console.log('✅ All WatchCommand tests passed!');
}

// Run the test
testBasicFunctionality().catch(error => {
  console.error('❌ WatchCommand test failed:', error);
  process.exit(1);
});