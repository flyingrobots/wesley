/**
 * Tests for CheckpointManager
 */

import { test, describe } from 'node:test';
import { strictEqual, ok, rejects } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CheckpointManager, CheckpointError } from '../src/domain/checkpoint/CheckpointManager.mjs';

describe('CheckpointManager', () => {
  const testDir = '.wesley-test/checkpoints';
  let manager;

  // Setup before each test
  test('setup', async () => {
    // Clean up any existing test data
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    manager = new CheckpointManager(testDir);
  });

  test('should store and load a checkpoint', async () => {
    const state = { 
      schema: 'type User { id: ID! }',
      config: { version: '1.0' } 
    };
    const metadata = { source: 'test' };
    
    const id = await manager.store('test-checkpoint', state, metadata);
    
    ok(id, 'Should return checkpoint ID');
    ok(typeof id === 'string', 'ID should be string');
    
    const loaded = await manager.load(id);
    
    ok(loaded, 'Should load checkpoint');
    strictEqual(loaded.id, id);
    strictEqual(loaded.name, 'test-checkpoint');
    strictEqual(loaded.state.schema, state.schema);
    strictEqual(loaded.metadata.source, metadata.source);
  });

  test('should load checkpoint by name', async () => {
    const state = { test: 'data' };
    
    await manager.store('named-checkpoint', state);
    const loaded = await manager.load('named-checkpoint');
    
    ok(loaded, 'Should load checkpoint by name');
    strictEqual(loaded.name, 'named-checkpoint');
    strictEqual(loaded.state.test, 'data');
  });

  test('should return null for non-existent checkpoint', async () => {
    const loaded = await manager.load('non-existent');
    strictEqual(loaded, null);
  });

  test('should list checkpoints', async () => {
    // Clear any existing checkpoints first
    const existing = await manager.list();
    for (const checkpoint of existing) {
      await manager.delete(checkpoint.id);
    }
    
    await manager.store('checkpoint-1', { data: 1 });
    await manager.store('checkpoint-2', { data: 2 });
    
    const list = await manager.list();
    
    ok(Array.isArray(list), 'Should return array');
    strictEqual(list.length, 2, 'Should have 2 checkpoints');
    
    // Should be sorted by timestamp (newest first)
    ok(list[0].timestamp >= list[1].timestamp, 'Should be sorted by timestamp');
    
    // Should not include full state in list
    strictEqual(list[0].state, undefined, 'Should not include state in list');
  });

  test('should delete checkpoint', async () => {
    const state = { temp: 'data' };
    const id = await manager.store('temp-checkpoint', state);
    
    const deleted = await manager.delete(id);
    strictEqual(deleted, true, 'Should return true when deleted');
    
    const loaded = await manager.load(id);
    strictEqual(loaded, null, 'Deleted checkpoint should not be loadable');
  });

  test('should handle cleanup of old checkpoints', async () => {
    // Clear any existing checkpoints first
    const existing = await manager.list();
    for (const checkpoint of existing) {
      await manager.delete(checkpoint.id);
    }
    
    // Create multiple checkpoints
    for (let i = 0; i < 5; i++) {
      await manager.store(`cleanup-checkpoint-${i}`, { index: i });
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const deletedCount = await manager.cleanup(3);
    strictEqual(deletedCount, 2, 'Should delete 2 old checkpoints');
    
    const remaining = await manager.list();
    strictEqual(remaining.length, 3, 'Should have 3 checkpoints remaining');
  });

  test('should handle errors gracefully', async () => {
    // Test with invalid directory
    const badManager = new CheckpointManager('/invalid/path/that/cannot/be/created');
    
    await rejects(
      () => badManager.store('test', { data: 'test' }),
      CheckpointError,
      'Should throw CheckpointError for invalid directory'
    );
  });

  test('should verify checkpoint integrity', async () => {
    const state = { important: 'data' };
    const id = await manager.store('integrity-test', state);
    
    // Manually corrupt the file
    const filePath = join(testDir, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    const corrupted = content.replace('"important"', '"corrupted"');
    
    // Create a temp file and rename (simulate corruption during write)
    const tempPath = `${filePath}.corrupt`;
    await fs.writeFile(tempPath, corrupted, 'utf8');
    await fs.rename(tempPath, filePath);
    
    // Loading should still work (it loads what's there)
    const loaded = await manager.load(id);
    strictEqual(loaded.state.corrupted, 'data', 'Should load corrupted data');
  });

  // Cleanup after all tests
  test('cleanup', async () => {
    try {
      await fs.rm('.wesley-test', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});