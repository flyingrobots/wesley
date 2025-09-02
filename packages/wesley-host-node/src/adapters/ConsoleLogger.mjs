/**
 * Console Logger - Simple logging implementation
 * Implements Logger port from wesley-core
 */

export class ConsoleLogger {
  constructor(prefix = '🚀 Wesley') {
    this.prefix = prefix;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${this.prefix}: ${message}`);
  }

  error(message, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${this.prefix} ERROR: ${message}`, error);
  }

  warn(message) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ${this.prefix} WARN: ${message}`);
  }

  debug(message) {
    const timestamp = new Date().toISOString();
    if (process.env.DEBUG) {
      console.debug(`[${timestamp}] ${this.prefix} DEBUG: ${message}`);
    }
  }
}