/**
 * CleanFormatter - Professional output formatting for migration operations
 * Provides color-coded status messages, progress bars, and summary statistics
 */

import { EventEmitter } from 'events';

export class CleanFormatter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      colors: options.colors !== false, // Default to true
      unicode: options.unicode !== false, // Default to true
      width: options.width || process.stdout.columns || 80,
      showTimestamps: options.showTimestamps || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.startTime = Date.now();
    this.operations = new Map();
    this.completedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Color codes for different message types
   */
  get colors() {
    if (!this.options.colors) {
      return {
        success: (text) => text,
        error: (text) => text,
        warning: (text) => text,
        info: (text) => text,
        dim: (text) => text,
        bold: (text) => text,
        cyan: (text) => text,
        green: (text) => text,
        red: (text) => text,
        yellow: (text) => text
      };
    }

    return {
      success: (text) => `\u001b[32m${text}\u001b[0m`, // Green
      error: (text) => `\u001b[31m${text}\u001b[0m`,   // Red
      warning: (text) => `\u001b[33m${text}\u001b[0m`, // Yellow
      info: (text) => `\u001b[36m${text}\u001b[0m`,    // Cyan
      dim: (text) => `\u001b[2m${text}\u001b[0m`,      // Dim
      bold: (text) => `\u001b[1m${text}\u001b[0m`,     // Bold
      cyan: (text) => `\u001b[36m${text}\u001b[0m`,    // Cyan
      green: (text) => `\u001b[32m${text}\u001b[0m`,   // Green
      red: (text) => `\u001b[31m${text}\u001b[0m`,     // Red
      yellow: (text) => `\u001b[33m${text}\u001b[0m`   // Yellow
    };
  }

  /**
   * Unicode symbols for different statuses
   */
  get symbols() {
    if (!this.options.unicode) {
      return {
        success: '[OK]',
        error: '[ERR]',
        warning: '[WARN]',
        info: '[INFO]',
        progress: '...',
        bullet: '-',
        arrow: '=>'
      };
    }

    return {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      progress: '⚡',
      bullet: '•',
      arrow: '➜'
    };
  }

  /**
   * Format a timestamp if timestamps are enabled
   */
  formatTimestamp() {
    if (!this.options.showTimestamps) return '';
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    return this.colors.dim(`[${timestamp}] `);
  }

  /**
   * Format migration start message
   */
  formatMigrationStart(migrationName, totalOperations = 0) {
    const timestamp = this.formatTimestamp();
    const arrow = this.colors.cyan(this.symbols.arrow);
    const name = this.colors.bold(migrationName);
    
    let message = `${timestamp}${arrow} Starting migration: ${name}`;
    if (totalOperations > 0) {
      message += ` ${this.colors.dim(`(${totalOperations} operations)`)}`;
    }
    
    console.log(message);
    console.log(this.colors.dim('─'.repeat(Math.min(this.options.width, 60))));
  }

  /**
   * Format operation progress
   */
  formatOperationProgress(operationId, status, message, details = {}) {
    const timestamp = this.formatTimestamp();
    let symbol, colorFn;

    switch (status) {
      case 'start':
        symbol = this.symbols.progress;
        colorFn = this.colors.info;
        break;
      case 'success':
        symbol = this.symbols.success;
        colorFn = this.colors.success;
        this.completedCount++;
        break;
      case 'error':
        symbol = this.symbols.error;
        colorFn = this.colors.error;
        this.failedCount++;
        break;
      case 'warning':
        symbol = this.symbols.warning;
        colorFn = this.colors.warning;
        break;
      default:
        symbol = this.symbols.info;
        colorFn = this.colors.info;
    }

    let output = `${timestamp}${colorFn(symbol)} ${message}`;
    
    if (details.duration) {
      output += ` ${this.colors.dim(`(${details.duration}ms)`)}`;
    }

    console.log(output);

    if (details.error && this.options.verbose) {
      const errorLines = details.error.split('\n');
      errorLines.forEach(line => {
        if (line.trim()) {
          console.log(`  ${this.colors.dim('│')} ${this.colors.red(line)}`);
        }
      });
    }

    // Store operation info for summary
    this.operations.set(operationId, {
      status,
      message,
      duration: details.duration,
      error: details.error
    });
  }

  /**
   * Create a progress bar for long operations
   */
  createProgressBar(label, total) {
    return new ProgressBar(label, total, this.options);
  }

  /**
   * Format migration completion summary
   */
  formatMigrationSummary(migrationName, stats = {}) {
    const duration = Date.now() - this.startTime;
    const durationSeconds = (duration / 1000).toFixed(2);
    
    console.log();
    console.log(this.colors.dim('─'.repeat(Math.min(this.options.width, 60))));
    
    const success = this.completedCount > 0;
    const symbol = success ? this.symbols.success : this.symbols.error;
    const colorFn = success ? this.colors.success : this.colors.error;
    const status = success ? 'COMPLETED' : 'FAILED';
    
    console.log(`${colorFn(symbol)} Migration ${status}: ${this.colors.bold(migrationName)}`);
    
    // Statistics
    console.log();
    console.log(this.colors.bold('Summary:'));
    console.log(`  ${this.colors.bullet} Operations completed: ${this.colors.green(this.completedCount)}`);
    
    if (this.failedCount > 0) {
      console.log(`  ${this.colors.bullet} Operations failed: ${this.colors.red(this.failedCount)}`);
    }
    
    console.log(`  ${this.colors.bullet} Duration: ${this.colors.cyan(`${durationSeconds}s`)}`);
    
    if (stats.tablesCreated) {
      console.log(`  ${this.colors.bullet} Tables created: ${this.colors.info(stats.tablesCreated)}`);
    }
    
    if (stats.indexesCreated) {
      console.log(`  ${this.colors.bullet} Indexes created: ${this.colors.info(stats.indexesCreated)}`);
    }
    
    if (stats.functionsCreated) {
      console.log(`  ${this.colors.bullet} Functions created: ${this.colors.info(stats.functionsCreated)}`);
    }

    console.log();
    
    // Show failed operations if any
    if (this.failedCount > 0) {
      console.log(this.colors.red('Failed Operations:'));
      for (const [id, op] of this.operations) {
        if (op.status === 'error') {
          console.log(`  ${this.symbols.error} ${op.message}`);
          if (op.error && !this.options.verbose) {
            // Show first line of error if not in verbose mode
            const firstLine = op.error.split('\n')[0];
            console.log(`    ${this.colors.dim(firstLine)}`);
          }
        }
      }
      console.log();
    }
  }

  /**
   * Format error message with context
   */
  formatError(error, context = {}) {
    const timestamp = this.formatTimestamp();
    console.log(`${timestamp}${this.colors.error(this.symbols.error)} ${this.colors.red('ERROR:')} ${error.message}`);
    
    if (context.operation) {
      console.log(`  ${this.colors.dim('Operation:')} ${context.operation}`);
    }
    
    if (context.details && this.options.verbose) {
      console.log(`  ${this.colors.dim('Details:')} ${context.details}`);
    }
    
    if (error.stack && this.options.verbose) {
      const stackLines = error.stack.split('\n').slice(1, 5); // Show top 4 stack frames
      stackLines.forEach(line => {
        console.log(`  ${this.colors.dim(line.trim())}`);
      });
    }
  }

  /**
   * Clear the current line (for progress updates)
   */
  clearLine() {
    if (process.stdout.isTTY) {
      process.stdout.write('\r\u001b[K');
    }
  }

  /**
   * Move cursor up by n lines
   */
  cursorUp(lines = 1) {
    if (process.stdout.isTTY) {
      process.stdout.write(`\u001b[${lines}A`);
    }
  }
}

/**
 * Progress bar for long-running operations
 */
class ProgressBar {
  constructor(label, total, options = {}) {
    this.label = label;
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.options = options;
    this.lastUpdate = 0;
  }

  /**
   * Update progress bar
   */
  update(current, message = '') {
    this.current = Math.min(current, this.total);
    const now = Date.now();
    
    // Throttle updates to avoid overwhelming the terminal
    if (now - this.lastUpdate < 100 && this.current < this.total) {
      return;
    }
    this.lastUpdate = now;

    if (!process.stdout.isTTY) {
      // Non-TTY: Just show periodic updates
      if (this.current % Math.max(1, Math.floor(this.total / 10)) === 0 || this.current === this.total) {
        console.log(`${this.label}: ${this.current}/${this.total} ${message}`);
      }
      return;
    }

    const percent = this.total > 0 ? (this.current / this.total) : 0;
    const barLength = Math.min(30, this.options.width - 50);
    const filled = Math.floor(barLength * percent);
    const empty = barLength - filled;
    
    const bar = this.options.colors !== false 
      ? `\u001b[32m${'█'.repeat(filled)}\u001b[0m${'░'.repeat(empty)}`
      : `${'#'.repeat(filled)}${'.'.repeat(empty)}`;
    
    const percentText = `${(percent * 100).toFixed(1)}%`.padStart(6);
    const progress = `${this.current}/${this.total}`.padStart(10);
    
    // Calculate ETA
    const elapsed = now - this.startTime;
    const eta = percent > 0 ? ((elapsed / percent) - elapsed) : 0;
    const etaText = eta > 0 ? this.formatDuration(eta) : '--:--';
    
    let line = `${this.label}: [${bar}] ${percentText} ${progress} ETA: ${etaText}`;
    
    if (message) {
      line += ` | ${message}`;
    }

    // Clear line and write new content
    process.stdout.write(`\r${line.slice(0, this.options.width - 1)}`);
    
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Format duration in mm:ss format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Complete the progress bar
   */
  complete(message = 'Complete') {
    this.update(this.total, message);
  }
}

export default CleanFormatter;