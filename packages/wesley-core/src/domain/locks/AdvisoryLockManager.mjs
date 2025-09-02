/**
 * AdvisoryLockManager
 * Manages PostgreSQL advisory locks with proper key generation, timeout handling, and monitoring
 */

import { DomainEvent } from '../Events.mjs';

/**
 * Lock error classes
 */
export class LockError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'LockError';
    this.originalError = originalError;
    this.code = originalError?.code;
    this.details = originalError?.details;
  }
}

export class LockTimeoutError extends LockError {
  constructor(message, lockKey, timeout) {
    super(message);
    this.name = 'LockTimeoutError';
    this.lockKey = lockKey;
    this.timeout = timeout;
  }
}

export class LockConflictError extends LockError {
  constructor(message, lockKey, conflictingSession) {
    super(message);
    this.name = 'LockConflictError';
    this.lockKey = lockKey;
    this.conflictingSession = conflictingSession;
  }
}

/**
 * Lock Events
 */
export class LockAcquired extends DomainEvent {
  constructor(lockKey, sessionId, lockType) {
    super('LOCK_ACQUIRED', { lockKey, sessionId, lockType });
  }
}

export class LockReleased extends DomainEvent {
  constructor(lockKey, sessionId, duration) {
    super('LOCK_RELEASED', { lockKey, sessionId, duration });
  }
}

export class LockTimeout extends DomainEvent {
  constructor(lockKey, sessionId, timeout) {
    super('LOCK_TIMEOUT', { lockKey, sessionId, timeout });
  }
}

export class LockAttempt extends DomainEvent {
  constructor(lockKey, sessionId, lockType) {
    super('LOCK_ATTEMPT', { lockKey, sessionId, lockType });
  }
}

/**
 * Lock types
 */
export const LockType = {
  EXCLUSIVE: 'exclusive',
  SHARED: 'shared'
};

/**
 * AdvisoryLockManager - Manages PostgreSQL advisory locks
 */
export class AdvisoryLockManager {
  constructor(options = {}) {
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    this.lockPrefix = options.lockPrefix || 'wesley';
    this.eventEmitter = options.eventEmitter || null;
    
    // Track active locks by session
    this.activeLocks = new Map(); // sessionId -> Set of lockKeys
    this.lockMetadata = new Map(); // lockKey -> metadata
  }

  /**
   * Generate a numeric lock key from a string identifier
   * Uses a simple hash function to convert strings to PostgreSQL bigint range
   */
  generateLockKey(identifier) {
    const fullIdentifier = `${this.lockPrefix}:${identifier}`;
    let hash = 0;
    
    for (let i = 0; i < fullIdentifier.length; i++) {
      const char = fullIdentifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit signed integer
    }
    
    // Ensure we're within PostgreSQL's bigint range
    return Math.abs(hash);
  }

  /**
   * Generate a two-part lock key for more granular locking
   */
  generateTwoPartKey(namespace, identifier) {
    const namespaceKey = this.generateLockKey(namespace);
    const identifierKey = this.generateLockKey(identifier);
    return { key1: namespaceKey, key2: identifierKey };
  }

  /**
   * Acquire an exclusive advisory lock
   */
  async acquireExclusiveLock(client, identifier, options = {}) {
    return this.acquireLock(client, identifier, LockType.EXCLUSIVE, options);
  }

  /**
   * Acquire a shared advisory lock
   */
  async acquireSharedLock(client, identifier, options = {}) {
    return this.acquireLock(client, identifier, LockType.SHARED, options);
  }

  /**
   * Try to acquire an exclusive lock without blocking
   */
  async tryAcquireExclusiveLock(client, identifier, options = {}) {
    return this.tryAcquireLock(client, identifier, LockType.EXCLUSIVE, options);
  }

  /**
   * Try to acquire a shared lock without blocking
   */
  async tryAcquireSharedLock(client, identifier, options = {}) {
    return this.tryAcquireLock(client, identifier, LockType.SHARED, options);
  }

  /**
   * Generic lock acquisition with blocking
   */
  async acquireLock(client, identifier, lockType = LockType.EXCLUSIVE, options = {}) {
    const lockKey = this.generateLockKey(identifier);
    const sessionId = await this.getSessionId(client);
    const timeout = options.timeout || this.defaultTimeout;
    const twoPartKey = options.twoPartKey || null;

    this.emitEvent(new LockAttempt(lockKey, sessionId, lockType));

    try {
      const acquired = await this.executeWithTimeout(async () => {
        if (twoPartKey) {
          const { key1, key2 } = this.generateTwoPartKey(twoPartKey.namespace, twoPartKey.identifier);
          return await this.executeLockQuery(client, key1, key2, lockType, false);
        } else {
          return await this.executeLockQuery(client, lockKey, null, lockType, false);
        }
      }, timeout);

      if (acquired) {
        await this.registerLock(sessionId, lockKey, identifier, lockType);
        this.emitEvent(new LockAcquired(lockKey, sessionId, lockType));
        return { lockKey, acquired: true, sessionId };
      } else {
        this.emitEvent(new LockTimeout(lockKey, sessionId, timeout));
        throw new LockTimeoutError(`Failed to acquire ${lockType} lock on ${identifier} within ${timeout}ms`, lockKey, timeout);
      }
    } catch (error) {
      if (error instanceof LockTimeoutError) {
        throw error;
      }
      throw new LockError(`Failed to acquire ${lockType} lock: ${error.message}`, error);
    }
  }

  /**
   * Generic non-blocking lock acquisition
   */
  async tryAcquireLock(client, identifier, lockType = LockType.EXCLUSIVE, options = {}) {
    const lockKey = this.generateLockKey(identifier);
    const sessionId = await this.getSessionId(client);
    const twoPartKey = options.twoPartKey || null;

    this.emitEvent(new LockAttempt(lockKey, sessionId, lockType));

    try {
      let acquired;
      if (twoPartKey) {
        const { key1, key2 } = this.generateTwoPartKey(twoPartKey.namespace, twoPartKey.identifier);
        acquired = await this.executeLockQuery(client, key1, key2, lockType, true);
      } else {
        acquired = await this.executeLockQuery(client, lockKey, null, lockType, true);
      }

      if (acquired) {
        await this.registerLock(sessionId, lockKey, identifier, lockType);
        this.emitEvent(new LockAcquired(lockKey, sessionId, lockType));
      }

      return { lockKey, acquired, sessionId };
    } catch (error) {
      throw new LockError(`Failed to try acquire ${lockType} lock: ${error.message}`, error);
    }
  }

  /**
   * Release a specific advisory lock
   */
  async releaseLock(client, identifier, options = {}) {
    const lockKey = this.generateLockKey(identifier);
    const sessionId = await this.getSessionId(client);
    const twoPartKey = options.twoPartKey || null;

    try {
      let released;
      if (twoPartKey) {
        const { key1, key2 } = this.generateTwoPartKey(twoPartKey.namespace, twoPartKey.identifier);
        released = await this.executeUnlockQuery(client, key1, key2);
      } else {
        released = await this.executeUnlockQuery(client, lockKey, null);
      }

      if (released) {
        const duration = await this.unregisterLock(sessionId, lockKey);
        this.emitEvent(new LockReleased(lockKey, sessionId, duration));
      }

      return { lockKey, released, sessionId };
    } catch (error) {
      throw new LockError(`Failed to release lock: ${error.message}`, error);
    }
  }

  /**
   * Release all advisory locks for a session
   */
  async releaseAllLocks(client) {
    const sessionId = await this.getSessionId(client);

    try {
      const result = await client.query('SELECT pg_advisory_unlock_all()');
      
      // Clean up tracking
      const sessionLocks = this.activeLocks.get(sessionId) || new Set();
      const totalReleased = sessionLocks.size;
      
      for (const lockKey of sessionLocks) {
        await this.unregisterLock(sessionId, lockKey);
      }

      return { totalReleased, sessionId };
    } catch (error) {
      throw new LockError(`Failed to release all locks: ${error.message}`, error);
    }
  }

  /**
   * Check if a lock is currently held
   */
  async isLockHeld(client, identifier, options = {}) {
    const lockKey = this.generateLockKey(identifier);
    const twoPartKey = options.twoPartKey || null;

    try {
      let result;
      if (twoPartKey) {
        const { key1, key2 } = this.generateTwoPartKey(twoPartKey.namespace, twoPartKey.identifier);
        result = await client.query(
          `SELECT EXISTS(
            SELECT 1 FROM pg_locks 
            WHERE locktype = 'advisory' 
              AND classid = $1 
              AND objid = $2
              AND granted = true
          ) as locked`,
          [key1, key2]
        );
      } else {
        result = await client.query(
          `SELECT EXISTS(
            SELECT 1 FROM pg_locks 
            WHERE locktype = 'advisory' 
              AND classid = $1
              AND granted = true
          ) as locked`,
          [lockKey]
        );
      }

      return result.rows[0]?.locked || false;
    } catch (error) {
      throw new LockError(`Failed to check lock status: ${error.message}`, error);
    }
  }

  /**
   * Get all locks held by the current session
   */
  async getSessionLocks(client) {
    const sessionId = await this.getSessionId(client);

    try {
      const result = await client.query(`
        SELECT 
          classid,
          objid,
          objsubid,
          mode,
          granted,
          fastpath
        FROM pg_locks 
        WHERE locktype = 'advisory' 
          AND pid = pg_backend_pid()
        ORDER BY classid, objid
      `);

      return result.rows.map(row => ({
        lockKey: row.classid,
        objId: row.objid,
        mode: row.mode,
        granted: row.granted,
        fastpath: row.fastpath,
        sessionId
      }));
    } catch (error) {
      throw new LockError(`Failed to get session locks: ${error.message}`, error);
    }
  }

  /**
   * Execute lock query with appropriate function
   */
  async executeLockQuery(client, key1, key2, lockType, tryOnly) {
    const isShared = lockType === LockType.SHARED;
    let query;
    let params;

    if (key2 !== null) {
      // Two-part key
      if (tryOnly) {
        query = isShared ? 
          'SELECT pg_try_advisory_lock_shared($1, $2) as acquired' :
          'SELECT pg_try_advisory_lock($1, $2) as acquired';
      } else {
        query = isShared ?
          'SELECT pg_advisory_lock_shared($1, $2) as acquired' :
          'SELECT pg_advisory_lock($1, $2) as acquired';
      }
      params = [key1, key2];
    } else {
      // Single key
      if (tryOnly) {
        query = isShared ?
          'SELECT pg_try_advisory_lock_shared($1) as acquired' :
          'SELECT pg_try_advisory_lock($1) as acquired';
      } else {
        query = isShared ?
          'SELECT pg_advisory_lock_shared($1) as acquired' :
          'SELECT pg_advisory_lock($1) as acquired';
      }
      params = [key1];
    }

    const result = await client.query(query, params);
    return result.rows[0]?.acquired !== false; // pg_advisory_lock returns void, so we assume true
  }

  /**
   * Execute unlock query
   */
  async executeUnlockQuery(client, key1, key2) {
    let query;
    let params;

    if (key2 !== null) {
      query = 'SELECT pg_advisory_unlock($1, $2) as released';
      params = [key1, key2];
    } else {
      query = 'SELECT pg_advisory_unlock($1) as released';
      params = [key1];
    }

    const result = await client.query(query, params);
    return result.rows[0]?.released || false;
  }

  /**
   * Get the current session ID
   */
  async getSessionId(client) {
    try {
      const result = await client.query('SELECT pg_backend_pid() as session_id');
      return result.rows[0]?.session_id.toString() || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Register a lock in our tracking system
   */
  async registerLock(sessionId, lockKey, identifier, lockType) {
    if (!this.activeLocks.has(sessionId)) {
      this.activeLocks.set(sessionId, new Set());
    }
    
    this.activeLocks.get(sessionId).add(lockKey);
    
    this.lockMetadata.set(lockKey, {
      identifier,
      lockType,
      sessionId,
      acquiredAt: new Date(),
      lockKey
    });
  }

  /**
   * Unregister a lock from our tracking system
   */
  async unregisterLock(sessionId, lockKey) {
    const metadata = this.lockMetadata.get(lockKey);
    const duration = metadata ? Date.now() - metadata.acquiredAt.getTime() : 0;

    if (this.activeLocks.has(sessionId)) {
      this.activeLocks.get(sessionId).delete(lockKey);
      if (this.activeLocks.get(sessionId).size === 0) {
        this.activeLocks.delete(sessionId);
      }
    }

    this.lockMetadata.delete(lockKey);
    return duration;
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout(operation, timeoutMs) {
    return new Promise(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new LockTimeoutError(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await operation();
        clearTimeout(timeoutHandle);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Get lock statistics
   */
  getLockStatistics() {
    const totalSessions = this.activeLocks.size;
    const totalLocks = Array.from(this.activeLocks.values())
      .reduce((sum, locks) => sum + locks.size, 0);
    
    const locksByType = {};
    for (const metadata of this.lockMetadata.values()) {
      locksByType[metadata.lockType] = (locksByType[metadata.lockType] || 0) + 1;
    }

    return {
      totalSessions,
      totalLocks,
      locksByType,
      activeSessions: Array.from(this.activeLocks.keys())
    };
  }

  /**
   * Get detailed lock information
   */
  getLockDetails() {
    const locks = [];
    
    for (const [lockKey, metadata] of this.lockMetadata.entries()) {
      locks.push({
        lockKey,
        identifier: metadata.identifier,
        lockType: metadata.lockType,
        sessionId: metadata.sessionId,
        acquiredAt: metadata.acquiredAt,
        duration: Date.now() - metadata.acquiredAt.getTime()
      });
    }

    return locks.sort((a, b) => a.acquiredAt - b.acquiredAt);
  }

  /**
   * Emit event if event emitter is configured
   */
  emitEvent(event) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit('lock_event', event);
    }
  }

  /**
   * Cleanup - release all tracked locks (for graceful shutdown)
   */
  async cleanup() {
    // Note: We don't actually release locks here as they're tied to database sessions
    // Advisory locks are automatically released when the session ends
    this.activeLocks.clear();
    this.lockMetadata.clear();
  }
}

// Export singleton for convenience
export const advisoryLockManager = new AdvisoryLockManager();