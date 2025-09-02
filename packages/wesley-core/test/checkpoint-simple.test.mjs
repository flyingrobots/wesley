/**
 * Simple test for CheckpointManager functionality
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CheckpointManager } from '../src/domain/checkpoint/CheckpointManager.mjs';

const testDir = join(tmpdir(), 'wesley-checkpoint-test-simple');

async function testBasicFunctionality() {
  console.log('Testing CheckpointManager basic functionality...');
  
  // Clean up
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (e) {}
  
  const manager = new CheckpointManager(testDir);
  
  // Test 1: Store and load a checkpoint
  const state = { 
    schema: 'type User { id: ID! name: String! }',
    config: { version: '1.0', environment: 'test' },
    timestamp: new Date().toISOString()
  };
  
  const metadata = { 
    source: 'test-suite',
    reason: 'integration-test' 
  };
  
  const checkpointId = await manager.store('test-checkpoint', state, metadata);
  console.log('✓ Checkpoint stored with ID:', checkpointId);
  
  // Test 2: Load by ID
  const loadedById = await manager.load(checkpointId);
  if (!loadedById) {
    throw new Error('Failed to load checkpoint by ID');
  }
  
  if (loadedById.name !== 'test-checkpoint') {
    throw new Error('Checkpoint name mismatch');
  }
  
  if (loadedById.state.schema !== state.schema) {
    throw new Error('Checkpoint state mismatch');
  }
  
  console.log('✓ Checkpoint loaded by ID successfully');
  
  // Test 3: Load by name
  const loadedByName = await manager.load('test-checkpoint');
  if (!loadedByName) {
    throw new Error('Failed to load checkpoint by name');
  }
  
  if (loadedByName.id !== checkpointId) {
    throw new Error('Checkpoint ID mismatch when loading by name');
  }
  
  console.log('✓ Checkpoint loaded by name successfully');
  
  // Test 4: List checkpoints
  await manager.store('second-checkpoint', { data: 'test2' });
  await manager.store('third-checkpoint', { data: 'test3' });
  
  const checkpoints = await manager.list();
  if (checkpoints.length !== 3) {
    throw new Error(`Expected 3 checkpoints, got ${checkpoints.length}`);
  }
  
  // Should be sorted by timestamp (newest first)
  if (new Date(checkpoints[0].timestamp) < new Date(checkpoints[1].timestamp)) {
    throw new Error('Checkpoints not sorted by timestamp correctly');
  }
  
  console.log('✓ Checkpoint listing works correctly');
  
  // Test 5: Delete checkpoint
  const deleted = await manager.delete(checkpointId);
  if (!deleted) {
    throw new Error('Failed to delete checkpoint');
  }
  
  const afterDelete = await manager.load(checkpointId);
  if (afterDelete !== null) {
    throw new Error('Checkpoint still exists after deletion');
  }
  
  console.log('✓ Checkpoint deletion works correctly');
  
  // Test 6: Cleanup old checkpoints
  const remainingCount = await manager.list();
  const deletedCount = await manager.cleanup(1); // Keep only 1
  
  if (deletedCount !== 1) {
    throw new Error(`Expected to delete 1 checkpoint, deleted ${deletedCount}`);
  }
  
  const afterCleanup = await manager.list();
  if (afterCleanup.length !== 1) {
    throw new Error(`Expected 1 checkpoint after cleanup, got ${afterCleanup.length}`);
  }
  
  console.log('✓ Checkpoint cleanup works correctly');
  
  // Test 7: Handle non-existent checkpoint
  const nonExistent = await manager.load('non-existent-id');
  if (nonExistent !== null) {
    throw new Error('Should return null for non-existent checkpoint');
  }
  
  console.log('✓ Non-existent checkpoint handling works correctly');
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
  
  console.log('✅ All CheckpointManager tests passed!');
}

// Run the test
testBasicFunctionality().catch(error => {
  console.error('❌ CheckpointManager test failed:', error);
  process.exit(1);
});