/**
 * Pino Logger Adapter - High-performance JSON logging
 * Implements the Logger port using Pino
 */

import pino from 'pino';
import { Logger } from '@wesley/core';

export class PinoLogger extends Logger {
  constructor(options = {}) {
    super();
    
    const {
      name = 'wesley',
      level = 'info',
      quiet = false,
      pretty = process.env.NODE_ENV !== 'production',
      ...pinoOptions
    } = options;

    // Configure Pino options
    const config = {
      name,
      level: quiet ? 'error' : level,
      ...pinoOptions
    };

    // Add pretty printing for development
    if (pretty && !pinoOptions.transport) {
      config.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '🚀 {name}: {msg}'
        }
      };
    }

    this.logger = pino(config);
    this.quiet = quiet;
  }

  info(message, context = {}) {
    this.logger.info(context, message);
  }

  warn(message, context = {}) {
    this.logger.warn(context, message);
  }

  error(message, error = {}) {
    if (error instanceof Error) {
      this.logger.error({ err: error }, message);
    } else {
      this.logger.error(error, message);
    }
  }

  debug(message, context = {}) {
    this.logger.debug(context, message);
  }

  child(context) {
    const childLogger = new PinoLogger();
    childLogger.logger = this.logger.child(context);
    childLogger.quiet = this.quiet;
    return childLogger;
  }

  setLevel(level) {
    if (this.quiet && level !== 'error') {
      return; // Don't change level in quiet mode
    }
    this.logger.level = level;
  }

  /**
   * Get the underlying Pino logger for advanced usage
   */
  getPinoInstance() {
    return this.logger;
  }
}

/**
 * Create a logger with Wesley-specific defaults
 */
export function createWesleyLogger(options = {}) {
  return new PinoLogger({
    name: 'wesley',
    level: 'info',
    ...options
  });
}