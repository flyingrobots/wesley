/**
 * Simplified Final Integration Tests - End-to-End Wesley System Testing
 * 
 * Focused integration tests covering Wave 4 finalization:
 * - CLIEnhancer integration with core components
 * - Performance benchmarks validation
 * - Safety feature verification
 * - Error handling and recovery
 * 
 * @license Apache-2.0
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';

import { CLIEnhancer } from '../src/cli/CLIEnhancer.mjs';

/**
 * Performance Benchmarks
 */
const PERFORMANCE_THRESHOLDS = {
  cliInitialization: 100, // ms
  commandProcessing: 50, // ms
  completionResponse: 30, // ms
  progressTracking: 20, // ms
  memoryUsage: 25 * 1024 * 1024 // 25MB
};

describe('Wesley Wave 4 Final Integration Tests', () => {
  let cliEnhancer;
  let startMemory;

  beforeEach(() => {
    cliEnhancer = new CLIEnhancer({
      historySize: 50,
      enableProgress: true,
      enableCompletion: true,
      enableInteractiveMode: true,
      enableDryRun: true
    });
    startMemory = process.memoryUsage().heapUsed;
  });

  afterEach(() => {
    cliEnhancer?.removeAllListeners();
    
    // Force garbage collection if available for memory tests
    if (global.gc) {
      global.gc();
    }
  });

  describe('CLIEnhancer Core Functionality', () => {
    test('should initialize within performance threshold', async () => {
      const startTime = performance.now();
      
      await cliEnhancer.initialize();
      
      const duration = performance.now() - startTime;
      assert(duration < PERFORMANCE_THRESHOLDS.cliInitialization,
        `CLI initialization took ${duration}ms, expected < ${PERFORMANCE_THRESHOLDS.cliInitialization}ms`);
    });

    test('should process commands within performance threshold', async () => {
      await cliEnhancer.initialize();
      
      const startTime = performance.now();
      
      const result = await cliEnhancer.processCommand('generate', ['sql']);
      
      const duration = performance.now() - startTime;
      assert(duration < PERFORMANCE_THRESHOLDS.commandProcessing,
        `Command processing took ${duration}ms, expected < ${PERFORMANCE_THRESHOLDS.commandProcessing}ms`);
      
      assert(result.processed);
      assert.strictEqual(result.command, 'generate');
      assert.deepStrictEqual(result.args, ['sql']);
    });

    test('should provide shell completion within performance threshold', async () => {
      await cliEnhancer.initialize();
      
      const startTime = performance.now();
      
      const completions = await cliEnhancer.getCompletions('gen', 3);
      
      const duration = performance.now() - startTime;
      assert(duration < PERFORMANCE_THRESHOLDS.completionResponse,
        `Completion response took ${duration}ms, expected < ${PERFORMANCE_THRESHOLDS.completionResponse}ms`);
      
      assert(Array.isArray(completions));
      const generateCompletion = completions.find(c => c.value === 'generate');
      assert(generateCompletion, 'Should provide generate command completion');
    });

    test('should track progress within performance threshold', async () => {
      await cliEnhancer.initialize();
      
      const startTime = performance.now();
      
      cliEnhancer.startProgress('test-operation', 100);
      cliEnhancer.updateProgress(50, 'halfway');
      cliEnhancer.completeProgress({ success: true });
      
      const duration = performance.now() - startTime;
      assert(duration < PERFORMANCE_THRESHOLDS.progressTracking,
        `Progress tracking took ${duration}ms, expected < ${PERFORMANCE_THRESHOLDS.progressTracking}ms`);
    });

    test('should maintain memory usage within threshold', async () => {
      await cliEnhancer.initialize();
      
      // Perform memory-intensive operations
      for (let i = 0; i < 100; i++) {
        await cliEnhancer.processCommand(`command${i}`, [`arg${i}`]);
        await cliEnhancer.getCompletions(`cmd${i}`, 5);
        cliEnhancer.startProgress(`op${i}`, 10);
        cliEnhancer.updateProgress(5);
        cliEnhancer.completeProgress();
      }
      
      const currentMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = currentMemory - startMemory;
      
      assert(memoryIncrease < PERFORMANCE_THRESHOLDS.memoryUsage,
        `Memory usage increased by ${memoryIncrease} bytes, expected < ${PERFORMANCE_THRESHOLDS.memoryUsage} bytes`);
    });
  });

  describe('Dry-Run Safety Features', () => {
    beforeEach(async () => {
      await cliEnhancer.initialize();
    });

    test('should identify destructive operations', () => {
      const destructiveCommands = [
        ['migrate', ['up']],
        ['rollback', []],
        ['drop', ['table']],
        ['delete', ['data']]
      ];

      const safeCommands = [
        ['generate', ['sql']],
        ['test', ['unit']],
        ['status', []],
        ['help', []]
      ];

      destructiveCommands.forEach(([cmd, args]) => {
        assert(cliEnhancer.requiresInteraction(cmd, args),
          `${cmd} should require interaction`);
      });

      safeCommands.forEach(([cmd, args]) => {
        assert(!cliEnhancer.requiresInteraction(cmd, args),
          `${cmd} should not require interaction`);
      });
    });

    test('should perform dry-run analysis correctly', async () => {
      const testCases = [
        {
          command: 'generate',
          args: ['sql'],
          expectedType: 'generation',
          expectedDestructive: false,
          expectedDatabaseChanges: false
        },
        {
          command: 'migrate',
          args: ['up'],
          expectedType: 'migration',
          expectedDestructive: true,
          expectedDatabaseChanges: true
        },
        {
          command: 'rollback',
          args: [],
          expectedType: 'rollback',
          expectedDestructive: true,
          expectedDatabaseChanges: true
        },
        {
          command: 'test',
          args: ['unit'],
          expectedType: 'testing',
          expectedDestructive: false,
          expectedDatabaseChanges: false
        }
      ];

      for (const testCase of testCases) {
        const result = await cliEnhancer.performDryRun(testCase.command, testCase.args);
        
        assert(result.dryRun, `${testCase.command} should be marked as dry-run`);
        assert.strictEqual(result.analysis.type, testCase.expectedType,
          `${testCase.command} should have type ${testCase.expectedType}`);
        assert.strictEqual(result.analysis.destructive, testCase.expectedDestructive,
          `${testCase.command} destructive flag should be ${testCase.expectedDestructive}`);
        assert.strictEqual(result.analysis.databaseChanges, testCase.expectedDatabaseChanges,
          `${testCase.command} database changes flag should be ${testCase.expectedDatabaseChanges}`);
      }
    });

    test('should bypass confirmation with force flags', () => {
      const forceFlags = ['--force', '-f', '--yes', '-y'];
      
      forceFlags.forEach(flag => {
        assert(!cliEnhancer.requiresInteraction('migrate', ['up', flag]),
          `migrate up ${flag} should not require interaction`);
        assert(!cliEnhancer.requiresInteraction('rollback', [flag]),
          `rollback ${flag} should not require interaction`);
      });
    });
  });

  describe('Command History and Aliases', () => {
    beforeEach(async () => {
      await cliEnhancer.initialize();
    });

    test('should maintain command history correctly', async () => {
      const commands = [
        ['generate', ['sql']],
        ['test', ['unit']],
        ['migrate', ['status']],
        ['help', []]
      ];

      // Execute commands
      for (const [cmd, args] of commands) {
        await cliEnhancer.processCommand(cmd, args);
      }

      const history = cliEnhancer.getHistory();
      assert.strictEqual(history.length, commands.length);
      
      // Check history order and content
      commands.forEach(([expectedCmd, expectedArgs], index) => {
        assert.strictEqual(history[index].command, expectedCmd);
        assert.deepStrictEqual(history[index].args, expectedArgs);
        assert(history[index].timestamp);
      });
    });

    test('should resolve aliases correctly', () => {
      const aliasTests = [
        ['g', 'generate'],
        ['m', 'migrate'],
        ['t', 'test'],
        ['h', 'help'],
        ['v', 'version']
      ];

      aliasTests.forEach(([alias, expected]) => {
        assert.strictEqual(cliEnhancer.resolveAlias(alias), expected,
          `Alias ${alias} should resolve to ${expected}`);
      });

      // Non-alias should return unchanged
      assert.strictEqual(cliEnhancer.resolveAlias('generate'), 'generate');
    });

    test('should manage aliases dynamically', () => {
      // Add new alias
      cliEnhancer.addAlias('new-alias', 'new-command');
      assert.strictEqual(cliEnhancer.resolveAlias('new-alias'), 'new-command');

      // Remove alias
      const removed = cliEnhancer.removeAlias('new-alias');
      assert(removed);
      assert.strictEqual(cliEnhancer.resolveAlias('new-alias'), 'new-alias');

      // Remove non-existent alias
      const notRemoved = cliEnhancer.removeAlias('non-existent');
      assert(!notRemoved);
    });

    test('should prevent aliases conflicting with commands', () => {
      assert.throws(() => {
        cliEnhancer.addAlias('generate', 'some-other-command');
      }, /conflicts with existing command/);
    });

    test('should replay commands from history', async () => {
      const originalCommand = 'generate';
      const originalArgs = ['sql'];

      await cliEnhancer.processCommand(originalCommand, originalArgs);
      
      const replayResult = await cliEnhancer.replayCommand(0);
      assert.strictEqual(replayResult.command, originalCommand);
      assert.deepStrictEqual(replayResult.args, originalArgs);
    });

    test('should limit history size', async () => {
      const historySize = cliEnhancer.options.historySize;
      
      // Add more commands than history allows
      for (let i = 0; i < historySize + 10; i++) {
        await cliEnhancer.processCommand(`command${i}`, []);
      }

      const history = cliEnhancer.getHistory();
      assert.strictEqual(history.length, historySize);
      
      // Should contain the most recent commands
      assert(history[history.length - 1].command.includes('command'));
    });
  });

  describe('Event System Integration', () => {
    beforeEach(async () => {
      await cliEnhancer.initialize();
    });

    test('should emit proper event sequence for command execution', async () => {
      const events = [];
      
      cliEnhancer.on('commandExecuted', (event) => events.push({ type: 'command', event }));
      cliEnhancer.on('progressStarted', (event) => events.push({ type: 'progress_start', event }));
      cliEnhancer.on('progressUpdated', (event) => events.push({ type: 'progress_update', event }));
      cliEnhancer.on('progressCompleted', (event) => events.push({ type: 'progress_complete', event }));

      // Execute command with progress
      await cliEnhancer.processCommand('generate', ['sql']);
      cliEnhancer.startProgress('test-operation', 10);
      cliEnhancer.updateProgress(5);
      cliEnhancer.completeProgress();

      assert.strictEqual(events.length, 4);
      assert.strictEqual(events[0].type, 'command');
      assert.strictEqual(events[1].type, 'progress_start');
      assert.strictEqual(events[2].type, 'progress_update');
      assert.strictEqual(events[3].type, 'progress_complete');

      // Verify event structure
      events.forEach(({ event }) => {
        assert(event.type);
        assert(event.payload);
        assert(event.metadata);
        assert(event.metadata.timestamp);
        assert(event.metadata.id);
      });
    });

    test('should handle event emission errors gracefully', async () => {
      let errorCaught = false;
      
      cliEnhancer.on('error', () => {
        errorCaught = true;
      });

      // This should not crash the CLI enhancer
      cliEnhancer.updateProgress(50); // No active progress should cause error

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // The CLI enhancer should still be functional
      const result = await cliEnhancer.processCommand('help', []);
      assert(result.processed);
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await cliEnhancer.initialize();
    });

    test('should handle concurrent command processing', async () => {
      const commands = [
        ['generate', ['sql']],
        ['test', ['unit']],
        ['help', []],
        ['version', []],
        ['status', []]
      ];

      const startTime = performance.now();
      
      const results = await Promise.all(
        commands.map(([cmd, args]) => cliEnhancer.processCommand(cmd, args))
      );
      
      const duration = performance.now() - startTime;
      
      assert.strictEqual(results.length, commands.length);
      results.forEach((result, index) => {
        assert(result.processed);
        assert.strictEqual(result.command, commands[index][0]);
      });

      // Should complete faster than sequential execution
      assert(duration < commands.length * PERFORMANCE_THRESHOLDS.commandProcessing);
    });

    test('should handle concurrent completion requests', async () => {
      const completionRequests = [
        'gen',
        'mig',
        'test',
        'help',
        'ver'
      ];

      const startTime = performance.now();
      
      const results = await Promise.all(
        completionRequests.map(partial => cliEnhancer.getCompletions(partial, partial.length))
      );
      
      const duration = performance.now() - startTime;
      
      assert.strictEqual(results.length, completionRequests.length);
      results.forEach(completions => {
        assert(Array.isArray(completions));
      });

      // Should complete within reasonable time
      assert(duration < completionRequests.length * PERFORMANCE_THRESHOLDS.completionResponse);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await cliEnhancer.initialize();
    });

    test('should recover from processing errors', async () => {
      // Cause an error by mocking a function to throw
      const originalResolveAlias = cliEnhancer.resolveAlias;
      cliEnhancer.resolveAlias = () => {
        throw new Error('Mock processing error');
      };

      // Should handle error gracefully
      await assert.rejects(
        cliEnhancer.processCommand('test', []),
        /Command processing failed/
      );

      // Restore function
      cliEnhancer.resolveAlias = originalResolveAlias;

      // Should continue working normally
      const result = await cliEnhancer.processCommand('help', []);
      assert(result.processed);
    });

    test('should recover from completion errors', async () => {
      // Cause completion error
      const originalCommands = cliEnhancer.commands;
      cliEnhancer.commands = null; // This will cause an error

      const completions = await cliEnhancer.getCompletions('test', 4);
      
      // Should return empty array on error, not crash
      assert(Array.isArray(completions));
      assert.strictEqual(completions.length, 0);

      // Restore
      cliEnhancer.commands = originalCommands;

      // Should work again
      const workingCompletions = await cliEnhancer.getCompletions('gen', 3);
      assert(workingCompletions.length > 0);
    });

    test('should handle invalid history replay gracefully', async () => {
      await assert.rejects(
        cliEnhancer.replayCommand(999),
        /Invalid history index/
      );

      await assert.rejects(
        cliEnhancer.replayCommand(-1),
        /Invalid history index/
      );
    });
  });

  describe('System Integration Health Check', () => {
    test('should pass comprehensive system health check', async () => {
      const healthCheck = {
        cliInitialization: false,
        commandProcessing: false,
        aliasResolution: false,
        historyManagement: false,
        progressTracking: false,
        completionSystem: false,
        dryRunAnalysis: false,
        eventSystem: false,
        errorRecovery: false,
        memoryUsage: false
      };

      const cli = new CLIEnhancer();
      const initialMemory = process.memoryUsage().heapUsed;

      try {
        // CLI Initialization
        await cli.initialize();
        healthCheck.cliInitialization = true;

        // Command Processing
        const cmdResult = await cli.processCommand('generate', ['sql']);
        healthCheck.commandProcessing = cmdResult.processed;

        // Alias Resolution
        healthCheck.aliasResolution = cli.resolveAlias('g') === 'generate';

        // History Management
        const history = cli.getHistory();
        healthCheck.historyManagement = Array.isArray(history) && history.length > 0;

        // Progress Tracking
        cli.startProgress('health-check', 10);
        cli.updateProgress(5);
        cli.completeProgress();
        healthCheck.progressTracking = true;

        // Completion System
        const completions = await cli.getCompletions('gen', 3);
        healthCheck.completionSystem = Array.isArray(completions) && completions.length > 0;

        // Dry-Run Analysis
        const dryRun = await cli.performDryRun('migrate', ['up']);
        healthCheck.dryRunAnalysis = dryRun.dryRun && dryRun.analysis;

        // Event System
        let eventReceived = false;
        cli.on('test-event', () => { eventReceived = true; });
        cli.emit('test-event', {});
        healthCheck.eventSystem = eventReceived;

        // Error Recovery
        try {
          await cli.replayCommand(999);
        } catch (error) {
          healthCheck.errorRecovery = error.message.includes('Invalid history index');
        }

        // Memory Usage
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        healthCheck.memoryUsage = memoryIncrease < PERFORMANCE_THRESHOLDS.memoryUsage;

      } finally {
        cli.removeAllListeners();
      }

      // Verify all health checks passed
      const failedChecks = Object.entries(healthCheck)
        .filter(([_, passed]) => !passed)
        .map(([check]) => check);

      assert.strictEqual(failedChecks.length, 0,
        `Health check failed for: ${failedChecks.join(', ')}`);

      // Log successful health check
      console.log('✓ Wesley Wave 4 CLI Enhancement system health check passed');
    });
  });
});