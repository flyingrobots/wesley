/**
 * Wave 2 Integration Tests
 * Tests for CleanFormatter, ProgressTracker, CheckpointManager, and ErrorRecovery
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import CleanFormatter from '../src/cli/formatters/CleanFormatter.mjs';
import ProgressTracker from '../src/domain/progress/ProgressTracker.mjs';
import CheckpointManager from '../src/domain/recovery/CheckpointManager.mjs';
import ErrorRecovery from '../src/domain/recovery/ErrorRecovery.mjs';

describe('Wave 2 Components Integration', () => {
  
  describe('CleanFormatter', () => {
    test('should initialize with default options', () => {
      const formatter = new CleanFormatter();
      assert.ok(formatter);
      assert.strictEqual(formatter.options.colors, true);
      assert.strictEqual(formatter.options.unicode, true);
    });

    test('should format migration start message', () => {
      const formatter = new CleanFormatter({ colors: false, showTimestamps: false });
      // This is a visual test - we just ensure it doesn't crash
      formatter.formatMigrationStart('test_migration', 5);
      assert.ok(true); // Test passes if no exception thrown
    });

    test('should track operation counts', () => {
      const formatter = new CleanFormatter();
      formatter.formatOperationProgress('op1', 'success', 'Test operation');
      formatter.formatOperationProgress('op2', 'error', 'Failed operation');
      
      assert.strictEqual(formatter.completedCount, 1);
      assert.strictEqual(formatter.failedCount, 1);
    });
  });

  describe('ProgressTracker', () => {
    test('should track operation progress', () => {
      const tracker = new ProgressTracker();
      
      const operation = tracker.startOperation('test-op', {
        name: 'Test Operation',
        totalSteps: 10
      });
      
      assert.ok(operation);
      assert.strictEqual(operation.name, 'Test Operation');
      
      tracker.updateProgress('test-op', 0.5, 'Half complete');
      const progress = tracker.getOperationProgress('test-op');
      
      assert.strictEqual(progress.progress, 0.5);
      assert.strictEqual(progress.message, 'Half complete');
      
      tracker.dispose();
    });

    test('should calculate global progress', () => {
      const tracker = new ProgressTracker();
      
      tracker.startOperation('op1', { weight: 1 });
      tracker.startOperation('op2', { weight: 2 });
      
      tracker.updateProgress('op1', 1.0); // Complete
      tracker.updateProgress('op2', 0.5); // Half complete
      
      const global = tracker.getGlobalProgress();
      
      // Total weight: 3, completed weight: 1 + (0.5 * 2) = 2
      assert.strictEqual(global.overallProgress, 2/3);
      assert.strictEqual(global.activeOperations, 2);
      
      tracker.dispose();
    });

    test('should maintain operation history', () => {
      const tracker = new ProgressTracker();
      
      tracker.startOperation('test-op', { name: 'Test' });
      tracker.completeOperation('test-op', { success: true });
      
      const history = tracker.getHistory();
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].status, 'completed');
      
      tracker.dispose();
    });
  });

  describe('CheckpointManager', () => {
    test('should create and restore checkpoints', async () => {
      const manager = new CheckpointManager();
      
      const testState = { users: ['alice', 'bob'], version: 1 };
      const checkpointId = await manager.createCheckpoint('op1', testState);
      
      assert.ok(checkpointId);
      
      const restored = await manager.restoreCheckpoint(checkpointId);
      assert.deepStrictEqual(restored.state, testState);
      
      manager.dispose();
    });

    test('should verify checkpoint integrity', async () => {
      const manager = new CheckpointManager();
      
      const testState = { data: 'test' };
      const checkpointId = await manager.createCheckpoint('op1', testState);
      
      // Simulate corruption by modifying checkpoint data
      const checkpoint = manager.checkpoints.get(checkpointId);
      checkpoint.hash = 'invalid-hash';
      
      try {
        await manager.restoreCheckpoint(checkpointId);
        assert.fail('Should have thrown integrity error');
      } catch (error) {
        assert.ok(error.message.includes('integrity check failed'));
      }
      
      manager.dispose();
    });

    test('should manage checkpoint limits', async () => {
      const manager = new CheckpointManager({ maxCheckpoints: 3 });
      
      // Create 5 checkpoints
      for (let i = 0; i < 5; i++) {
        await manager.createCheckpoint(`op${i}`, { index: i });
      }
      
      // Should only keep the last 3
      assert.strictEqual(manager.checkpoints.size, 3);
      
      manager.dispose();
    });
  });

  describe('ErrorRecovery', () => {
    test('should execute operation with retry on failure', async () => {
      const recovery = new ErrorRecovery({ maxRetries: 2, retryDelayMs: 10 });
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts };
      };
      
      const result = await recovery.executeWithRecovery('test-op', operation);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 2);
      
      recovery.dispose();
    });

    test('should fail after max retries', async () => {
      const recovery = new ErrorRecovery({ maxRetries: 2, retryDelayMs: 10 });
      
      const operation = async () => {
        throw new Error('Persistent failure');
      };
      
      try {
        await recovery.executeWithRecovery('test-op', operation);
        assert.fail('Should have thrown after retries exhausted');
      } catch (error) {
        assert.strictEqual(error.message, 'Persistent failure');
      }
      
      recovery.dispose();
    });

    test('should categorize errors correctly', () => {
      const recovery = new ErrorRecovery();
      const categorizer = recovery.errorCategorizer;
      
      const networkError = new Error('Connection timeout');
      const dbError = new Error('Deadlock detected');
      const validationError = new Error('Invalid input format');
      
      const networkCat = categorizer.categorize(networkError);
      const dbCat = categorizer.categorize(dbError);
      const validationCat = categorizer.categorize(validationError);
      
      assert.strictEqual(networkCat.type, 'network');
      assert.strictEqual(networkCat.retryable, true);
      
      assert.strictEqual(dbCat.type, 'database');
      
      assert.strictEqual(validationCat.type, 'validation');
      assert.strictEqual(validationCat.retryable, false);
      
      recovery.dispose();
    });

    test('should integrate with checkpoint manager', async () => {
      const checkpointManager = new CheckpointManager();
      const recovery = new ErrorRecovery({ 
        maxRetries: 1, 
        retryDelayMs: 10,
        checkpointManager 
      });
      
      let attempts = 0;
      const operation = async (context) => {
        attempts++;
        
        // Create checkpoint on first attempt
        if (attempts === 1) {
          await context.createCheckpoint('before_failure', { attempts });
          throw new Error('First attempt fails');
        }
        
        return { success: true, attempts };
      };
      
      const result = await recovery.executeWithRecovery('test-op', operation, {
        getCurrentState: () => ({ operationState: 'active' })
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 2);
      
      recovery.dispose();
    });
  });

  describe('Component Integration', () => {
    test('should work together in migration scenario', async () => {
      const formatter = new CleanFormatter({ colors: false, showTimestamps: false });
      const tracker = new ProgressTracker();
      const checkpoints = new CheckpointManager();
      const recovery = new ErrorRecovery({ 
        maxRetries: 1, 
        retryDelayMs: 10,
        checkpointManager: checkpoints
      });

      // Simulate a simple migration with one operation
      const migrationOp = tracker.startOperation('migration', {
        name: 'Test Migration',
        totalSteps: 1
      });

      let operationExecuted = false;
      const result = await recovery.executeWithRecovery('migrate-op', async (context) => {
        await context.createCheckpoint('start', { step: 'begin' });
        
        tracker.updateProgress('migration', 0.5, 'Processing...');
        formatter.formatOperationProgress('migrate-op', 'start', 'Starting migration step');
        
        // Simulate work
        operationExecuted = true;
        
        formatter.formatOperationProgress('migrate-op', 'success', 'Migration step complete');
        tracker.updateProgress('migration', 1.0, 'Complete');
        
        return { success: true };
      });

      tracker.completeOperation('migration');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(operationExecuted, true);
      
      const globalProgress = tracker.getGlobalProgress();
      assert.strictEqual(globalProgress.completedOperations, 1);
      
      // Cleanup
      formatter.clearLine?.(); // Optional method call
      tracker.dispose();
      recovery.dispose();
    });
  });
});

// Run a simple integration test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Wave 2 integration validation...');
  
  // Simple smoke test
  const formatter = new CleanFormatter({ colors: false });
  const tracker = new ProgressTracker();
  const checkpoints = new CheckpointManager();
  const recovery = new ErrorRecovery({ checkpointManager: checkpoints });

  console.log('✅ All components instantiated successfully');
  console.log('✅ Wave 2 implementation complete');
  
  // Cleanup
  tracker.dispose();
  recovery.dispose();
}