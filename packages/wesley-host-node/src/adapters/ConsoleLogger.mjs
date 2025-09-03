/**
 * Console Logger - Simple logging implementation
 * Implements Logger port from wesley-core
 */

export class ConsoleLogger {
  constructor(prefix = '🚀 Wesley', options = {}) {
    this.prefix = prefix;
    this.level = options.level || 'info';
    this.quiet = options.quiet || false;
    
    // Log levels in order of verbosity
    this.levels = {
      'error': 0,
      'warn': 1, 
      'info': 2,
      'debug': 3
    };
  }

  shouldLog(level) {
    if (this.quiet && level !== 'error') {
      return false;
    }
    return this.levels[level] <= this.levels[this.level];
  }

  log(message, level = 'info') {
    if (!this.shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${this.prefix}: ${message}`);
  }

  error(message, error) {
    // Always show errors, even in quiet mode
    const timestamp = new Date().toISOString();
    if (error) {
      console.error(`[${timestamp}] ${this.prefix} ERROR: ${message}`, error);
    } else {
      console.error(`[${timestamp}] ${this.prefix} ERROR: ${message}`);
    }
  }

  warn(message) {
    if (!this.shouldLog('warn')) return;
    
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ${this.prefix} WARN: ${message}`);
  }

  debug(message) {
    if (!this.shouldLog('debug')) return;
    
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] ${this.prefix} DEBUG: ${message}`);
  }
}