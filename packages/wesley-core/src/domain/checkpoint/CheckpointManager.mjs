/**
 * CheckpointManager - Handles checkpoint storage and recovery
 * 
 * Features:
 * - Atomic writes using write-rename pattern
 * - JSON format with versioning  
 * - Recovery from any checkpoint with verification
 * - State serialized to filesystem in .wesley/checkpoints/
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';

export class CheckpointManager {
  constructor(baseDir = '.wesley/checkpoints') {
    this.baseDir = baseDir;
    this.version = '1.0.0';
  }

  /**
   * Store a checkpoint atomically
   * @param {string} name - Checkpoint name
   * @param {Object} state - State to save  
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<string>} - Checkpoint ID
   */
  async store(name, state, metadata = {}) {
    await this._ensureDirectoryExists();
    
    const checkpoint = {
      id: this._generateId(),
      name,
      version: this.version,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        nodeVersion: process.version,
        platform: process.platform
      },
      state
    };

    const fileName = `${checkpoint.id}.json`;
    const tempFileName = `${checkpoint.id}.tmp.${randomBytes(8).toString('hex')}`;
    const filePath = join(this.baseDir, fileName);
    const tempPath = join(this.baseDir, tempFileName);

    try {
      // Write to temporary file first (atomic operation)
      await fs.writeFile(tempPath, JSON.stringify(checkpoint, null, 2), 'utf8');
      
      // Rename to final name (atomic operation on most filesystems)
      await fs.rename(tempPath, filePath);
      
      // Verify the write succeeded by reading back
      await this._verifyCheckpoint(filePath, checkpoint);
      
      return checkpoint.id;
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw new CheckpointError(`Failed to store checkpoint: ${error.message}`, error);
    }
  }

  /**
   * Load a checkpoint by ID or name
   * @param {string} idOrName - Checkpoint ID or name
   * @returns {Promise<Object|null>} - Checkpoint data or null if not found
   */
  async load(idOrName) {
    try {
      await this._ensureDirectoryExists();
      
      let filePath;
      
      // Try as ID first
      if (this._isValidId(idOrName)) {
        filePath = join(this.baseDir, `${idOrName}.json`);
      } else {
        // Search by name
        filePath = await this._findByName(idOrName);
        if (!filePath) {
          return null;
        }
      }

      const content = await fs.readFile(filePath, 'utf8');
      const checkpoint = JSON.parse(content);
      
      // Verify checkpoint integrity
      this._validateCheckpoint(checkpoint);
      
      return checkpoint;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new CheckpointError(`Failed to load checkpoint: ${error.message}`, error);
    }
  }

  /**
   * List all available checkpoints
   * @returns {Promise<Array>} - Array of checkpoint metadata
   */
  async list() {
    try {
      await this._ensureDirectoryExists();
      
      const files = await fs.readdir(this.baseDir);
      const checkpointFiles = files.filter(f => f.endsWith('.json') && !f.includes('.tmp.'));
      
      const checkpoints = [];
      
      for (const file of checkpointFiles) {
        try {
          const filePath = join(this.baseDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const checkpoint = JSON.parse(content);
          
          // Only include metadata, not full state
          checkpoints.push({
            id: checkpoint.id,
            name: checkpoint.name,
            version: checkpoint.version,
            timestamp: checkpoint.timestamp,
            metadata: checkpoint.metadata
          });
        } catch (error) {
          // Skip corrupted files
          console.warn(`Warning: Skipping corrupted checkpoint file ${file}: ${error.message}`);
        }
      }
      
      // Sort by timestamp descending (newest first)
      return checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      throw new CheckpointError(`Failed to list checkpoints: ${error.message}`, error);
    }
  }

  /**
   * Delete a checkpoint
   * @param {string} idOrName - Checkpoint ID or name
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async delete(idOrName) {
    try {
      let filePath;
      
      if (this._isValidId(idOrName)) {
        filePath = join(this.baseDir, `${idOrName}.json`);
      } else {
        filePath = await this._findByName(idOrName);
        if (!filePath) {
          return false;
        }
      }

      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw new CheckpointError(`Failed to delete checkpoint: ${error.message}`, error);
    }
  }

  /**
   * Clean up old checkpoints, keeping only the specified number
   * @param {number} keepCount - Number of checkpoints to keep
   * @returns {Promise<number>} - Number of checkpoints deleted
   */
  async cleanup(keepCount = 10) {
    const checkpoints = await this.list();
    
    if (checkpoints.length <= keepCount) {
      return 0;
    }
    
    const toDelete = checkpoints.slice(keepCount);
    let deletedCount = 0;
    
    for (const checkpoint of toDelete) {
      try {
        await this.delete(checkpoint.id);
        deletedCount++;
      } catch (error) {
        console.warn(`Warning: Failed to delete checkpoint ${checkpoint.id}: ${error.message}`);
      }
    }
    
    return deletedCount;
  }

  // Private methods

  async _ensureDirectoryExists() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new CheckpointError(`Cannot create checkpoint directory: ${error.message}`, error);
      }
    }
  }

  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(6).toString('hex');
    return `${timestamp}-${random}`;
  }

  _isValidId(str) {
    return /^[a-z0-9]+-[a-f0-9]+$/.test(str);
  }

  async _findByName(name) {
    const files = await fs.readdir(this.baseDir);
    const checkpointFiles = files.filter(f => f.endsWith('.json') && !f.includes('.tmp.'));
    
    for (const file of checkpointFiles) {
      try {
        const filePath = join(this.baseDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const checkpoint = JSON.parse(content);
        
        if (checkpoint.name === name) {
          return filePath;
        }
      } catch (error) {
        // Skip corrupted files
        continue;
      }
    }
    
    return null;
  }

  async _verifyCheckpoint(filePath, expectedCheckpoint) {
    const content = await fs.readFile(filePath, 'utf8');
    const savedCheckpoint = JSON.parse(content);
    
    if (savedCheckpoint.id !== expectedCheckpoint.id) {
      throw new Error('Checkpoint verification failed: ID mismatch');
    }
    
    if (JSON.stringify(savedCheckpoint.state) !== JSON.stringify(expectedCheckpoint.state)) {
      throw new Error('Checkpoint verification failed: State mismatch');
    }
  }

  _validateCheckpoint(checkpoint) {
    if (!checkpoint.id || !checkpoint.name || !checkpoint.version || !checkpoint.timestamp) {
      throw new Error('Invalid checkpoint: Missing required fields');
    }
    
    if (!checkpoint.state) {
      throw new Error('Invalid checkpoint: Missing state data');
    }
    
    if (checkpoint.version !== this.version) {
      console.warn(`Warning: Checkpoint version mismatch. Expected ${this.version}, got ${checkpoint.version}`);
    }
  }
}

export class CheckpointError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CheckpointError';
    this.cause = cause;
  }
}