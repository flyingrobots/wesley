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
import { EventEmitter, systemClock } from '@wesley/core';

export class WatchCommand extends EventEmitter {
  constructor(options = {}) {
    super();

    this.patterns = options.patterns || ['**/*.graphql', '**/*.gql', '**/*.schema'];
    this.ignored = options.ignored || ['node_modules/**', '.git/**', 'dist/**', 'build/**'];
    this.cwd = options.cwd || process.cwd();
    this.debounceMs = options.debounceMs || 500;
    this.clearConsole = options.clearConsole !== false; // Default to true
    this.onchange = options.onchange || (() => {});
    this.clock = options.clock ?? systemClock;
    this.watcherFactory = options.watcherFactory || ((patterns, watcherOptions) => chokidar.watch(patterns, watcherOptions));
    this.console = options.console || console;
    this.stdout = options.stdout || process.stdout;
    this.processRef = options.processRef || process;
    this.boundStop = () => {
      void this.stop();
    };

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

    this.watcher = this.watcherFactory(this.patterns, watcherOptions);

    // Set up event handlers
    this.watcher.on('add', (path) => this._handleChange('add', path));
    this.watcher.on('change', (path) => this._handleChange('change', path));
    this.watcher.on('unlink', (path) => this._handleChange('unlink', path));
    this.watcher.on('addDir', (path) => this._handleChange('addDir', path));
    this.watcher.on('unlinkDir', (path) => this._handleChange('unlinkDir', path));

    this.watcher.on('error', (error) => {
      this.console.error('Watcher error:', error);
      this.emit('error', { error });
    });

    this.watcher.on('ready', () => {
      const watchedPaths = this.watcher.getWatched();
      const pathCount = Object.keys(watchedPaths).length;

      this.console.log(`📁 Watching ${pathCount} directories for changes...`);
      this.console.log(`🔍 Patterns: ${this.patterns.join(', ')}`);
      this.console.log(`⏱️  Debounce: ${this.debounceMs}ms`);
      this.console.log('🎯 Ready for changes!\n');

      this.emit('ready', { pathCount, patterns: this.patterns });
    });

    // Handle process termination gracefully
    this.processRef.on?.('SIGINT', this.boundStop);
    this.processRef.on?.('SIGTERM', this.boundStop);

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
      this.clock.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.processRef.off?.('SIGINT', this.boundStop);
    this.processRef.off?.('SIGTERM', this.boundStop);
    this.processRef.removeListener?.('SIGINT', this.boundStop);
    this.processRef.removeListener?.('SIGTERM', this.boundStop);

    this.console.log('\n👋 Watcher stopped');
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
      this.clock.clearTimeout(this.debounceTimer);
    }

    // Set up new debounced execution
    this.debounceTimer = this.clock.setTimeout(() => {
      this._executeChange(eventType, filePath);
    }, this.debounceMs);
  }

  _executeChange(eventType, filePath) {
    if (this.clearConsole) {
      this._clearConsole();
    }

    const timestamp = new Date(this.clock.nowMs()).toLocaleTimeString();
    const changeIcon = this._getChangeIcon(eventType);

    this.console.log(`${changeIcon} [${timestamp}] ${this._formatEventType(eventType)}: ${filePath}`);

    // Emit change event
    this.emit('change', {
      eventType,
      filePath,
      timestamp: this.clock.now()
    });

    // Execute the onchange callback
    try {
      this.onchange(eventType, filePath);
    } catch (error) {
      this.console.error('Error in change handler:', error);
      this.emit('error', { error, eventType, filePath });
    }
  }

  _clearConsole() {
    // Clear console with ANSI escape codes (works on most terminals)
    this.stdout.write('\x1Bc');

    // Alternative method for Windows
    if (this.processRef.platform === 'win32') {
      this.stdout.write('\x1B[2J\x1B[0f');
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
