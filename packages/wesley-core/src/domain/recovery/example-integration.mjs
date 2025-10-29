/**
 * Example integration showing how Wave 2 components work together
 * This demonstrates the integration between CleanFormatter, ProgressTracker, 
 * CheckpointManager, and ErrorRecovery
 */

import CleanFormatter from '../../cli/formatters/CleanFormatter.mjs';
import ProgressTracker from '../progress/ProgressTracker.mjs';
import ErrorRecovery from './ErrorRecovery.mjs';
import CheckpointManager from './CheckpointManager.mjs';

/**
 * MigrationOrchestrator - Example integration of Wave 2 components
 */
export class MigrationOrchestrator {
  constructor(options = {}) {
    this.formatter = new CleanFormatter(options.formatter);
    this.progressTracker = new ProgressTracker(options.progress);
    this.checkpointManager = new CheckpointManager(options.checkpoints);
    this.errorRecovery = new ErrorRecovery({
      ...options.recovery,
      checkpointManager: this.checkpointManager
    });

    this.setupEventHandlers();
  }

  /**
   * Execute a migration with full recovery support
   */
  async executeMigration(migrationName, operations) {
    this.formatter.formatMigrationStart(migrationName, operations.length);
    
    const migrationId = `migration_${Date.now()}`;
    const globalProgress = this.progressTracker.startOperation(migrationId, {
      name: migrationName,
      totalSteps: operations.length,
      category: 'migration'
    });

    try {
      const results = [];
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const operationId = `${migrationId}_op_${i}`;
        
        // Execute operation with error recovery
        const result = await this.errorRecovery.executeWithRecovery(
          operationId,
          async (recoveryContext) => {
            // Create checkpoint before operation
            await recoveryContext.createCheckpoint('before_operation', {
              operationIndex: i,
              completedOperations: results,
              operationData: operation.data
            });

            // Update progress
            this.progressTracker.updateProgress(
              migrationId, 
              i / operations.length,
              `Executing: ${operation.name}`
            );

            this.formatter.formatOperationProgress(
              operationId,
              'start',
              `Starting: ${operation.name}`
            );

            // Execute the actual operation
            const opResult = await this.executeOperation(operation);

            this.formatter.formatOperationProgress(
              operationId,
              'success',
              `Completed: ${operation.name}`,
              { duration: opResult.duration }
            );

            return opResult;
          },
          {
            timeoutMs: operation.timeoutMs || 30000,
            metadata: { operationName: operation.name },
            rollbackOperation: async (state, context) => {
              // Custom rollback logic for this operation
              await this.rollbackOperation(operation, state);
            }
          }
        );

        results.push(result);
      }

      // Mark global operation as complete
      this.progressTracker.completeOperation(migrationId, {
        success: true,
        results: results.length
      });

      this.formatter.formatMigrationSummary(migrationName, {
        tablesCreated: results.filter(r => r.type === 'table').length,
        indexesCreated: results.filter(r => r.type === 'index').length,
        functionsCreated: results.filter(r => r.type === 'function').length
      });

      return { success: true, results };

    } catch (error) {
      this.progressTracker.failOperation(migrationId, error);
      this.formatter.formatError(error, {
        operation: migrationName,
        details: error.stack
      });
      throw error;
    }
  }

  /**
   * Execute individual operation (placeholder)
   */
  async executeOperation(operation) {
    const startTime = Date.now();
    
    // Simulate operation execution
    await this.sleep(operation.duration || 1000);
    
    // Simulate random failures for demonstration
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error(`Operation ${operation.name} failed: Simulated database error`);
    }

    return {
      name: operation.name,
      type: operation.type || 'unknown',
      duration: Date.now() - startTime,
      success: true
    };
  }

  /**
   * Rollback operation (placeholder)
   */
  async rollbackOperation(operation, state) {
    this.formatter.formatOperationProgress(
      `rollback_${operation.name}`,
      'warning',
      `Rolling back: ${operation.name}`
    );
    
    // Implement actual rollback logic here
    await this.sleep(500);
  }

  /**
   * Setup event handlers for component integration
   */
  setupEventHandlers() {
    // Progress tracker events -> formatter updates
    this.progressTracker.on('progress:updated', ({ operationId, progress }) => {
      if (progress.message) {
        // Update live progress display
        console.log(`Progress: ${(progress.progress * 100).toFixed(1)}% - ${progress.message}`);
      }
    });

    // Error recovery events -> formatter updates  
    this.errorRecovery.on('retry:attempting', ({ operationId, attempt, maxAttempts }) => {
      this.formatter.formatOperationProgress(
        operationId,
        'warning',
        `Retry attempt ${attempt}/${maxAttempts}`
      );
    });

    this.errorRecovery.on('rollback:started', ({ operationId }) => {
      this.formatter.formatOperationProgress(
        operationId,
        'warning',
        'Initiating rollback...'
      );
    });

    // Checkpoint events -> logging
    this.checkpointManager.on('checkpoint:created', ({ checkpointId, operationId }) => {
      if (this.formatter.options.verbose) {
        this.formatter.formatOperationProgress(
          operationId,
          'info',
          `Checkpoint created: ${checkpointId}`
        );
      }
    });
  }

  /**
   * Get comprehensive system status
   */
  getStatus() {
    return {
      progress: this.progressTracker.getGlobalProgress(),
      recovery: this.errorRecovery.getStatistics(),
      checkpoints: this.checkpointManager.getStatistics()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup all components
   */
  dispose() {
    this.progressTracker.dispose();
    this.errorRecovery.dispose();
    this.checkpointManager.dispose();
  }
}

// Example usage function
export async function exampleMigrationRun() {
  const orchestrator = new MigrationOrchestrator({
    formatter: { 
      colors: true, 
      verbose: true,
      showTimestamps: true 
    },
    progress: { 
      enableMetrics: true 
    },
    checkpoints: { 
      maxCheckpoints: 20 
    },
    recovery: { 
      maxRetries: 3,
      enableAutoRollback: true 
    }
  });

  const sampleOperations = [
    { name: 'Create users table', type: 'table', duration: 2000 },
    { name: 'Add user indexes', type: 'index', duration: 1500 },
    { name: 'Create auth function', type: 'function', duration: 3000 },
    { name: 'Insert seed data', type: 'data', duration: 1000 },
    { name: 'Update schema version', type: 'metadata', duration: 500 }
  ];

  try {
    await orchestrator.executeMigration('sample_migration_v1', sampleOperations);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    orchestrator.dispose();
  }
}

export default MigrationOrchestrator;