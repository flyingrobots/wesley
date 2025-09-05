/**
 * WatchCommand - File system monitoring with chokidar
 * 
 * Features:
 * - Watches GraphQL schema files for changes
 * - Debounces rapid changes (500ms)
 * - Triggers regeneration on changes  
 * - Clear console output between runs
 */

import chokidar from 'chokidar';
import { EventEmitter } from 'events';

export class WatchCommand extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.patterns = options.patterns || ['**/*.graphql', '**/*.gql', '**/*.schema'];
    this.ignored = options.ignored || ['node_modules/**', '.git/**', 'dist/**', 'build/**'];
    this.cwd = options.cwd || process.cwd();
    this.debounceMs = options.debounceMs || 500;
    this.clearConsole = options.clearConsole !== false; // Default to true
    this.onchange = options.onchange || (() => {});
    
    this.watcher = null;
    this.debounceTimer = null;
    this.isRunning = false;
  }

  /**
   * Start watching for file changes
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Watcher is already running');
    }

    this.isRunning = true;
    
    const watcherOptions = {
      cwd: this.cwd,
      ignored: this.ignored,
      ignoreInitial: true, // Don't trigger on startup
      persistent: true,
      followSymlinks: false,
      usePolling: false, // Use native events when possible
      atomic: true, // Wait for write operations to complete
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 10
      }
    };

    this.watcher = chokidar.watch(this.patterns, watcherOptions);
    
    // Set up event handlers
    this.watcher.on('add', (path) => this._handleChange('add', path));
    this.watcher.on('change', (path) => this._handleChange('change', path));
    this.watcher.on('unlink', (path) => this._handleChange('unlink', path));
    this.watcher.on('addDir', (path) => this._handleChange('addDir', path));
    this.watcher.on('unlinkDir', (path) => this._handleChange('unlinkDir', path));
    
    this.watcher.on('error', (error) => {
      console.error('Watcher error:', error);
      this.emit('error', { error });
    });

    this.watcher.on('ready', () => {
      const watchedPaths = this.watcher.getWatched();
      const pathCount = Object.keys(watchedPaths).length;
      
      console.log(`📁 Watching ${pathCount} directories for changes...`);
      console.log(`🔍 Patterns: ${this.patterns.join(', ')}`);
      console.log(`⏱️  Debounce: ${this.debounceMs}ms`);
      console.log('🎯 Ready for changes!\n');
      
      this.emit('ready', { pathCount, patterns: this.patterns });
    });

    // Handle process termination gracefully
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    
    return new Promise((resolve, reject) => {
      this.watcher.on('ready', resolve);
      this.watcher.on('error', reject);
    });
  }

  /**
   * Stop watching for file changes
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    console.log('\n👋 Watcher stopped');
    this.emit('stopped');
  }

  /**
   * Check if the watcher is currently running
   * @returns {boolean}
   */
  get isWatching() {
    return this.isRunning;
  }

  /**
   * Get list of currently watched files
   * @returns {Array<string>}
   */
  getWatchedFiles() {
    if (!this.watcher) {
      return [];
    }
    
    const watched = this.watcher.getWatched();
    const files = [];
    
    for (const [dir, filenames] of Object.entries(watched)) {
      for (const filename of filenames) {
        files.push(`${dir}/${filename}`.replace(/\/+/g, '/'));
      }
    }
    
    return files.sort();
  }

  // Private methods

  _handleChange(eventType, filePath) {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set up new debounced execution
    this.debounceTimer = setTimeout(() => {
      this._executeChange(eventType, filePath);
    }, this.debounceMs);
  }

  _executeChange(eventType, filePath) {
    if (this.clearConsole) {
      this._clearConsole();
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const changeIcon = this._getChangeIcon(eventType);
    
    console.log(`${changeIcon} [${timestamp}] ${this._formatEventType(eventType)}: ${filePath}`);
    
    // Emit change event
    this.emit('change', {
      eventType,
      filePath,
      timestamp: new Date().toISOString()
    });

    // Execute the onchange callback
    try {
      this.onchange(eventType, filePath);
    } catch (error) {
      console.error('Error in change handler:', error);
      this.emit('error', { error, eventType, filePath });
    }
  }

  _clearConsole() {
    // Clear console with ANSI escape codes (works on most terminals)
    process.stdout.write('\x1Bc');
    
    // Alternative method for Windows
    if (process.platform === 'win32') {
      process.stdout.write('\x1B[2J\x1B[0f');
    }
  }

  _getChangeIcon(eventType) {
    const icons = {
      add: '➕',
      change: '✏️',
      unlink: '🗑️',
      addDir: '📁',
      unlinkDir: '📂'
    };
    return icons[eventType] || '🔄';
  }

  _formatEventType(eventType) {
    const formats = {
      add: 'Added',
      change: 'Changed',
      unlink: 'Deleted',
      addDir: 'Directory added',
      unlinkDir: 'Directory deleted'
    };
    return formats[eventType] || eventType;
  }
}

export class WatchError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'WatchError';
    this.cause = cause;
  }
}

/**
 * Factory function to create a configured WatchCommand
 * @param {Object} options - Configuration options
 * @returns {WatchCommand}
 */
export function createWatcher(options = {}) {
  return new WatchCommand(options);
}

/**
 * Utility function to start watching with a callback
 * @param {Array<string>|string} patterns - Glob patterns to watch
 * @param {Function} onchange - Callback function for changes
 * @param {Object} options - Additional options
 * @returns {Promise<WatchCommand>}
 */
export async function watch(patterns, onchange, options = {}) {
  if (typeof patterns === 'string') {
    patterns = [patterns];
  }
  
  const watcher = new WatchCommand({
    ...options,
    patterns,
    onchange
  });
  
  await watcher.start();
  return watcher;
}