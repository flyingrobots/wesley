/**
 * CheckpointManager - State checkpoint and recovery system
 * Manages operation checkpoints for rollback and recovery scenarios
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export class CheckpointManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxCheckpoints: options.maxCheckpoints || 50,
      compressionEnabled: options.compressionEnabled !== false,
      persistToDisk: options.persistToDisk || false,
      checkpointDir: options.checkpointDir || './checkpoints',
      autoCleanup: options.autoCleanup !== false,
      maxAge: options.maxAge || (24 * 60 * 60 * 1000), // 24 hours
      ...options
    };

    this.checkpoints = new Map();
    this.operationStack = [];
    this.currentOperation = null;
    
    // Auto-cleanup timer
    if (this.options.autoCleanup) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Create a checkpoint for the current state
   */
  async createCheckpoint(operationId, state, metadata = {}) {
    const checkpoint = {
      id: this.generateCheckpointId(operationId),
      operationId,
      timestamp: Date.now(),
      state: await this.serializeState(state),
      metadata: {
        ...metadata,
        version: '1.0',
        size: this.calculateStateSize(state)
      },
      hash: this.generateStateHash(state)
    };

    // Store in memory
    this.checkpoints.set(checkpoint.id, checkpoint);
    
    // Track operation stack
    this.operationStack.push({
      checkpointId: checkpoint.id,
      operationId,
      timestamp: checkpoint.timestamp
    });

    // Persist to disk if enabled
    if (this.options.persistToDisk) {
      await this.persistCheckpoint(checkpoint);
    }

    // Cleanup old checkpoints
    this.enforceCheckpointLimit();

    this.emit('checkpoint:created', {
      checkpointId: checkpoint.id,
      operationId,
      size: checkpoint.metadata.size
    });

    return checkpoint.id;
  }

  /**
   * Restore state from a checkpoint
   */
  async restoreCheckpoint(checkpointId) {
    let checkpoint = this.checkpoints.get(checkpointId);
    
    // Try loading from disk if not in memory
    if (!checkpoint && this.options.persistToDisk) {
      checkpoint = await this.loadCheckpoint(checkpointId);
    }

    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    // Verify checkpoint integrity
    const restoredState = await this.deserializeState(checkpoint.state);
    const currentHash = this.generateStateHash(restoredState);
    
    if (currentHash !== checkpoint.hash) {
      throw new Error(`Checkpoint ${checkpointId} integrity check failed`);
    }

    this.emit('checkpoint:restored', {
      checkpointId,
      operationId: checkpoint.operationId,
      timestamp: checkpoint.timestamp
    });

    return {
      state: restoredState,
      metadata: checkpoint.metadata,
      operationId: checkpoint.operationId
    };
  }

  /**
   * Get the latest checkpoint for an operation
   */
  getLatestCheckpoint(operationId) {
    const operationCheckpoints = Array.from(this.checkpoints.values())
      .filter(cp => cp.operationId === operationId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return operationCheckpoints.length > 0 ? operationCheckpoints[0] : null;
  }

  /**
   * Get all checkpoints for an operation
   */
  getOperationCheckpoints(operationId) {
    return Array.from(this.checkpoints.values())
      .filter(cp => cp.operationId === operationId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Remove checkpoints for a completed operation
   */
  clearOperationCheckpoints(operationId) {
    const removed = [];
    
    for (const [checkpointId, checkpoint] of this.checkpoints) {
      if (checkpoint.operationId === operationId) {
        this.checkpoints.delete(checkpointId);
        removed.push(checkpointId);
      }
    }

    // Remove from operation stack
    this.operationStack = this.operationStack.filter(op => op.operationId !== operationId);

    this.emit('checkpoints:cleared', {
      operationId,
      removed: removed.length
    });

    return removed;
  }

  /**
   * Create a recovery point that includes multiple related checkpoints
   */
  async createRecoveryPoint(operationId, states, metadata = {}) {
    const recoveryPoint = {
      id: this.generateRecoveryPointId(operationId),
      operationId,
      timestamp: Date.now(),
      checkpoints: [],
      metadata: {
        ...metadata,
        type: 'recovery_point'
      }
    };

    // Create individual checkpoints for each state
    for (const [key, state] of Object.entries(states)) {
      const checkpointId = await this.createCheckpoint(
        `${operationId}:${key}`, 
        state, 
        { recoveryPointId: recoveryPoint.id, stateKey: key }
      );
      recoveryPoint.checkpoints.push({ key, checkpointId });
    }

    this.emit('recovery_point:created', {
      recoveryPointId: recoveryPoint.id,
      operationId,
      checkpointCount: recoveryPoint.checkpoints.length
    });

    return recoveryPoint.id;
  }

  /**
   * Restore all states from a recovery point
   */
  async restoreRecoveryPoint(recoveryPointId) {
    const recoveryCheckpoints = Array.from(this.checkpoints.values())
      .filter(cp => cp.metadata.recoveryPointId === recoveryPointId);

    if (recoveryCheckpoints.length === 0) {
      throw new Error(`Recovery point ${recoveryPointId} not found`);
    }

    const restoredStates = {};

    for (const checkpoint of recoveryCheckpoints) {
      const stateKey = checkpoint.metadata.stateKey;
      const restored = await this.restoreCheckpoint(checkpoint.id);
      restoredStates[stateKey] = restored.state;
    }

    this.emit('recovery_point:restored', {
      recoveryPointId,
      stateCount: Object.keys(restoredStates).length
    });

    return restoredStates;
  }

  /**
   * Get checkpoint statistics
   */
  getStatistics() {
    const checkpoints = Array.from(this.checkpoints.values());
    const totalSize = checkpoints.reduce((sum, cp) => sum + (cp.metadata.size || 0), 0);
    
    const operationCounts = {};
    checkpoints.forEach(cp => {
      operationCounts[cp.operationId] = (operationCounts[cp.operationId] || 0) + 1;
    });

    return {
      totalCheckpoints: checkpoints.length,
      totalSize,
      averageSize: checkpoints.length > 0 ? Math.round(totalSize / checkpoints.length) : 0,
      operationCounts,
      oldestCheckpoint: checkpoints.length > 0 ? 
        Math.min(...checkpoints.map(cp => cp.timestamp)) : null,
      newestCheckpoint: checkpoints.length > 0 ? 
        Math.max(...checkpoints.map(cp => cp.timestamp)) : null
    };
  }

  /**
   * Generate unique checkpoint ID
   */
  generateCheckpointId(operationId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `cp_${operationId}_${timestamp}_${random}`;
  }

  /**
   * Generate unique recovery point ID
   */
  generateRecoveryPointId(operationId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `rp_${operationId}_${timestamp}_${random}`;
  }

  /**
   * Calculate state size in bytes
   */
  calculateStateSize(state) {
    return Buffer.byteLength(JSON.stringify(state), 'utf8');
  }

  /**
   * Generate hash for state integrity verification
   */
  generateStateHash(state) {
    const stateStr = JSON.stringify(state, Object.keys(state).sort());
    return crypto.createHash('sha256').update(stateStr).digest('hex');
  }

  /**
   * Serialize state for storage
   */
  async serializeState(state) {
    const serialized = JSON.stringify(state);
    
    if (this.options.compressionEnabled) {
      // Simple compression - in production, use a proper compression library
      return Buffer.from(serialized).toString('base64');
    }
    
    return serialized;
  }

  /**
   * Deserialize state from storage
   */
  async deserializeState(serializedState) {
    if (this.options.compressionEnabled) {
      const decompressed = Buffer.from(serializedState, 'base64').toString();
      return JSON.parse(decompressed);
    }
    
    return JSON.parse(serializedState);
  }

  /**
   * Persist checkpoint to disk (placeholder - implement based on storage needs)
   */
  async persistCheckpoint(checkpoint) {
    // In a real implementation, this would save to disk/database
    // For now, we'll just emit an event
    this.emit('checkpoint:persisted', {
      checkpointId: checkpoint.id,
      operationId: checkpoint.operationId
    });
  }

  /**
   * Load checkpoint from disk (placeholder)
   */
  async loadCheckpoint(checkpointId) {
    // In a real implementation, this would load from disk/database
    this.emit('checkpoint:loaded', { checkpointId });
    return null;
  }

  /**
   * Enforce checkpoint limits
   */
  enforceCheckpointLimit() {
    if (this.checkpoints.size <= this.options.maxCheckpoints) {
      return;
    }

    // Remove oldest checkpoints
    const sorted = Array.from(this.checkpoints.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp);
    
    const toRemove = sorted.slice(0, this.checkpoints.size - this.options.maxCheckpoints);
    
    toRemove.forEach(([checkpointId]) => {
      this.checkpoints.delete(checkpointId);
    });

    this.emit('checkpoints:pruned', {
      removed: toRemove.length,
      remaining: this.checkpoints.size
    });
  }

  /**
   * Clean up old checkpoints
   */
  cleanup() {
    const cutoff = Date.now() - this.options.maxAge;
    const removed = [];

    for (const [checkpointId, checkpoint] of this.checkpoints) {
      if (checkpoint.timestamp < cutoff) {
        this.checkpoints.delete(checkpointId);
        removed.push(checkpointId);
      }
    }

    if (removed.length > 0) {
      this.emit('cleanup:completed', {
        removed: removed.length,
        remaining: this.checkpoints.size
      });
    }
  }

  /**
   * Dispose of the checkpoint manager
   */
  dispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.checkpoints.clear();
    this.operationStack = [];
    this.removeAllListeners();
  }
}

export default CheckpointManager;